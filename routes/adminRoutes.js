import express from "express";
import {
  getStats,
  getPendingSellers,
  getAllSellers,
  verifySeller,
  updateSeller,
  deleteSeller,
  rejectSeller,
  createSeller,
  deactivateSeller,
  activateSeller,
  getAdmins,
  createAdmin,
  deleteAdmin
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
router.post("/sellers", createSeller);
router.put("/sellers/:id/verify", verifySeller);
router.put("/sellers/:id/deactivate", deactivateSeller);
router.put("/sellers/:id/activate", activateSeller);
router.put("/sellers/:id", updateSeller);
router.delete("/sellers/:id/reject", rejectSeller);
router.delete("/sellers/:id", deleteSeller);

// Admin management
router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.delete("/admins/:id", deleteAdmin);

export default router;
