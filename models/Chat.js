const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupDescription: {
      type: String,
      default: "",
      maxlength: [300, "Group description cannot exceed 300 characters"],
    },
    groupAvatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
