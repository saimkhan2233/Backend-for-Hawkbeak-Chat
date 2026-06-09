const Chat = require("../models/Chat");
const User = require("../models/User");
const Message = require("../models/Message");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const populateChat = (query) =>
  query
    .populate("participants", "fullName username profilePicture avatarInitial isOnline lastSeen status")
    .populate("groupAdmin", "fullName username profilePicture avatarInitial")
    .populate({
      path: "latestMessage",
      populate: { path: "sender", select: "fullName username profilePicture avatarInitial" },
    });

// ── POST /api/chats  (access or create 1:1 chat) ──────────────────────────────
exports.accessOrCreateChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) return sendError(res, "userId is required", 400);
  if (userId === req.user._id.toString()) return sendError(res, "Cannot chat with yourself", 400);

  const targetUser = await User.findById(userId);
  if (!targetUser) return sendError(res, "User not found", 404);

  let chat = await populateChat(
    Chat.findOne({
      isGroupChat: false,
      participants: { $all: [req.user._id, userId] },
    })
  );

  if (chat) return sendSuccess(res, { chat });

  chat = await Chat.create({
    isGroupChat: false,
    participants: [req.user._id, userId],
  });

  chat = await populateChat(Chat.findById(chat._id));

  return sendSuccess(res, { chat }, "Chat created", 201);
});

// ── GET /api/chats ────────────────────────────────────────────────────────────
exports.getUserChats = asyncHandler(async (req, res) => {
  const chats = await populateChat(
    Chat.find({ participants: req.user._id })
  ).sort({ updatedAt: -1 });

  return sendSuccess(res, { chats });
});

// ── GET /api/chats/:id ────────────────────────────────────────────────────────
exports.getChatById = asyncHandler(async (req, res) => {
  const chat = await populateChat(Chat.findById(req.params.id));

  if (!chat) return sendError(res, "Chat not found", 404);

  const isMember = chat.participants.some((p) => p._id.equals(req.user._id));
  if (!isMember) return sendError(res, "Not authorised to view this chat", 403);

  return sendSuccess(res, { chat });
});

// ── DELETE /api/chats/:id ─────────────────────────────────────────────────────
exports.deleteChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat) return sendError(res, "Chat not found", 404);

  const isMember = chat.participants.some((p) => p.equals(req.user._id));
  if (!isMember) return sendError(res, "Not authorised", 403);

  await Message.deleteMany({ chat: chat._id });
  await chat.deleteOne();

  return sendSuccess(res, {}, "Chat deleted");
});
