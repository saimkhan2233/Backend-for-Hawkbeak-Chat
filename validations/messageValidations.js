const { body, param } = require("express-validator");

exports.sendMessageValidation = [
  body("chatId").notEmpty().withMessage("Chat ID is required").isMongoId().withMessage("Invalid chat ID"),
  body("content")
    .notEmpty().withMessage("Message content is required")
    .isLength({ max: 2000 }).withMessage("Message cannot exceed 2000 characters"),
];

exports.mongoIdParam = (paramName) => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
];
