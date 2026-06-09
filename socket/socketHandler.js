const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");

/**
 * Maps userId (string) → Set of socketIds
 * Allows multiple device/tab connections per user.
 */
const onlineUsers = new Map();

const addOnlineUser = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

const removeOnlineUser = (userId, socketId) => {
  if (!onlineUsers.has(userId)) return;
  onlineUsers.get(userId).delete(socketId);
  if (onlineUsers.get(userId).size === 0) onlineUsers.delete(userId);
};

const isUserOnline = (userId) => onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;

const getSocketIds = (userId) =>
  onlineUsers.has(userId) ? [...onlineUsers.get(userId)] : [];

// ─────────────────────────────────────────────────────────────────────────────

const initSocket = (io) => {
  // ── Auth middleware ──────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication error: no token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return next(new Error("Authentication error: user not found"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: " + err.message));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🟢 Socket connected: ${socket.user.username} (${socket.id})`);

    // ── Register online presence ─────────────────────────────────────────────
    addOnlineUser(userId, socket.id);

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      socketId: socket.id,
      lastSeen: Date.now(),
    });

    // Broadcast online status to everyone
    socket.broadcast.emit("userOnline", { userId, isOnline: true });

    // Send the current online users list to newly connected client
    const onlineUserIds = [...onlineUsers.keys()];
    socket.emit("onlineUsers", { users: onlineUserIds });

    // ── Join personal room ───────────────────────────────────────────────────
    socket.join(userId);

    // ── Join all existing chat rooms ─────────────────────────────────────────
    const userChats = await Chat.find({ participants: userId }).select("_id");
    userChats.forEach((chat) => socket.join(chat._id.toString()));

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: joinChat
    // Client joins a specific chat room
    // Payload: { chatId }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("joinChat", async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) return;
        const isMember = chat.participants.some((p) => p.equals(userId));
        if (!isMember) return;
        socket.join(chatId);
        socket.emit("joinedChat", { chatId });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: leaveChat
    // Client leaves a specific chat room
    // Payload: { chatId }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("leaveChat", ({ chatId }) => {
      socket.leave(chatId);
      socket.emit("leftChat", { chatId });
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: sendMessage
    // Client sends a message (real-time delivery on top of REST)
    // Payload: { chatId, content }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("sendMessage", async ({ chatId, content }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) return socket.emit("error", { message: "Chat not found" });

        const isMember = chat.participants.some((p) => p.equals(userId));
        if (!isMember) return socket.emit("error", { message: "Not a member" });

        // Create message in DB
        let message = await Message.create({
          sender: userId,
          chat: chatId,
          content,
          status: "sent",
        });

        await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

        message = await Message.findById(message._id)
          .populate("sender", "fullName username profilePicture avatarInitial")
          .populate("chat");

        // Emit to all room members (including sender for multi-device)
        io.to(chatId).emit("newMessage", { message });

        // Mark delivered for online participants (excluding sender)
        const onlineRecipients = chat.participants.filter(
          (p) => !p.equals(userId) && isUserOnline(p.toString())
        );

        if (onlineRecipients.length > 0) {
          const deliveredEntries = onlineRecipients.map((r) => ({
            user: r,
            deliveredAt: Date.now(),
          }));

          await Message.findByIdAndUpdate(message._id, {
            $push: { deliveredTo: { $each: deliveredEntries } },
            status: "delivered",
          });

          io.to(chatId).emit("messageDelivered", {
            messageId: message._id,
            chatId,
            deliveredTo: onlineRecipients.map((r) => r.toString()),
          });
        }

        // Notify offline participants via personal room
        const offlineRecipients = chat.participants.filter(
          (p) => !p.equals(userId) && !isUserOnline(p.toString())
        );
        offlineRecipients.forEach((recipientId) => {
          io.to(recipientId.toString()).emit("notification", {
            type: "new_message",
            chatId,
            message,
          });
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: typing
    // Payload: { chatId }
    // Server broadcasts: userTyping → { chatId, userId, username }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("typing", ({ chatId }) => {
      socket.to(chatId).emit("userTyping", {
        chatId,
        userId,
        username: socket.user.username,
        fullName: socket.user.fullName,
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: stopTyping
    // Payload: { chatId }
    // Server broadcasts: userStoppedTyping → { chatId, userId }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("stopTyping", ({ chatId }) => {
      socket.to(chatId).emit("userStoppedTyping", { chatId, userId });
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: markRead
    // Client marks messages in a chat as read
    // Payload: { chatId, messageIds }
    // Server broadcasts: messagesRead → { chatId, userId, messageIds }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("markRead", async ({ chatId, messageIds }) => {
      try {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return;

        const now = Date.now();

        await Message.updateMany(
          {
            _id: { $in: messageIds },
            chat: chatId,
            "readBy.user": { $ne: userId },
          },
          {
            $push: { readBy: { user: userId, readAt: now } },
            $set: { status: "read" },
          }
        );

        // Broadcast to all room members
        io.to(chatId).emit("messagesRead", {
          chatId,
          userId,
          messageIds,
          readAt: now,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: markDelivered
    // Client acknowledges delivery of messages
    // Payload: { chatId, messageIds }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("markDelivered", async ({ chatId, messageIds }) => {
      try {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return;

        const now = Date.now();

        await Message.updateMany(
          {
            _id: { $in: messageIds },
            chat: chatId,
            "deliveredTo.user": { $ne: userId },
          },
          {
            $push: { deliveredTo: { user: userId, deliveredAt: now } },
          }
        );

        // Notify sender(s) about delivery
        io.to(chatId).emit("messagesDelivered", {
          chatId,
          userId,
          messageIds,
          deliveredAt: now,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: updateStatus
    // User changes their availability status
    // Payload: { status } — "Available" | "Busy" | "Away"
    // ────────────────────────────────────────────────────────────────────────
    socket.on("updateStatus", async ({ status }) => {
      try {
        const validStatuses = ["Available", "Busy", "Away"];
        if (!validStatuses.includes(status)) return;

        await User.findByIdAndUpdate(userId, { status });
        socket.broadcast.emit("userStatusChanged", { userId, status });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // EVENT: groupAction
    // Relay group-level events (member added/removed, admin change)
    // Payload: { chatId, action, data }
    // ────────────────────────────────────────────────────────────────────────
    socket.on("groupAction", ({ chatId, action, data }) => {
      socket.to(chatId).emit("groupUpdated", { chatId, action, data });
    });

    // ────────────────────────────────────────────────────────────────────────
    // DISCONNECT
    // ────────────────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`🔴 Socket disconnected: ${socket.user.username} (${socket.id})`);

      removeOnlineUser(userId, socket.id);

      // Only mark offline if no remaining connections for this user
      if (!isUserOnline(userId)) {
        const lastSeen = Date.now();
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
          socketId: null,
        });

        socket.broadcast.emit("userOffline", { userId, lastSeen });
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // ERROR handler
    // ────────────────────────────────────────────────────────────────────────
    socket.on("error", (err) => {
      console.error(`Socket error for ${socket.user?.username}:`, err.message);
    });
  });
};

module.exports = { initSocket, onlineUsers, isUserOnline, getSocketIds };
