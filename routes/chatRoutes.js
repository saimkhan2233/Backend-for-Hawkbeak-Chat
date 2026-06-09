const router = require("express").Router();
const {
  accessOrCreateChat,
  getUserChats,
  getChatById,
  deleteChat,
} = require("../controllers/chatController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/", accessOrCreateChat);
router.get("/", getUserChats);
router.get("/:id", getChatById);
router.delete("/:id", deleteChat);

module.exports = router;
