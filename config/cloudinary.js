const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Profile picture storage ───────────────────────────────────────────────────
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hawkbeak/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  },
});

// ── Group avatar storage ──────────────────────────────────────────────────────
const groupAvatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hawkbeak/groups",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  },
});

const uploadProfilePicture = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"), false);
  },
}).single("profilePicture");

const uploadGroupAvatar = multer({
  storage: groupAvatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"), false);
  },
}).single("groupAvatar");

const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

module.exports = { cloudinary, uploadProfilePicture, uploadGroupAvatar, deleteImage };
