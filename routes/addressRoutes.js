import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getSavedAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from "../controllers/addressController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route("/")
  .get(getSavedAddresses)
  .post(addAddress);

router.route("/:id")
  .put(updateAddress)
  .delete(deleteAddress);

router.put("/:id/default", setDefaultAddress);

export default router;
