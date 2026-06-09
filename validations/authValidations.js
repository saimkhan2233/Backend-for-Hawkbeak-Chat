const { body } = require("express-validator");

exports.signupValidation = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required")
    .isLength({ max: 60 }).withMessage("Full name cannot exceed 60 characters"),

  body("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers and underscores"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email"),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

exports.loginValidation = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email"),

  body("password")
    .notEmpty().withMessage("Password is required"),
];

exports.changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];
