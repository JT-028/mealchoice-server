import express from "express";
import {
  getSettings,
  updateProfile,
  changePassword,
  updateTheme,
  deleteAccount,
  exportOrders,
  updateSellerSettings,
  uploadPaymentQR,
  deletePaymentQR
} from "../controllers/settingsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { uploadQRImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// Common settings routes
router.get("/", getSettings);
router.put("/profile", updateProfile);
router.put("/password", changePassword);
router.put("/theme", updateTheme);
router.delete("/account", deleteAccount);
router.get("/export-orders", exportOrders);

// Seller-only routes
router.put("/seller", authorize("seller"), updateSellerSettings);
router.post("/payment-qr", authorize("seller"), uploadQRImage.single("qr"), uploadPaymentQR);
router.delete("/payment-qr", authorize("seller"), deletePaymentQR);

export default router;
