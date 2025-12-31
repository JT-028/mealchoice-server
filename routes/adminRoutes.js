import express from "express";
import {
  getStats,
  getPendingSellers,
  getPendingCustomers,
  approveCustomer,
  rejectCustomer,
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
  updateAdmin,
  deleteAdmin,
  getAllCustomers,
  updateCustomer,
  deleteCustomer,
  deactivateCustomer,
  activateCustomer
} from "../controllers/adminController.js";
import {
  exportAdminJSON,
  exportAdminCSV,
  importAdminJSON
} from "../controllers/backupController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require admin role
router.use(protect, authorize("admin"));

// Dashboard
router.get("/stats", getStats);

// Backup & Restore (full database)
router.get("/backup/json", exportAdminJSON);
router.get("/backup/csv", exportAdminCSV);
router.post("/restore", importAdminJSON);

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

// Customer management
router.get("/customers/pending", getPendingCustomers);
router.get("/customers", getAllCustomers);
router.put("/customers/:id/approve", approveCustomer);
router.put("/customers/:id/deactivate", deactivateCustomer);
router.put("/customers/:id/activate", activateCustomer);
router.put("/customers/:id", updateCustomer);
router.delete("/customers/:id/reject", rejectCustomer);
router.delete("/customers/:id", deleteCustomer);

// Admin management
router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);

export default router;


