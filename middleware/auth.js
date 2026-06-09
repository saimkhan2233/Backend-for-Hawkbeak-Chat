const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendError } = require("../utils/apiResponse");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check Authorization header (Bearer token) or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, "Not authorised – no token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return sendError(res, "User no longer exists", 401);
    }

    next();
  } catch (err) {
    return sendError(res, "Not authorised – invalid or expired token", 401);
  }
});

module.exports = { protect };
