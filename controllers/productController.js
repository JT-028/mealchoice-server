import Product from "../models/Product.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Seller only)
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, quantity, unit, category, isAvailable, image, lowStockThreshold } = req.body;

    // Use seller's market location from their profile
    const marketLocation = req.user.marketLocation;

    if (!marketLocation) {
      return res.status(400).json({
        success: false,
        message: "Market location not found. Please set your market location in your profile."
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

    // Delete image file if exists
    if (product.image) {
      const imagePath = path.join(__dirname, "..", product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
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

// @desc    Upload product image
// @route   POST /api/products/:id/image
// @access  Private (Seller - owner only)
export const uploadImage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      // Delete uploaded file if product not found
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check ownership
    if (product.seller.toString() !== req.user._id.toString()) {
      // Delete uploaded file if not authorized
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this product"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file"
      });
    }

    // Delete old image if exists
    if (product.image) {
      const oldImagePath = path.join(__dirname, "..", product.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Save new image path (relative path for URL)
    product.image = `/uploads/products/${req.file.filename}`;
    await product.save();

    res.json({
      success: true,
      message: "Image uploaded successfully",
      image: product.image,
      product
    });
  } catch (error) {
    console.error("Upload image error:", error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Server error uploading image"
    });
  }
};

