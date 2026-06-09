const router = require("express").Router();
const {
  getAllUsers,
  searchUsers,
  getUserById,
  updateProfile,
  changePassword,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { changePasswordValidation } = require("../validations/authValidations");
const { uploadProfilePicture } = require("../config/cloudinary");

router.use(protect); // All user routes are protected

router.get("/", getAllUsers);
router.get("/search", searchUsers);
router.get("/:id", getUserById);
router.put("/profile", uploadProfilePicture, updateProfile);
router.put("/password", changePasswordValidation, validate, changePassword);

module.exports = router;
