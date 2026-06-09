const { sendError } = require("../utils/apiResponse");

const errorHandler = (err, req, res, _next) => {
  console.error("🔴 Error:", err.message);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    return sendError(res, `Resource not found with id: ${err.value}`, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`, 400);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, messages.join(", "), 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return sendError(res, "Invalid token", 401);
  }
  if (err.name === "TokenExpiredError") {
    return sendError(res, "Token expired", 401);
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return sendError(res, "File size must be under 5 MB", 400);
  }

  return sendError(res, err.message || "Internal server error", err.statusCode || 500);
};

module.exports = errorHandler;
