import Order from "../models/Order.js";
import Product from "../models/Product.js";
import fs from "fs";

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Customer)
export const createOrder = async (req, res) => {
  try {
    // If using FormData, items might be a JSON string
    let { items, notes } = req.body;
    
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid items format" });
      }
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
        paymentProof: orderData.paymentProof
      });

      createdOrders.push(order);
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
    const orders = await Order.find({ buyer: req.user._id })
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
    const { status } = req.query;
    
    const query = { seller: req.user._id };
    if (status && status !== "all") {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    // Count by status
    const statusCounts = await Order.aggregate([
      { $match: { seller: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const counts = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0
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
    
    const validStatuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
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
    order.status = "confirmed";
    order.statusHistory.push({
      status: "confirmed",
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
