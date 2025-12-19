import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    getConversations,
    getMessages,
    createConversation,
    sendMessage,
    markAsRead,
    getUnreadCount
} from "../controllers/chatController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all conversations for the current user
router.get("/conversations", getConversations);

// Get unread message count
router.get("/unread", getUnreadCount);

// Get messages for a specific conversation
router.get("/conversations/:conversationId/messages", getMessages);

// Start a new conversation with a seller
router.post("/conversations", createConversation);

// Send a message
router.post("/messages", sendMessage);

// Mark messages in a conversation as read
router.put("/conversations/:conversationId/read", markAsRead);

export default router;
