import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

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
    const { name, email, marketLocation, isActive, isVerified } = req.body;

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

    // Also delete seller's products
    await Product.deleteMany({ seller: seller._id });

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Seller and their products deleted successfully"
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
