import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
    maxlength: [100, "Product name cannot exceed 100 characters"]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price cannot be negative"]
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [0, "Quantity cannot be negative"],
    default: 0
  },
  unit: {
    type: String,
    required: [true, "Unit is required"],
    enum: ["kg", "g", "piece", "bundle", "pack", "dozen", "liter", "ml"],
    default: "piece"
  },
  category: {
    type: String,
    required: [true, "Category is required"],
    trim: true,
    default: "others"
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  marketLocation: {
    type: String,
    enum: ["San Nicolas Market", "Pampang Public Market"],
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: null
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  }
}, {
  timestamps: true
});

// Virtual for checking if stock is low
productSchema.virtual("isLowStock").get(function() {
  return this.quantity <= this.lowStockThreshold;
});

// Ensure virtuals are included in JSON output
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// Index for faster queries
productSchema.index({ seller: 1, category: 1 });
productSchema.index({ marketLocation: 1, isAvailable: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
