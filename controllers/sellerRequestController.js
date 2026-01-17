import crypto from "crypto";
import SellerRequest from "../models/SellerRequest.js";
import User from "../models/User.js";
import { sendSellerWelcomeEmail } from "../utils/sendEmail.js";

// @desc    Submit seller registration request (Public)
// @route   POST /api/auth/seller-request
// @access  Public
export const submitSellerRequest = async (req, res) => {
    try {
        const { name, email, phone, preferredMarket, stallName, stallNumber, message } = req.body;

        // Validation
        if (!name || !email || !phone || !preferredMarket) {
            return res.status(400).json({
                success: false,
                message: "Name, email, phone, and preferred market are required"
            });
        }

        // Validate Philippine phone format (+639XXXXXXXXX)
        const phoneRegex = /^\+639\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid Philippine mobile number"
            });
        }

        // Check if email already exists in users
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        // Check if request already exists
        const existingRequest = await SellerRequest.findOne({ email });
        if (existingRequest) {
            if (existingRequest.status === "pending") {
                return res.status(400).json({
                    success: false,
                    message: "A request with this email is already pending review"
                });
            }
            // If rejected, allow resubmission by deleting old request
            await SellerRequest.findByIdAndDelete(existingRequest._id);
        }

        // Create seller request
        const request = await SellerRequest.create({
            name,
            email,
            phone,
            preferredMarket,
            stallName: stallName || null,
            stallNumber: stallNumber || null,
            message: message || null
        });

        res.status(201).json({
            success: true,
            message: "Your seller account request has been submitted. You will receive an email once it's reviewed.",
            request: {
                _id: request._id,
                name: request.name,
                email: request.email,
                status: request.status
            }
        });
    } catch (error) {
        console.error("Submit seller request error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "A request with this email already exists"
            });
        }

        res.status(500).json({
            success: false,
            message: "Server error submitting request"
        });
    }
};

// @desc    Get all seller requests (Admin)
// @route   GET /api/admin/seller-requests
// @access  Private (Admin)
export const getSellerRequests = async (req, res) => {
    try {
        const { status } = req.query;

        const query = {};
        if (status && status !== "all") {
            query.status = status;
        }

        const requests = await SellerRequest.find(query)
            .sort({ createdAt: -1 });

        // Count by status
        const counts = {
            pending: await SellerRequest.countDocuments({ status: "pending" }),
            approved: await SellerRequest.countDocuments({ status: "approved" }),
            rejected: await SellerRequest.countDocuments({ status: "rejected" })
        };

        res.json({
            success: true,
            count: requests.length,
            statusCounts: counts,
            requests
        });
    } catch (error) {
        console.error("Get seller requests error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching requests"
        });
    }
};

// @desc    Approve seller request and create account (Admin)
// @route   POST /api/admin/seller-requests/:id/approve
// @access  Private (Admin)
export const approveSellerRequest = async (req, res) => {
    try {
        const request = await SellerRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "This request has already been processed"
            });
        }

        // Check if email already exists in users (double-check)
        const existingUser = await User.findOne({ email: request.email });
        if (existingUser) {
            // Delete the request since account exists
            await SellerRequest.findByIdAndDelete(request._id);
            return res.status(400).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        // Generate temporary password (8 chars)
        const tempPassword = crypto.randomBytes(4).toString("hex");

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create seller account
        const seller = await User.create({
            name: request.name,
            email: request.email,
            phone: request.phone,
            password: tempPassword,
            role: "seller",
            marketLocation: request.preferredMarket,
            stallName: request.stallName || null,
            stallNumber: request.stallNumber || null,
            isVerified: false,
            isEmailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
            mustChangePassword: true
        });

        // Send welcome email with temp password
        try {
            await sendSellerWelcomeEmail({
                to: request.email,
                name: request.name,
                tempPassword,
                verificationToken
            });
        } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't fail the request, seller is created
        }

        // Update request status
        request.status = "approved";
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        res.json({
            success: true,
            message: "Seller account created. Verification email sent.",
            seller: {
                _id: seller._id,
                name: seller.name,
                email: seller.email,
                marketLocation: seller.marketLocation
            }
        });
    } catch (error) {
        console.error("Approve seller request error:", error);
        res.status(500).json({
            success: false,
            message: "Server error approving request"
        });
    }
};

// @desc    Reject seller request (Admin)
// @route   DELETE /api/admin/seller-requests/:id/reject
// @access  Private (Admin)
export const rejectSellerRequest = async (req, res) => {
    try {
        const { reason } = req.body;
        const request = await SellerRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "This request has already been processed"
            });
        }

        // Update request status (keep for records)
        request.status = "rejected";
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        request.rejectionReason = reason || null;
        await request.save();

        res.json({
            success: true,
            message: "Seller request rejected"
        });
    } catch (error) {
        console.error("Reject seller request error:", error);
        res.status(500).json({
            success: false,
            message: "Server error rejecting request"
        });
    }
};

// @desc    Delete seller request (Admin)
// @route   DELETE /api/admin/seller-requests/:id
// @access  Private (Admin)
export const deleteSellerRequest = async (req, res) => {
    try {
        const request = await SellerRequest.findByIdAndDelete(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        res.json({
            success: true,
            message: "Request deleted"
        });
    } catch (error) {
        console.error("Delete seller request error:", error);
        res.status(500).json({
            success: false,
            message: "Server error deleting request"
        });
    }
};
