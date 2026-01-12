import Order from "../models/Order.js";
import Product from "../models/Product.js";
import fs from "fs";
import User from "../models/User.js";
import { emitLowStockNotification, emitNewOrderNotification } from "../utils/socket.js";
import { sendLowStockEmail, sendNewOrderEmail } from "../utils/sendEmail.js";

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Customer)
export const createOrder = async (req, res) => {
  try {
    // If using FormData, items might be a JSON string
    let { items, notes, paymentMethods, deliveryType, deliveryAddress } = req.body;

    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid items format" });
      }
    }

    if (typeof paymentMethods === 'string') {
      try {
        paymentMethods = JSON.parse(paymentMethods);
      } catch (e) {
        console.error("Failed to parse paymentMethods:", e);
        paymentMethods = {};
      }
    } else if (!paymentMethods) {
      paymentMethods = {};
    }

    if (!items || items.length === 0) {
      // Clean up uploaded files if error
      if (req.files) {
        req.files.forEach(file => fs.unlinkSync(file.path));
      }
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item"
      });
    }

    // Group items by seller
    const ordersBySeller = {};

    for (const item of items) {
      const product = await Product.findById(item.productId).populate("seller");

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      if (!product.isAvailable || product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is not available in the requested quantity`
        });
      }

      const sellerId = product.seller._id.toString();

      if (!ordersBySeller[sellerId]) {
        ordersBySeller[sellerId] = {
          seller: product.seller._id,
          marketLocation: product.marketLocation,
          items: [],
          total: 0,
          paymentProof: null
        };
      }

      ordersBySeller[sellerId].items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        unit: product.unit,
        image: product.image
      });

      ordersBySeller[sellerId].total += product.price * item.quantity;

      // Check for file upload for this seller
      // Field name convention: proof_{sellerId}
      if (req.files) {
        const proofFile = req.files.find(f => f.fieldname === `proof_${sellerId}`);
        if (proofFile) {
          ordersBySeller[sellerId].paymentProof = `/uploads/receipts/${proofFile.filename}`;
        }
      }

      // Reduce product quantity
      product.quantity -= item.quantity;
      await product.save();

      // Check if product is now low on stock
      if (product.quantity <= product.lowStockThreshold && product.quantity > 0) {
        // Emit real-time notification to seller
        emitLowStockNotification(sellerId, product);

        // Also send email notification
        try {
          const seller = await User.findById(sellerId);
          if (seller && seller.email) {
            await sendLowStockEmail({
              to: seller.email,
              productName: product.name,
              currentStock: product.quantity,
              threshold: product.lowStockThreshold
            });
          }
        } catch (emailError) {
          console.error("Failed to send low stock email:", emailError);
        }
      }
    }

    // Create orders for each seller
    const createdOrders = [];

    for (const sellerId in ordersBySeller) {
      const orderData = ordersBySeller[sellerId];

      const order = await Order.create({
        buyer: req.user._id,
        seller: orderData.seller,
        items: orderData.items,
        total: orderData.total,
        marketLocation: orderData.marketLocation,
        notes,
        paymentMethod: paymentMethods[sellerId] || 'qr',
        paymentProof: orderData.paymentProof,
        deliveryType: deliveryType || 'pickup',
        deliveryAddress: deliveryType === 'delivery' && deliveryAddress ? {
          fullAddress: deliveryAddress.fullAddress,
          barangay: deliveryAddress.barangay,
          city: deliveryAddress.city,
          province: deliveryAddress.province,
          postalCode: deliveryAddress.postalCode,
          contactPhone: deliveryAddress.contactPhone,
          deliveryNotes: deliveryAddress.deliveryNotes
        } : null
      });

      createdOrders.push(order);

      // Notify seller about new order
      try {
        const seller = await User.findById(sellerId);
        if (seller) {
          // Emit real-time notification
          emitNewOrderNotification(sellerId, order, req.user.name);

          // Send email notification
          if (seller.email) {
            await sendNewOrderEmail({
              to: seller.email,
              sellerName: seller.name,
              orderId: order._id,
              buyerName: req.user.name,
              items: order.items,
              total: order.total,
              marketLocation: order.marketLocation
            });
          }
        }
      } catch (notifyError) {
        console.error("Failed to send order notification:", notifyError);
        // Don't fail the order creation if notification fails
      }
    }

    res.status(201).json({
      success: true,
      message: `${createdOrders.length} order(s) created successfully`,
      orders: createdOrders
    });
  } catch (error) {
    console.error("Create order error:", error);
    // Clean up files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error creating order"
    });
  }
};


// @desc    Get customer's orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      buyer: req.user._id,
      isHiddenByBuyer: { $ne: true }
    })
      .populate("seller", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching orders"
    });
  }
};

// @desc    Get seller's incoming orders
// @route   GET /api/orders/seller
// @access  Private (Seller)
export const getSellerOrders = async (req, res) => {
  try {
    const { status, archived } = req.query;

    const query = { seller: req.user._id };
    if (status && status !== "all") {
      query.status = status;
    }

    // Filter by archived status (default: show non-archived)
    if (archived === 'true') {
      query.isArchived = true;
    } else if (archived === 'false' || archived === undefined) {
      query.isArchived = { $ne: true };
    }

    const orders = await Order.find(query)
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    // Count by status (excluding archived for main counts)
    const statusCounts = await Order.aggregate([
      { $match: { seller: req.user._id, isArchived: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Count archived orders
    const archivedCount = await Order.countDocuments({
      seller: req.user._id,
      isArchived: true
    });

    const counts = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
      archived: archivedCount
    };

    statusCounts.forEach(s => {
      counts[s._id] = s.count;
    });

    res.json({
      success: true,
      count: orders.length,
      statusCounts: counts,
      orders
    });
  } catch (error) {
    console.error("Get seller orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching orders"
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Seller)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    // Simplified status flow: pending -> preparing -> completed
    const validStatuses = ["pending", "preparing", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check ownership
    if (order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order"
      });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status updated to ${status}`
    });

    await order.save();

    res.json({
      success: true,
      message: "Order status updated",
      order
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating order"
    });
  }
};

