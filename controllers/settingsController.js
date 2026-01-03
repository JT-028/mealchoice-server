import User from "../models/User.js";
import Order from "../models/Order.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Jimp } from "jimp";
import jsQR from "jsqr";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Update user profile (name, phone)
// @route   PUT /api/settings/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server error updating profile" });
  }
};

// @desc    Change password
// @route   PUT /api/settings/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters"
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Server error changing password" });
  }
};

// @desc    Update theme preference
// @route   PUT /api/settings/theme
// @access  Private
export const updateTheme = async (req, res) => {
  try {
    const { theme } = req.body;

    if (!["light", "dark", "system"].includes(theme)) {
      return res.status(400).json({ success: false, message: "Invalid theme" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { theme },
      { new: true }
    );

    res.json({
      success: true,
      message: "Theme updated",
      theme: user.theme
    });
  } catch (error) {
    console.error("Update theme error:", error);
    res.status(500).json({ success: false, message: "Server error updating theme" });
  }
};

// @desc    Delete account
// @route   DELETE /api/settings/account
// @access  Private
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to delete account"
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Password is incorrect"
      });
    }

    // Delete user's payment QR if exists
    if (user.paymentQR) {
      const qrPath = path.join(__dirname, "..", user.paymentQR);
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
    }

    await user.deleteOne();

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ success: false, message: "Server error deleting account" });
  }
};

// @desc    Export order history
// @route   GET /api/settings/export-orders
// @access  Private
export const exportOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate("seller", "name")
      .sort({ createdAt: -1 });

    // Create CSV content
    const headers = ["Order ID", "Date", "Seller", "Items", "Total", "Status"];
    const rows = orders.map(order => [
      order._id,
      new Date(order.createdAt).toLocaleDateString(),
      order.seller?.name || "Unknown",
      order.items.map(i => `${i.name} x${i.quantity}`).join("; "),
      order.total.toFixed(2),
      order.status
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=order-history.csv");
    res.send(csv);
  } catch (error) {
    console.error("Export orders error:", error);
    res.status(500).json({ success: false, message: "Server error exporting orders" });
  }
};

// @desc    Update seller settings (operating hours, notifications)
// @route   PUT /api/settings/seller
// @access  Private (Seller only)
export const updateSellerSettings = async (req, res) => {
  try {
    const { operatingHours, notifyNewOrders, notifyLowStock, acceptsQR, hasOwnDelivery } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (operatingHours) {
      // Merge incoming hours with existing ones
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        if (operatingHours[day]) {
          if (!user.operatingHours) user.operatingHours = {};
          if (!user.operatingHours[day]) user.operatingHours[day] = {};
          if (operatingHours[day].open !== undefined) user.operatingHours[day].open = operatingHours[day].open;
          if (operatingHours[day].close !== undefined) user.operatingHours[day].close = operatingHours[day].close;
          if (operatingHours[day].isClosed !== undefined) user.operatingHours[day].isClosed = operatingHours[day].isClosed;
        }
      });
      user.markModified('operatingHours');
    }

    if (notifyNewOrders !== undefined) user.notifyNewOrders = notifyNewOrders;
    if (notifyLowStock !== undefined) user.notifyLowStock = notifyLowStock;
    if (acceptsQR !== undefined) user.acceptsQR = acceptsQR;
    if (hasOwnDelivery !== undefined) user.hasOwnDelivery = hasOwnDelivery;

    await user.save();

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        operatingHours: user.operatingHours,
        notifyNewOrders: user.notifyNewOrders,
        notifyLowStock: user.notifyLowStock,
        acceptsQR: user.acceptsQR,
        hasOwnDelivery: user.hasOwnDelivery
      }
    });
  } catch (error) {
    console.error("Update seller settings error:", error);
    res.status(500).json({ success: false, message: "Server error updating settings" });
  }
};

