const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { deleteImage } = require("../config/cloudinary");

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
exports.signup = asyncHandler(async (req, res) => {
  const { fullName, username, email, password } = req.body;

  // Check existing user
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    if (existingUser.email === email) return sendError(res, "Email already in use", 400);
    return sendError(res, "Username already taken", 400);
  }

  let profilePicture = { url: "", publicId: "" };

  // Handle optional profile picture upload
  if (req.file) {
    profilePicture = {
      url: req.file.path,
      publicId: req.file.filename,
    };
  }

  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    profilePicture,
  });

  const token = generateToken(user._id);

  return sendSuccess(
    res,
    {
      token,
      user: user.toPublicJSON(),
    },
    "Account created successfully",
    201
  );
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, "Invalid email or password", 401);
  }

  user.isOnline = true;
  user.lastSeen = Date.now();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);

  return sendSuccess(res, { token, user: user.toPublicJSON() }, "Logged in successfully");
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    isOnline: false,
    lastSeen: Date.now(),
    socketId: null,
  });

  res.clearCookie("token");
  return sendSuccess(res, {}, "Logged out successfully");
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return sendSuccess(res, { user: user.toPublicJSON() });
});
