import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  }
});

const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [orderItemSchema],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"],
    default: "pending"
  },
  paymentMethod: {
    type: String,
    enum: ["qr", "cod"],
    default: "qr"
  },
  marketLocation: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  paymentProof: {
    type: String,
    default: null
  },
  isPaymentVerified: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isHiddenByBuyer: {
    type: Boolean,
    default: false
  },
  // Delivery options
  deliveryType: {
    type: String,
    enum: ["pickup", "delivery"],
    default: "pickup"
  },
  deliveryAddress: {
    fullAddress: { type: String, default: null },
    barangay: { type: String, default: null },
    city: { type: String, default: null },
    province: { type: String, default: null },
    postalCode: { type: String, default: null },
    contactPhone: { type: String, default: null },
    deliveryNotes: { type: String, default: null }
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Add initial status to history on create
orderSchema.pre("save", function () {
  if (this.isNew) {
    this.statusHistory = [{
      status: "pending",
      timestamp: new Date(),
      note: "Order placed"
    }];
  }
});

// Index for faster queries
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, status: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
