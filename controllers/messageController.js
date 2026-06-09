const Message = require("../models/Message");
const Chat = require("../models/Chat");
const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const populateMessage = (query) =>
  query
    .populate("sender", "fullName username profilePicture avatarInitial")
    .populate("chat")
    .populate("readBy.user", "fullName username profilePicture avatarInitial")
    .populate("deliveredTo.user", "fullName username profilePicture avatarInitial");

// ── POST /api/messages ────────────────────────────────────────────────────────
exports.sendMessage = asyncHandler(async (req, res) => {
  const { chatId, content } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) return sendError(res, "Chat not found", 404);

  const isMember = chat.participants.some((p) => p.equals(req.user._id));
  if (!isMember) return sendError(res, "Not authorised to send in this chat", 403);

  let message = await Message.create({
    sender: req.user._id,
    chat: chatId,
    content,
    status: "sent",
  });

  // Update chat's latest message
  await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

  message = await populateMessage(Message.findById(message._id));

  // Create notifications for other participants
  const recipients = chat.participants.filter((p) => !p.equals(req.user._id));
  const notifications = recipients.map((r) => ({
    recipient: r,
    sender: req.user._id,
    chat: chatId,
    message: message._id,
    type: "new_message",
  }));
  await Notification.insertMany(notifications);

  return sendSuccess(res, { message }, "Message sent", 201);
});

// ── GET /api/messages/:chatId ─────────────────────────────────────────────────
exports.getChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;

  const chat = await Chat.findById(chatId);
  if (!chat) return sendError(res, "Chat not found", 404);

  const isMember = chat.participants.some((p) => p.equals(req.user._id));
  if (!isMember) return sendError(res, "Not authorised to view this chat", 403);

  const options = {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: [
      { path: "sender", select: "fullName username profilePicture avatarInitial" },
      { path: "readBy.user", select: "fullName username" },
    ],
  };

  const result = await Message.paginate({ chat: chatId, isDeleted: false }, options);

  return sendSuccess(res, {
    messages: result.docs.reverse(),
    pagination: {
      total: result.totalDocs,
      page: result.page,
      pages: result.totalPages,
      hasMore: result.hasNextPage,
    },
  });
});

// ── PATCH /api/messages/:messageId/read ───────────────────────────────────────
exports.markAsRead = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) return sendError(res, "Message not found", 404);

  const alreadyRead = message.readBy.some((r) => r.user.equals(req.user._id));
  if (!alreadyRead) {
    message.readBy.push({ user: req.user._id, readAt: Date.now() });

    // Check if all participants have read it (for 1:1 chat)
    const chat = await Chat.findById(message.chat);
    const allRead = chat.participants
      .filter((p) => !p.equals(message.sender))
      .every((p) => message.readBy.some((r) => r.user.equals(p)));

    if (allRead) message.status = "read";
    await message.save();
  }

  const updated = await populateMessage(Message.findById(message._id));
  return sendSuccess(res, { message: updated });
});

// ── PATCH /api/messages/:messageId/delivered ──────────────────────────────────
exports.markAsDelivered = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) return sendError(res, "Message not found", 404);

  const alreadyDelivered = message.deliveredTo.some((d) => d.user.equals(req.user._id));
  if (!alreadyDelivered) {
    message.deliveredTo.push({ user: req.user._id, deliveredAt: Date.now() });
    if (message.status === "sent") message.status = "delivered";
    await message.save();
  }

  return sendSuccess(res, { message });
});

// ── DELETE /api/messages/:messageId ───────────────────────────────────────────
exports.deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) return sendError(res, "Message not found", 404);

  if (!message.sender.equals(req.user._id)) {
    return sendError(res, "You can only delete your own messages", 403);
  }

  // Soft delete
  message.isDeleted = true;
  message.deletedAt = Date.now();
  message.content = "This message was deleted";
  await message.save();

  return sendSuccess(res, { messageId: message._id }, "Message deleted");
});

// ── GET /api/messages/unread ──────────────────────────────────────────────────
exports.getUnreadCounts = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ participants: req.user._id }).select("_id");
  const chatIds = chats.map((c) => c._id);

  const counts = await Message.aggregate([
    {
      $match: {
        chat: { $in: chatIds },
        sender: { $ne: req.user._id },
        isDeleted: false,
        "readBy.user": { $ne: req.user._id },
      },
    },
    { $group: { _id: "$chat", count: { $sum: 1 } } },
  ]);

  const result = {};
  counts.forEach(({ _id, count }) => {
    result[_id.toString()] = count;
  });

  return sendSuccess(res, { unreadCounts: result });
});

// ── GET /api/messages/search?q=&chatId= ───────────────────────────────────────
exports.searchMessages = asyncHandler(async (req, res) => {
  const { q, chatId } = req.query;
  if (!q) return sendSuccess(res, { messages: [] });

  const filter = {
    isDeleted: false,
    content: { $regex: q, $options: "i" },
  };

  if (chatId) {
    filter.chat = chatId;
  } else {
    const chats = await Chat.find({ participants: req.user._id }).select("_id");
    filter.chat = { $in: chats.map((c) => c._id) };
  }

  const messages = await populateMessage(Message.find(filter).limit(50).sort({ createdAt: -1 }));

  return sendSuccess(res, { messages });
});
