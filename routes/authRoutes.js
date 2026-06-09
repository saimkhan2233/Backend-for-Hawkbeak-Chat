const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { signup, login, logout, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { signupValidation, loginValidation } = require("../validations/authValidations");
const { uploadProfilePicture } = require("../config/cloudinary");

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: "Too many attempts, please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signup", authLimiter, uploadProfilePicture, signupValidation, validate, signup);
router.post("/login", authLimiter, loginValidation, validate, login);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

module.exports = router;
