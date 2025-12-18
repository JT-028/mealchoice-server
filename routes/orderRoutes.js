import express from "express";
import {
  createOrder,
  getMyOrders,
  getSellerOrders,
  updateOrderStatus,
  getOrder,
  verifyPayment
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { uploadReceiptImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Customer routes
// Use .any() to allow dynamic field names for multiple seller receipts
router.post("/", protect, authorize("customer"), uploadReceiptImage.any(), createOrder);
router.get("/my-orders", protect, getMyOrders);

// Seller routes
router.get("/seller", protect, authorize("seller"), getSellerOrders);
router.put("/:id/status", protect, authorize("seller"), updateOrderStatus);
router.put("/:id/payment", protect, authorize("seller"), verifyPayment);

// Shared route
router.get("/:id", protect, getOrder);

export default router;
