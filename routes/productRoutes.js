import express from "express";
import {
  createProduct,
  getSellerProducts,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadImage
} from "../controllers/productController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { uploadProductImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllProducts);
router.get("/:id", getProduct);

// Protected routes (Seller only)
router.get("/seller/my-products", protect, authorize("seller"), getSellerProducts);
router.post("/", protect, authorize("seller"), createProduct);
router.put("/:id", protect, authorize("seller"), updateProduct);
router.delete("/:id", protect, authorize("seller"), deleteProduct);

// Image upload route
router.post(
  "/:id/image",
  protect,
  authorize("seller"),
  uploadProductImage.single("image"),
  uploadImage
);

export default router;

