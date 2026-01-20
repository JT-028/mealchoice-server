import mongoose from "mongoose";

const sellerRequestSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
        },
        phone: {
            type: String,
            required: [true, "Phone is required"],
            match: [/^\+639\d{9}$/, "Please enter a valid Philippine mobile number"]
        },
        preferredMarket: {
            type: String,
            required: [true, "Market location is required"],
            enum: ["San Nicolas Market", "Pampang Public Market"]
        },
        stallName: {
            type: String,
            trim: true,
            default: null
        },
        stallNumber: {
            type: String,
            trim: true,
            default: null
        },
        message: {
            type: String,
            trim: true,
            maxlength: 500,
            default: null
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        rejectionReason: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Email is already indexed via unique: true in the field definition

const SellerRequest = mongoose.model("SellerRequest", sellerRequestSchema);

export default SellerRequest;
