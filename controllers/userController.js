const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { deleteImage } = require("../config/cloudinary");

// ── GET /api/users ────────────────────────────────────────────────────────────
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } })
    .select("fullName username profilePicture avatarInitial isOnline lastSeen status bio")
    .sort({ fullName: 1 });

  return sendSuccess(res, { users });
});

// ── GET /api/users/search?q= ──────────────────────────────────────────────────
exports.searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) return sendSuccess(res, { users: [] });

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { fullName: { $regex: query, $options: "i" } },
      { username: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ],
  }).select("fullName username profilePicture avatarInitial isOnline status bio");

  return sendSuccess(res, { users });
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
exports.getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "fullName username profilePicture avatarInitial isOnline lastSeen status bio"
  );

  if (!user) return sendError(res, "User not found", 404);
  return sendSuccess(res, { user });
});

// ── PUT /api/users/profile ────────────────────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const { fullName, username, bio, status } = req.body;
  const updateData = {};

  if (fullName) updateData.fullName = fullName;
  if (username) updateData.username = username.toLowerCase();
  if (bio !== undefined) updateData.bio = bio;
  if (status) updateData.status = status;

  // Profile picture upload via Cloudinary
  if (req.file) {
    // Delete old image if exists
    if (req.user.profilePicture?.publicId) {
      await deleteImage(req.user.profilePicture.publicId);
    }
    updateData.profilePicture = {
      url: req.file.path,
      publicId: req.file.filename,
    };
  }

  // Recompute avatarInitial if fullName changed
  if (fullName) {
    updateData.avatarInitial = fullName.charAt(0).toUpperCase();
  }

  // Check username uniqueness
  if (username) {
    const exists = await User.findOne({
      username: username.toLowerCase(),
      _id: { $ne: req.user._id },
    });
    if (exists) return sendError(res, "Username already taken", 400);
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateData, {
    new: true,
    runValidators: true,
  });

  return sendSuccess(res, { user: user.toPublicJSON() }, "Profile updated");
});

// ── PUT /api/users/password ───────────────────────────────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!(await user.comparePassword(currentPassword))) {
    return sendError(res, "Current password is incorrect", 400);
  }

  user.password = newPassword;
  await user.save();

  const generateToken = require("../utils/generateToken");
  const token = generateToken(user._id);

  return sendSuccess(res, { token }, "Password changed successfully");
});
