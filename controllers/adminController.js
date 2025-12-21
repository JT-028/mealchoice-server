import crypto from "crypto";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { sendSellerWelcomeEmail } from "../utils/sendEmail.js";

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSellers = await User.countDocuments({ role: "seller" });
    const pendingSellers = await User.countDocuments({ role: "seller", isVerified: false });
    const verifiedSellers = await User.countDocuments({ role: "seller", isVerified: true });
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();

    // Revenue
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ["completed", "ready"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    // Sellers by market
    const sanNicolasSellers = await User.countDocuments({
      role: "seller",
      marketLocation: "San Nicolas Market",
      isVerified: true
    });
    const pampangaSellers = await User.countDocuments({
      role: "seller",
      marketLocation: "Pampanga Market",
      isVerified: true
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        pendingSellers,
        verifiedSellers,
        totalCustomers,
        totalOrders,
        totalProducts,
        totalRevenue,
        sellersByMarket: {
          sanNicolas: sanNicolasSellers,
          pampanga: pampangaSellers
        }
      }
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching stats"
    });
  }
};

// @desc    Get pending sellers awaiting verification
// @route   GET /api/admin/sellers/pending
// @access  Private (Admin)
export const getPendingSellers = async (req, res) => {
  try {
    const sellers = await User.find({ role: "seller", isVerified: false })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: sellers.length,
      sellers
    });
  } catch (error) {
    console.error("Get pending sellers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get pending customers (unverified email)
// @route   GET /api/admin/customers/pending
// @access  Private (Admin)
export const getPendingCustomers = async (req, res) => {
  try {
    const customers = await User.find({ 
      role: "customer", 
      isEmailVerified: false 
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    console.error("Get pending customers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Approve customer (verify email manually)
// @route   PUT /api/admin/customers/:id/approve
// @access  Private (Admin)
export const approveCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "User is not a customer"
      });
    }

    customer.isEmailVerified = true;
    customer.emailVerificationToken = null;
    customer.emailVerificationExpires = null;
    await customer.save();

    res.json({
      success: true,
      message: "Customer email verified successfully"
    });
  } catch (error) {
    console.error("Approve customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Reject pending customer
// @route   DELETE /api/admin/customers/:id/reject
// @access  Private (Admin)
export const rejectCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.role !== "customer" || customer.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Can only reject pending customers"
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Customer registration rejected"
    });
  } catch (error) {
    console.error("Reject customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get all sellers
// @route   GET /api/admin/sellers
// @access  Private (Admin)
export const getAllSellers = async (req, res) => {
  try {
    const { verified, market, active } = req.query;

    const query = { role: "seller" };

    if (verified === "true") query.isVerified = true;
    if (verified === "false") query.isVerified = false;
    if (market) query.marketLocation = market;
    if (active === "true") query.isActive = true;
    if (active === "false") query.isActive = false;

    const sellers = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: sellers.length,
      sellers
    });
  } catch (error) {
    console.error("Get all sellers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Verify seller and assign market location
// @route   PUT /api/admin/sellers/:id/verify
// @access  Private (Admin)
export const verifySeller = async (req, res) => {
  try {
    const { marketLocation } = req.body;

    if (!marketLocation) {
      return res.status(400).json({
        success: false,
        message: "Market location is required"
      });
    }

    const validMarkets = ["San Nicolas Market", "Pampanga Market"];
    if (!validMarkets.includes(marketLocation)) {
      return res.status(400).json({
        success: false,
        message: "Invalid market location"
      });
    }

    const seller = await User.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    if (seller.role !== "seller") {
      return res.status(400).json({
        success: false,
        message: "User is not a seller"
      });
    }

    seller.isVerified = true;
    seller.verifiedAt = new Date();
    seller.verifiedBy = req.user._id;
    seller.marketLocation = marketLocation;

    await seller.save();

    res.json({
      success: true,
      message: "Seller verified successfully",
      seller
    });
  } catch (error) {
    console.error("Verify seller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Update seller information
// @route   PUT /api/admin/sellers/:id
// @access  Private (Admin)
export const updateSeller = async (req, res) => {
  try {
    const { name, email, marketLocation, stallName, stallNumber, isActive, isVerified } = req.body;

    const seller = await User.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    if (seller.role !== "seller") {
      return res.status(400).json({
        success: false,
        message: "User is not a seller"
      });
    }

    if (name) seller.name = name;
    if (email) seller.email = email;
    if (marketLocation) seller.marketLocation = marketLocation;
    if (stallName !== undefined) seller.stallName = stallName;
    if (stallNumber !== undefined) seller.stallNumber = stallNumber;
    if (typeof isActive === "boolean") seller.isActive = isActive;
    if (typeof isVerified === "boolean") {
      seller.isVerified = isVerified;
      if (isVerified && !seller.verifiedAt) {
        seller.verifiedAt = new Date();
        seller.verifiedBy = req.user._id;
      }
    }

    await seller.save();

    res.json({
      success: true,
      message: "Seller updated successfully",
      seller
    });
  } catch (error) {
    console.error("Update seller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Delete seller account
// @route   DELETE /api/admin/sellers/:id
// @access  Private (Admin)
export const deleteSeller = async (req, res) => {
  try {
    const seller = await User.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    if (seller.role !== "seller") {
      return res.status(400).json({
        success: false,
        message: "User is not a seller"
      });
    }

    // Cancel all pending/active orders for this seller
    const ordersToCancel = await Order.find({
      seller: seller._id,
      status: { $in: ["pending", "confirmed", "preparing", "ready"] }
    });

    for (const order of ordersToCancel) {
      order.status = "cancelled";
      order.statusHistory.push({
        status: "cancelled",
        timestamp: new Date(),
        note: "Order cancelled - seller account was removed"
      });
      await order.save();
    }

    // Also delete seller's products
    await Product.deleteMany({ seller: seller._id });

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Seller deleted. ${ordersToCancel.length} active order(s) were cancelled.`
    });
  } catch (error) {
    console.error("Delete seller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Reject pending seller
// @route   DELETE /api/admin/sellers/:id/reject
// @access  Private (Admin)
export const rejectSeller = async (req, res) => {
  try {
    const seller = await User.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    if (seller.role !== "seller" || seller.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Can only reject pending sellers"
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Seller registration rejected"
    });
  } catch (error) {
    console.error("Reject seller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Create new seller account (admin)
// @route   POST /api/admin/sellers
// @access  Private (Admin)
export const createSeller = async (req, res) => {
  try {
    const { name, email, marketLocation, stallName, stallNumber } = req.body;

    // Validation
    if (!name || !email || !marketLocation) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and market location are required"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Generate temporary password (8 chars)
    const tempPassword = crypto.randomBytes(4).toString("hex");

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create seller account
    const seller = await User.create({
      name,
      email,
      password: tempPassword,
      role: "seller",
      marketLocation,
      stallName: stallName || null,
      stallNumber: stallNumber || null,
      isVerified: false,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      mustChangePassword: true
    });

    // Send welcome email
    try {
      await sendSellerWelcomeEmail({
        to: email,
        name,
        tempPassword,
        verificationToken
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the request, seller is created
    }

    res.status(201).json({
      success: true,
      message: "Seller account created. Verification email sent.",
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        marketLocation: seller.marketLocation,
        stallName: seller.stallName,
        stallNumber: seller.stallNumber,
        isVerified: seller.isVerified
      }
    });
  } catch (error) {
    console.error("Create seller error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error creating seller"
    });
  }
};

// @desc    Deactivate seller account
// @route   PUT /api/admin/sellers/:id/deactivate
// @access  Private (Admin)
export const deactivateSeller = async (req, res) => {
  try {
    const seller = await User.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    if (seller.role !== "seller") {
      return res.status(400).json({
        success: false,
        message: "User is not a seller"
      });
    }

    if (!seller.isActive) {
      return res.status(400).json({
        success: false,
        message: "Seller is already deactivated"
      });
    }

    seller.isActive = false;
    seller.deactivatedAt = new Date();
    seller.deactivatedBy = req.user._id;
    await seller.save();

    // Send deactivation email
    try {
      const { sendSellerDeactivationEmail } = await import("../utils/sendEmail.js");
      await sendSellerDeactivationEmail({
        to: seller.email,
        name: seller.name,
        adminEmail: process.env.SMTP_EMAIL || "admin@mealwise.com"
      });
    } catch (emailError) {
      console.error("Failed to send deactivation email:", emailError);
    }

    res.json({
      success: true,
      message: "Seller account deactivated successfully"
    });
  } catch (error) {
    console.error("Deactivate seller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deactivating seller"
    });
  }
};

// @desc    Activate seller account
// @route   PUT /api/admin/sellers/:id/activate
// @access  Private (Admin)
export const activateSeller = async (req, res) => {
  try {
    const seller = await User.findById(req.params.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    if (seller.role !== "seller") {
      return res.status(400).json({
        success: false,
        message: "User is not a seller"
      });
    }

    if (seller.isActive) {
      return res.status(400).json({
        success: false,
        message: "Seller is already active"
      });
    }

    seller.isActive = true;
    seller.deactivatedAt = null;
    seller.deactivatedBy = null;
    await seller.save();

    res.json({
      success: true,
      message: "Seller account activated successfully"
    });
  } catch (error) {
    console.error("Activate seller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error activating seller"
    });
  }
};

// @desc    Get all admin accounts
// @route   GET /api/admin/admins
// @access  Private (Admin)
export const getAdmins = async (req, res) => {
  try {
    // Auto-fix: Ensure admin@mealwise.com is marked as main admin
    const mainAdminEmail = "admin@mealwise.com";
    await User.updateOne(
      { email: mainAdminEmail, role: "admin", isMainAdmin: { $ne: true } },
      { isMainAdmin: true }
    );

    const admins = await User.find({ role: "admin" })
      .select("name email isMainAdmin isActive createdAt")
      .sort({ isMainAdmin: -1, createdAt: 1 });

    // Also check by email in case DB flag not set yet
    const enrichedAdmins = admins.map(admin => ({
      ...admin.toObject(),
      isMainAdmin: admin.email === mainAdminEmail || admin.isMainAdmin
    }));

    res.json({
      success: true,
      admins: enrichedAdmins,
      count: admins.length
    });
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching admins"
    });
  }
};

// @desc    Create sub-admin account
// @route   POST /api/admin/admins
// @access  Private (Admin - Main admin only)
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password"
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Create sub-admin
    const admin = await User.create({
      name,
      email,
      password,
      role: "admin",
      isMainAdmin: false,
      isVerified: true,
      isEmailVerified: true,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Sub-admin account created successfully",
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        isMainAdmin: admin.isMainAdmin
      }
    });
  } catch (error) {
    console.error("Create admin error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error creating admin"
    });
  }
};

// @desc    Delete sub-admin account
// @route   DELETE /api/admin/admins/:id
// @access  Private (Admin)
export const deleteAdmin = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    if (admin.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "User is not an admin"
      });
    }

    // Prevent deleting main admin (by flag or by email)
    const mainAdminEmail = "admin@mealwise.com";
    if (admin.isMainAdmin || admin.email === mainAdminEmail) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete the main admin account"
      });
    }

    // Prevent self-deletion
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete your own account"
      });
    }

    await admin.deleteOne();

    res.json({
      success: true,
      message: "Sub-admin account deleted successfully"
    });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting admin"
    });
  }
};

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

// @desc    Get all customers
// @route   GET /api/admin/customers
// @access  Private (Admin)
export const getAllCustomers = async (req, res) => {
  try {
    const { active, search } = req.query;

    const query = { role: "customer" };

    if (active === "true") query.isActive = true;
    if (active === "false") query.isActive = false;

    let customers = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(
        c => c.name.toLowerCase().includes(searchLower) ||
            c.email.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    console.error("Get all customers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Update customer information
// @route   PUT /api/admin/customers/:id
// @access  Private (Admin)
export const updateCustomer = async (req, res) => {
  try {
    const { name, email, isActive } = req.body;

    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "User is not a customer"
      });
    }

    if (name) customer.name = name;
    if (email) customer.email = email;
    if (typeof isActive === "boolean") customer.isActive = isActive;

    await customer.save();

    res.json({
      success: true,
      message: "Customer updated successfully",
      customer
    });
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Delete customer account
// @route   DELETE /api/admin/customers/:id
// @access  Private (Admin)
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "User is not a customer"
      });
    }

    // Cancel all pending/active orders for this customer
    const ordersToCancel = await Order.find({
      customer: customer._id,
      status: { $in: ["pending", "confirmed", "preparing", "ready"] }
    });

    for (const order of ordersToCancel) {
      order.status = "cancelled";
      order.statusHistory.push({
        status: "cancelled",
        timestamp: new Date(),
        note: "Order cancelled - customer account was removed"
      });
      await order.save();
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Customer deleted. ${ordersToCancel.length} active order(s) were cancelled.`
    });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Deactivate customer account
// @route   PUT /api/admin/customers/:id/deactivate
// @access  Private (Admin)
export const deactivateCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "User is not a customer"
      });
    }

    if (!customer.isActive) {
      return res.status(400).json({
        success: false,
        message: "Customer is already deactivated"
      });
    }

    customer.isActive = false;
    customer.deactivatedAt = new Date();
    customer.deactivatedBy = req.user._id;
    await customer.save();

    res.json({
      success: true,
      message: "Customer account deactivated successfully"
    });
  } catch (error) {
    console.error("Deactivate customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deactivating customer"
    });
  }
};

// @desc    Activate customer account
// @route   PUT /api/admin/customers/:id/activate
// @access  Private (Admin)
export const activateCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "User is not a customer"
      });
    }

    if (customer.isActive) {
      return res.status(400).json({
        success: false,
        message: "Customer is already active"
      });
    }

    customer.isActive = true;
    customer.deactivatedAt = null;
    customer.deactivatedBy = null;
    await customer.save();

    res.json({
      success: true,
      message: "Customer account activated successfully"
    });
  } catch (error) {
    console.error("Activate customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error activating customer"
    });
  }
};