// @desc    Verify payment
// @route   PUT /api/orders/:id/payment
// @access  Private (Seller)
export const verifyPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check ownership
    if (order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order"
      });
    }

    order.isPaymentVerified = true;
    order.status = "preparing";
    order.statusHistory.push({
      status: "preparing",
      timestamp: new Date(),
      note: "Payment verified and order confirmed by seller"
    });

    await order.save();

    res.json({
      success: true,
      message: "Payment verified",
      order
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error verifying payment"
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name email")
      .populate("seller", "name");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if user is buyer or seller
    const isBuyer = order.buyer._id.toString() === req.user._id.toString();
    const isSeller = order.seller._id.toString() === req.user._id.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order"
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching order"
    });
  }
};

// @desc    Archive/unarchive an order
// @route   PUT /api/orders/:id/archive
// @access  Private (Seller)
export const archiveOrder = async (req, res) => {
  try {
    const { archive = true } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Only seller can archive
    if (order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to archive this order"
      });
    }

    // Only completed or cancelled orders can be archived
    if (!["completed", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Only completed or cancelled orders can be archived"
      });
    }

    order.isArchived = archive;
    await order.save();

    res.json({
      success: true,
      message: archive ? "Order archived successfully" : "Order unarchived successfully",
      order
    });
  } catch (error) {
    console.error("Archive order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error archiving order"
    });
  }
};

// @desc    Bulk archive/unarchive orders
// @route   PUT /api/orders/bulk-archive
// @access  Private (Seller)
export const bulkArchiveOrders = async (req, res) => {
  try {
    const { orderIds, archive = true } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of order IDs"
      });
    }

    // Verify all orders belong to this seller and are archivable
    const orders = await Order.find({
      _id: { $in: orderIds },
      seller: req.user._id
    });

    if (orders.length !== orderIds.length) {
      return res.status(403).json({
        success: false,
        message: "Some orders were not found or you don't have permission"
      });
    }

    // Check if all orders can be archived (completed or cancelled)
    const nonArchivable = orders.filter(o =>
      archive && !["completed", "cancelled"].includes(o.status)
    );

    if (nonArchivable.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Only completed or cancelled orders can be archived"
      });
    }

    // Bulk update
    await Order.updateMany(
      { _id: { $in: orderIds }, seller: req.user._id },
      { isArchived: archive }
    );

    res.json({
      success: true,
      message: `${orderIds.length} order(s) ${archive ? 'archived' : 'unarchived'} successfully`,
      count: orderIds.length
    });
  } catch (error) {
    console.error("Bulk archive error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk archive"
    });
  }
};

