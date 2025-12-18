import Product from "../models/Product.js";

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Seller only)
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, quantity, unit, category, isAvailable, image, lowStockThreshold } = req.body;

    // Use seller's market location or allow override
    const marketLocation = req.body.marketLocation || req.user.marketLocation;

    if (!marketLocation) {
      return res.status(400).json({
        success: false,
        message: "Market location is required. Please set your market location in your profile."
      });
    }

    const product = await Product.create({
      name,
      description,
      price,
      quantity,
      unit,
      category,
      seller: req.user._id,
      marketLocation,
      isAvailable,
      image,
      lowStockThreshold
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product
    });
  } catch (error) {
    console.error("Create product error:", error);
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error creating product"
    });
  }
};

// @desc    Get all products for current seller
// @route   GET /api/products/seller
// @access  Private (Seller only)
export const getSellerProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user._id })
      .sort({ createdAt: -1 });

    // Calculate stats
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.quantity <= p.lowStockThreshold);
    const outOfStock = products.filter(p => p.quantity === 0);

    res.json({
      success: true,
      count: totalProducts,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStock.length,
      products
    });
  } catch (error) {
    console.error("Get seller products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching products"
    });
  }
};

// @desc    Get all available products (public)
// @route   GET /api/products
// @access  Public
export const getAllProducts = async (req, res) => {
  try {
    const { category, market, search } = req.query;

    // Build query
    const query = { isAvailable: true, quantity: { $gt: 0 } };

    if (category && category !== "all") {
      query.category = category;
    }

    if (market) {
      query.marketLocation = market;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const products = await Product.find(query)
      .populate("seller", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching products"
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("seller", "name marketLocation");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching product"
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Seller - owner only)
export const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check ownership
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this product"
      });
    }

    // Update fields
    const allowedUpdates = [
      "name", "description", "price", "quantity", "unit", 
      "category", "isAvailable", "image", "lowStockThreshold"
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();

    res.json({
      success: true,
      message: "Product updated successfully",
      product
    });
  } catch (error) {
    console.error("Update product error:", error);
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error updating product"
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Seller - owner only)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check ownership
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this product"
      });
    }

    await product.deleteOne();

    res.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting product"
    });
  }
};
