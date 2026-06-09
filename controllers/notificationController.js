const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── GET /api/notifications ────────────────────────────────────────────────────
exports.getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate("sender", "fullName username profilePicture avatarInitial")
    .populate("chat", "chatName isGroupChat")
    .sort({ createdAt: -1 })
    .limit(50);

  return sendSuccess(res, { notifications });
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
exports.markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) return sendError(res, "Notification not found", 404);

  notification.isRead = true;
  await notification.save();

  return sendSuccess(res, { notification }, "Notification marked as read");
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  return sendSuccess(res, {}, "All notifications marked as read");
});
