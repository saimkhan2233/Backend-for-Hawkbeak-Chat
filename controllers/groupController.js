const Chat = require("../models/Chat");
const Message = require("../models/Message");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { deleteImage } = require("../config/cloudinary");

const populateGroup = (query) =>
  query
    .populate("participants", "fullName username profilePicture avatarInitial isOnline status")
    .populate("groupAdmin", "fullName username profilePicture avatarInitial");

// ── POST /api/groups ──────────────────────────────────────────────────────────
exports.createGroup = asyncHandler(async (req, res) => {
  const { chatName, participants, groupDescription } = req.body;

  if (!chatName) return sendError(res, "Group name is required", 400);

  let memberIds = [];
  try {
    memberIds = typeof participants === "string" ? JSON.parse(participants) : participants;
  } catch {
    return sendError(res, "Invalid participants format", 400);
  }

  if (!Array.isArray(memberIds) || memberIds.length < 2) {
    return sendError(res, "A group must have at least 2 other members", 400);
  }

  // Ensure creator is included
  const uniqueParticipants = [...new Set([...memberIds, req.user._id.toString()])];

  let groupAvatar = { url: "", publicId: "" };
  if (req.file) {
    groupAvatar = { url: req.file.path, publicId: req.file.filename };
  }

  let chat = await Chat.create({
    chatName,
    isGroupChat: true,
    participants: uniqueParticipants,
    groupAdmin: req.user._id,
    groupDescription: groupDescription || "",
    groupAvatar,
  });

  chat = await populateGroup(Chat.findById(chat._id));

  return sendSuccess(res, { chat }, "Group created", 201);
});

// ── PUT /api/groups/:id ───────────────────────────────────────────────────────
exports.updateGroup = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroupChat) return sendError(res, "Group not found", 404);
  if (!chat.groupAdmin.equals(req.user._id)) return sendError(res, "Only admin can update group", 403);

  const { chatName, groupDescription } = req.body;
  if (chatName) chat.chatName = chatName;
  if (groupDescription !== undefined) chat.groupDescription = groupDescription;

  if (req.file) {
    if (chat.groupAvatar?.publicId) await deleteImage(chat.groupAvatar.publicId);
    chat.groupAvatar = { url: req.file.path, publicId: req.file.filename };
  }

  await chat.save();
  const updated = await populateGroup(Chat.findById(chat._id));
  return sendSuccess(res, { chat: updated }, "Group updated");
});

// ── POST /api/groups/:id/members ──────────────────────────────────────────────
exports.addMembers = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroupChat) return sendError(res, "Group not found", 404);
  if (!chat.groupAdmin.equals(req.user._id)) return sendError(res, "Only admin can add members", 403);

  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return sendError(res, "userIds array is required", 400);
  }

  const newIds = userIds.filter((id) => !chat.participants.some((p) => p.equals(id)));
  chat.participants.push(...newIds);
  await chat.save();

  const updated = await populateGroup(Chat.findById(chat._id));
  return sendSuccess(res, { chat: updated }, "Members added");
});

// ── DELETE /api/groups/:id/members/:memberId ──────────────────────────────────
exports.removeMember = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroupChat) return sendError(res, "Group not found", 404);
  if (!chat.groupAdmin.equals(req.user._id)) return sendError(res, "Only admin can remove members", 403);
  if (req.params.memberId === req.user._id.toString()) {
    return sendError(res, "Admin cannot remove themselves — transfer admin first", 400);
  }

  chat.participants = chat.participants.filter((p) => !p.equals(req.params.memberId));
  await chat.save();

  const updated = await populateGroup(Chat.findById(chat._id));
  return sendSuccess(res, { chat: updated }, "Member removed");
});

// ── POST /api/groups/:id/leave ────────────────────────────────────────────────
exports.leaveGroup = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroupChat) return sendError(res, "Group not found", 404);

  const isMember = chat.participants.some((p) => p.equals(req.user._id));
  if (!isMember) return sendError(res, "You are not a member of this group", 400);

  if (chat.groupAdmin.equals(req.user._id)) {
    return sendError(res, "Transfer admin before leaving", 400);
  }

  chat.participants = chat.participants.filter((p) => !p.equals(req.user._id));
  await chat.save();

  return sendSuccess(res, {}, "Left group successfully");
});

// ── POST /api/groups/:id/transfer-admin ───────────────────────────────────────
exports.transferAdmin = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroupChat) return sendError(res, "Group not found", 404);
  if (!chat.groupAdmin.equals(req.user._id)) return sendError(res, "Only admin can transfer admin", 403);

  const { newAdminId } = req.body;
  const isMember = chat.participants.some((p) => p.equals(newAdminId));
  if (!isMember) return sendError(res, "New admin must be a group member", 400);

  chat.groupAdmin = newAdminId;
  await chat.save();

  const updated = await populateGroup(Chat.findById(chat._id));
  return sendSuccess(res, { chat: updated }, "Admin transferred");
});

// ── DELETE /api/groups/:id (admin only) ───────────────────────────────────────
exports.deleteGroup = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat || !chat.isGroupChat) return sendError(res, "Group not found", 404);
  if (!chat.groupAdmin.equals(req.user._id)) return sendError(res, "Only admin can delete group", 403);

  if (chat.groupAvatar?.publicId) await deleteImage(chat.groupAvatar.publicId);

  await Message.deleteMany({ chat: chat._id });
  await chat.deleteOne();

  return sendSuccess(res, {}, "Group deleted");
});
