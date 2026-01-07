import express from "express";
import {
  createOrder,
  getMyOrders,
  getSellerOrders,
  updateOrderStatus,
  getOrder,
  verifyPayment,
  archiveOrder,
  bulkArchiveOrders,
  getSellerAnalytics,
  cancelOrderByCustomer,
  hideOrderForBuyer,
  bulkHideOrdersForBuyer
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { uploadReceiptImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Customer routes
// Use .any() to allow dynamic field names for multiple seller receipts
router.post("/", protect, authorize("customer"), uploadReceiptImage.any(), createOrder);
router.get("/my-orders", protect, getMyOrders);
router.put("/bulk-hide-buyer", protect, authorize("customer"), bulkHideOrdersForBuyer);
router.put("/:id/cancel-customer", protect, authorize("customer"), cancelOrderByCustomer);
router.put("/:id/hide-buyer", protect, authorize("customer"), hideOrderForBuyer);

// Seller routes
router.get("/seller", protect, authorize("seller"), getSellerOrders);
router.get("/seller/analytics", protect, authorize("seller"), getSellerAnalytics);
router.put("/bulk-archive", protect, authorize("seller"), bulkArchiveOrders);
router.put("/:id/status", protect, authorize("seller"), updateOrderStatus);
router.put("/:id/payment", protect, authorize("seller"), verifyPayment);
router.put("/:id/archive", protect, authorize("seller"), archiveOrder);

// Shared route
router.get("/:id", protect, getOrder);

export default router;
