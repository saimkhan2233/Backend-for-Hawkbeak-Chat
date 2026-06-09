const router = require("express").Router();
const {
  sendMessage,
  getChatMessages,
  markAsRead,
  markAsDelivered,
  deleteMessage,
  getUnreadCounts,
  searchMessages,
} = require("../controllers/messageController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { sendMessageValidation } = require("../validations/messageValidations");

router.use(protect);

router.post("/", sendMessageValidation, validate, sendMessage);
router.get("/unread", getUnreadCounts);
router.get("/search", searchMessages);
router.get("/:chatId", getChatMessages);
router.patch("/:messageId/read", markAsRead);
router.patch("/:messageId/delivered", markAsDelivered);
router.delete("/:messageId", deleteMessage);

module.exports = router;
