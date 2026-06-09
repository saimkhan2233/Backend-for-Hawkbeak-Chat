const router = require("express").Router();
const {
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
  transferAdmin,
  deleteGroup,
} = require("../controllers/groupController");
const { protect } = require("../middleware/auth");
const { uploadGroupAvatar } = require("../config/cloudinary");

router.use(protect);

router.post("/", uploadGroupAvatar, createGroup);
router.put("/:id", uploadGroupAvatar, updateGroup);
router.post("/:id/members", addMembers);
router.delete("/:id/members/:memberId", removeMember);
router.post("/:id/leave", leaveGroup);
router.post("/:id/transfer-admin", transferAdmin);
router.delete("/:id", deleteGroup);

module.exports = router;
