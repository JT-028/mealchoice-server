import express from "express";
import {
  getStats,
  getPendingSellers,
  getAllSellers,
  verifySeller,
  updateSeller,
  deleteSeller,
  rejectSeller
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require admin role
router.use(protect, authorize("admin"));

// Dashboard
router.get("/stats", getStats);

// Seller management
router.get("/sellers/pending", getPendingSellers);
router.get("/sellers", getAllSellers);
router.put("/sellers/:id/verify", verifySeller);
router.put("/sellers/:id", updateSeller);
router.delete("/sellers/:id/reject", rejectSeller);
router.delete("/sellers/:id", deleteSeller);

export default router;