// @desc    Get seller analytics data
// @route   GET /api/orders/seller/analytics
// @access  Private (Seller)
export const getSellerAnalytics = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { startDate, endDate, period } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();

    if (startDate && endDate) {
      // Custom date range
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        }
      };
    } else if (period) {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (period) {
        case 'today':
          dateFilter = { createdAt: { $gte: startOfToday } };
          break;
        case 'week':
          const weekAgo = new Date(startOfToday);
          weekAgo.setDate(weekAgo.getDate() - 7);
          dateFilter = { createdAt: { $gte: weekAgo } };
          break;
        case 'month':
          const monthAgo = new Date(startOfToday);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          dateFilter = { createdAt: { $gte: monthAgo } };
          break;
        case 'year':
          const yearAgo = new Date(startOfToday);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          dateFilter = { createdAt: { $gte: yearAgo } };
          break;
        default:
          // All time - no filter
          break;
      }
    }

    const baseQuery = { seller: sellerId, ...dateFilter };

    // Get all orders for the period
    const orders = await Order.find(baseQuery);

    // Calculate metrics
    const completedOrders = orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Payment method breakdown
    const paymentBreakdown = {
      qr: orders.filter(o => o.paymentMethod === 'qr' || !o.paymentMethod).length,
      cod: orders.filter(o => o.paymentMethod === 'cod').length
    };

    // Status breakdown
    const statusBreakdown = {
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    };

    // Top selling products
    const productSales = {};
    for (const order of completedOrders) {
      for (const item of order.items) {
        const key = item.product?.toString() || item.name;
        if (!productSales[key]) {
          productSales[key] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
            image: item.image
          };
        }
        productSales[key].quantity += item.quantity;
        productSales[key].revenue += item.price * item.quantity;
      }
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Sales over time (daily for last 7 days, weekly for month, monthly for year)
    const salesOverTime = [];
    const groupByDate = {};

    for (const order of completedOrders) {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!groupByDate[date]) {
        groupByDate[date] = { date, orders: 0, revenue: 0 };
      }
      groupByDate[date].orders += 1;
      groupByDate[date].revenue += order.total;
    }

    // Get last 14 days of data
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      salesOverTime.push(groupByDate[dateStr] || { date: dateStr, orders: 0, revenue: 0 });
    }

    // Comparison with previous period
    let previousPeriodRevenue = 0;
    if (period && period !== 'all') {
      const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
      const prevStart = new Date(now);
      prevStart.setDate(prevStart.getDate() - (periodDays * 2));
      const prevEnd = new Date(now);
      prevEnd.setDate(prevEnd.getDate() - periodDays);

      const prevOrders = await Order.find({
        seller: sellerId,
        status: 'completed',
        createdAt: { $gte: prevStart, $lt: prevEnd }
      });
      previousPeriodRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);
    }

    const revenueChange = previousPeriodRevenue > 0
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0;

    // Global Market Comparison (Across all sellers for the same period)
    const marketComparison = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: dateFilter.createdAt || { $exists: true }
        }
      },
      {
        $group: {
          _id: '$marketLocation',
          revenue: { $sum: '$total' },
          orders: { $sum: 1 }
        }
      }
    ]);

    // Format market comparison to ensure both markets are present
    const marketData = [
      { name: 'San Nicolas Market', revenue: 0, orders: 0 },
      { name: 'Pampang Public Market', revenue: 0, orders: 0 }
    ].map(m => {
      const found = marketComparison.find(c => c._id === m.name);
      return found ? { name: m.name, revenue: found.revenue, orders: found.orders } : m;
    });

    res.json({
      success: true,
      analytics: {
        summary: {
          totalRevenue,
          totalOrders,
          completedOrders: completedOrders.length,
          pendingOrders,
          cancelledOrders,
          averageOrderValue,
          revenueChange: Math.round(revenueChange * 10) / 10
        },
        paymentBreakdown,
        statusBreakdown,
        topProducts,
        salesOverTime,
        marketComparison: marketData
      }
    });
  } catch (error) {
    console.error("Get seller analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching analytics"
    });
  }
};
// @desc    Cancel order by customer
// @route   PUT /api/orders/:id/cancel-customer
// @access  Private (Customer)
export const cancelOrderByCustomer = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check ownership
    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Only pending or confirmed orders can be cancelled by customer
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in its current status: ${order.status}`
      });
    }

    // Restore stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    order.status = "cancelled";
    order.statusHistory.push({
      status: "cancelled",
      timestamp: new Date(),
      note: reason ? `Cancelled by customer. Reason: ${reason}` : "Cancelled by customer"
    });

    await order.save();

    res.json({ success: true, message: "Order cancelled successfully", order });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ success: false, message: "Server error cancelling order" });
  }
};

// @desc    Hide order for buyer
// @route   PUT /api/orders/:id/hide-buyer
// @access  Private (Customer)
export const hideOrderForBuyer = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Only allow hiding if completed or cancelled
    if (!["completed", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Only completed or cancelled orders can be removed from history"
      });
    }

    order.isHiddenByBuyer = true;
    await order.save();

    res.json({ success: true, message: "Order removed from history" });
  } catch (error) {
    console.error("Hide order error:", error);
    res.status(500).json({ success: false, message: "Server error hiding order" });
  }
};

// @desc    Bulk hide orders for buyer
// @route   PUT /api/orders/bulk-hide-buyer
// @access  Private (Customer)
export const bulkHideOrdersForBuyer = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide order IDs" });
    }

    // Update only orders belonging to the user that are completed or cancelled
    const result = await Order.updateMany(
      {
        _id: { $in: orderIds },
        buyer: req.user._id,
        status: { $in: ["completed", "cancelled"] }
      },
      { isHiddenByBuyer: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} order(s) removed from history`,
      count: result.modifiedCount
    });
  } catch (error) {
    console.error("Bulk hide error:", error);
    res.status(500).json({ success: false, message: "Server error during bulk removal" });
  }
};
