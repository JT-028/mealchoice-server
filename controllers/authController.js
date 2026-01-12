import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { sendCustomerVerificationEmail } from "../utils/sendEmail.js";

const JWT_EXPIRES_IN = "7d";

// Use a getter to ensure JWT_SECRET is read after dotenv.config() has run
const getJwtSecret = () => process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN
  });
};

// @desc    Register new customer
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate phone number is provided
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    // Validate Philippine phone format (+639XXXXXXXXX - 10 digits after +63)
    const phoneRegex = /^\+639\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid Philippine mobile number"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Generate phone OTP (6-digit code)
    const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const phoneOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create customer (only customers can self-register, sellers are created by admin)
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: "customer",
      isVerified: false,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      phoneVerified: false,
      phoneVerificationCode: phoneOTP,
      phoneVerificationExpires: phoneOTPExpires
    });

    // Send verification email
    try {
      await sendCustomerVerificationEmail({
        to: email,
        name,
        verificationToken
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails
    }

    // TODO: Send SMS with OTP to phone number
    // For now, we'll log it in development
    console.log(`[DEV] Phone OTP for ${phone}: ${phoneOTP}`);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account.",
      requiresVerification: true,
      requiresPhoneVerification: true
    });
  } catch (error) {
    console.error("Register error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during registration"
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support."
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if email is verified (for customers who registered after verification was implemented)
    if (user.role === "customer" && user.isEmailVerified === false && user.emailVerificationToken) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
        requiresVerification: true
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        marketLocation: user.marketLocation,
        isVerified: user.isVerified,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        theme: user.theme
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        marketLocation: user.marketLocation,
        isVerified: user.isVerified,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        theme: user.theme,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Verify email with token
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    // Mark email as verified and activate account
    user.isEmailVerified = true;
    user.isVerified = true;
    user.verifiedAt = new Date();
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully. You can now log in."
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Change password (for temp passwords)
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters"
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
