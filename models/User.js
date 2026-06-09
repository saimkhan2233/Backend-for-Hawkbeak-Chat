const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [60, "Full name cannot exceed 60 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    profilePicture: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    avatarInitial: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: [160, "Bio cannot exceed 160 characters"],
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["Available", "Busy", "Away"],
      default: "Available",
    },
  },
  { timestamps: true }
);

// ── Pre-save: hash password + set avatarInitial ───────────────────────────────
userSchema.pre("save", async function (next) {
  // Set avatar initial from fullName
  if (this.isModified("fullName") || this.isNew) {
    this.avatarInitial = this.fullName.charAt(0).toUpperCase();
  }

  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method: compare passwords ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Instance method: safe public profile ─────────────────────────────────────
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.socketId;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
