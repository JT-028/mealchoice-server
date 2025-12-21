import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import mealRoutes from "./routes/mealRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import preferencesRoutes from "./routes/preferencesRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import Message from "./models/Message.js";
import Conversation from "./models/Conversation.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize shared socket instance
import { setIO } from "./utils/socket.js";
setIO(io);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use('/api/meals', mealRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/addresses', addressRoutes);

// Basic Route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Mealwise Server is running" });
});

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join user to their personal room for notifications
  socket.join(`user:${socket.userId}`);

  // Handle joining a conversation room
  socket.on("join_conversation", async (conversationId) => {
    try {
      // Verify user is part of the conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId
      });

      if (conversation) {
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
      }
    } catch (error) {
      console.error("Error joining conversation:", error);
    }
  });

  // Handle leaving a conversation room
  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // Handle sending a message via socket
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, content } = data;

      // Verify user is part of the conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId
      });

      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      // Create the message
      const message = await Message.create({
        conversation: conversationId,
        sender: socket.userId,
        content
      });

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();

      // Increment unread count for the other participant
      const otherParticipant = conversation.participants.find(
        p => p.toString() !== socket.userId.toString()
      );
      const currentUnread = conversation.unreadCount.get(otherParticipant.toString()) || 0;
      conversation.unreadCount.set(otherParticipant.toString(), currentUnread + 1);

      await conversation.save();

      // Populate sender info
      await message.populate("sender", "name role");

      // Emit to all users in the conversation room
      io.to(`conversation:${conversationId}`).emit("new_message", {
        message: message.toObject()
      });

      // Emit notification to the other user's personal room
      io.to(`user:${otherParticipant}`).emit("message_notification", {
        conversationId,
        message: message.toObject()
      });

    } catch (error) {
      console.error("Error sending message via socket:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
      userId: socket.userId,
      conversationId: data.conversationId
    });
  });

  // Handle stop typing
  socket.on("stop_typing", (data) => {
    socket.to(`conversation:${data.conversationId}`).emit("user_stop_typing", {
      userId: socket.userId,
      conversationId: data.conversationId
    });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mealwise")
  .then(() => {
    console.log("Connected to MongoDB");
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

