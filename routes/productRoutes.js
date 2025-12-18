import express from "express";
import {
  createProduct,
  getSellerProducts,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllProducts);
router.get("/:id", getProduct);

// Protected routes (Seller only)
router.get("/seller/my-products", protect, authorize("seller"), getSellerProducts);
router.post("/", protect, authorize("seller"), createProduct);
router.put("/:id", protect, authorize("seller"), updateProduct);
router.delete("/:id", protect, authorize("seller"), deleteProduct);

export default router;
