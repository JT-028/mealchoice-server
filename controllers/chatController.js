import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

// Get all conversations for the current user
export const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate("customer", "name email")
            .populate("seller", "name email marketLocation")
            .populate("lastMessage", "content createdAt")
            .sort({ lastMessageAt: -1 });

        // Add unread count for current user to each conversation
        const conversationsWithUnread = conversations.map(conv => {
            const convObj = conv.toObject();
            convObj.unreadCount = conv.unreadCount.get(userId.toString()) || 0;
            return convObj;
        });

        res.json({
            success: true,
            conversations: conversationsWithUnread
        });
    } catch (error) {
        console.error("Error getting conversations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get conversations"
        });
    }
};

// Get messages for a specific conversation
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;
        const { page = 1, limit = 50 } = req.query;

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found"
            });
        }

        const messages = await Message.find({ conversation: conversationId })
            .populate("sender", "name role")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Mark messages as read
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Reset unread count for this user
        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();

        res.json({
            success: true,
            messages: messages.reverse(), // Return in chronological order
            hasMore: messages.length === parseInt(limit)
        });
    } catch (error) {
        console.error("Error getting messages:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get messages"
        });
    }
};

// Start a new conversation or get existing one
export const createConversation = async (req, res) => {
    try {
        const { sellerId } = req.body;
        const customerId = req.user._id;

        // Verify the current user is a customer
        if (req.user.role !== "customer") {
            return res.status(403).json({
                success: false,
                message: "Only customers can start conversations with sellers"
            });
        }

        // Verify seller exists and is actually a seller
        const seller = await User.findOne({ _id: sellerId, role: "seller" });
        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        // Find or create conversation
        const conversation = await Conversation.findOrCreate(customerId, sellerId);

        // Populate the conversation
        await conversation.populate("customer", "name email");
        await conversation.populate("seller", "name email marketLocation");

        res.json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error("Error creating conversation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create conversation"
        });
    }
};

// Send a message
export const sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const senderId = req.user._id;

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: senderId
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found"
            });
        }

        // Create the message
        const message = await Message.create({
            conversation: conversationId,
            sender: senderId,
            content
        });

        // Update conversation with last message
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();

        // Increment unread count for the other participant
        const otherParticipant = conversation.participants.find(
            p => p.toString() !== senderId.toString()
        );
        const currentUnread = conversation.unreadCount.get(otherParticipant.toString()) || 0;
        conversation.unreadCount.set(otherParticipant.toString(), currentUnread + 1);

        await conversation.save();

        // Populate sender info
        await message.populate("sender", "name role");

        res.json({
            success: true,
            message
        });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send message"
        });
    }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found"
            });
        }

        // Mark all messages from other user as read
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Reset unread count
        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();

        res.json({
            success: true,
            message: "Messages marked as read"
        });
    } catch (error) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({
            success: false,
            message: "Failed to mark messages as read"
        });
    }
};

// Get total unread count for user
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId
        });

        let totalUnread = 0;
        conversations.forEach(conv => {
            totalUnread += conv.unreadCount.get(userId.toString()) || 0;
        });

        res.json({
            success: true,
            unreadCount: totalUnread
        });
    } catch (error) {
        console.error("Error getting unread count:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get unread count"
        });
    }
};