// @desc    Upload payment QR
// @route   POST /api/settings/payment-qr
// @access  Private (Seller only)
export const uploadPaymentQR = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a QR image"
      });
    }

    // Delete old QR if exists
    if (user.paymentQR) {
      const oldPath = path.join(__dirname, "..", user.paymentQR);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Try to detect and extract QR code from image
    let finalPath = req.file.path;
    let finalFilename = req.file.filename;

    try {
      const image = await Jimp.read(req.file.path);
      const width = image.width;
      const height = image.height;

      // Get image data for QR detection
      const imageData = {
        data: new Uint8ClampedArray(image.bitmap.data),
        width,
        height
      };

      const qrCode = jsQR(imageData.data, width, height);

      if (qrCode && qrCode.location) {
        // QR code found! Extract just the QR portion with padding
        const padding = 30;
        const topLeft = qrCode.location.topLeftCorner;
        const bottomRight = qrCode.location.bottomRightCorner;

        const x = Math.max(0, Math.floor(topLeft.x) - padding);
        const y = Math.max(0, Math.floor(topLeft.y) - padding);
        const qrWidth = Math.min(width - x, Math.ceil(bottomRight.x - topLeft.x) + padding * 2);
        const qrHeight = Math.min(height - y, Math.ceil(bottomRight.y - topLeft.y) + padding * 2);

        // Crop to just the QR code area using new Jimp API
        const croppedImage = image.clone().crop({ x, y, w: qrWidth, h: qrHeight });

        // Save as new file
        const croppedFilename = `qr_${Date.now()}_cropped.png`;
        const croppedPath = path.join(path.dirname(req.file.path), croppedFilename);
        await croppedImage.write(croppedPath);

        // Delete original file
        fs.unlinkSync(req.file.path);

        finalPath = croppedPath;
        finalFilename = croppedFilename;

        console.log("QR code detected and extracted successfully");
      } else {
        console.log("No QR code detected, using original image");
      }
    } catch (extractError) {
      console.error("QR extraction failed, using original image:", extractError.message);
      // Continue with original image if extraction fails
    }

    user.paymentQR = `/uploads/qr/${finalFilename}`;
    await user.save();

    res.json({
      success: true,
      message: "Payment QR uploaded successfully",
      paymentQR: user.paymentQR
    });
  } catch (error) {
    console.error("Upload payment QR error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: "Server error uploading QR" });
  }
};

// @desc    Delete payment QR
// @route   DELETE /api/settings/payment-qr
// @access  Private (Seller only)
export const deletePaymentQR = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.paymentQR) {
      const qrPath = path.join(__dirname, "..", user.paymentQR);
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
      user.paymentQR = null;
      await user.save();
    }

    res.json({ success: true, message: "Payment QR deleted" });
  } catch (error) {
    console.error("Delete payment QR error:", error);
    res.status(500).json({ success: false, message: "Server error deleting QR" });
  }
};

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const settings = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      theme: user.theme,
      role: user.role
    };

    // Add seller-specific settings
    if (user.role === "seller") {
      settings.marketLocation = user.marketLocation;
      settings.stallName = user.stallName;
      settings.stallNumber = user.stallNumber;
      settings.operatingHours = user.operatingHours;
      settings.customCategories = user.customCategories || [];
      settings.notifyNewOrders = user.notifyNewOrders;
      settings.notifyLowStock = user.notifyLowStock;
      settings.paymentQR = user.paymentQR;
      settings.acceptsQR = user.acceptsQR;
      settings.hasOwnDelivery = user.hasOwnDelivery;
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ success: false, message: "Server error fetching settings" });
  }
};

// @desc    Get public info for multiple sellers
// @route   POST /api/settings/sellers-info
// @access  Private
export const getSellersInfo = async (req, res) => {
  try {
    const { sellerIds } = req.body;

    if (!Array.isArray(sellerIds)) {
      return res.status(400).json({
        success: false,
        message: "sellerIds must be an array"
      });
    }

    const sellers = await User.find({
      _id: { $in: sellerIds },
      role: "seller"
    }).select("name marketLocation paymentQR acceptsQR hasOwnDelivery");

    res.json({
      success: true,
      sellers
    });
  } catch (error) {
    console.error("Get sellers info error:", error);
    res.status(500).json({ success: false, message: "Server error fetching sellers info" });
  }
};
