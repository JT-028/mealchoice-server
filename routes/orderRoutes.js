import express from "express";
import {
  createOrder,
  getMyOrders,
  getSellerOrders,
  updateOrderStatus,
  getOrder
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer routes
router.post("/", protect, authorize("customer"), createOrder);
router.get("/my-orders", protect, getMyOrders);

// Seller routes
router.get("/seller", protect, authorize("seller"), getSellerOrders);
router.put("/:id/status", protect, authorize("seller"), updateOrderStatus);

// Shared route
router.get("/:id", protect, getOrder);

export default router;
