import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],
    // Quick reference to know who is the seller and who is the customer
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    // Track unread counts for each participant
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    }
}, {
    timestamps: true
});

// Ensure unique conversation between two users
conversationSchema.index({ customer: 1, seller: 1 }, { unique: true });

// Index for efficient conversation listing
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Static method to find or create a conversation between two users
conversationSchema.statics.findOrCreate = async function (customerId, sellerId) {
    let conversation = await this.findOne({
        customer: customerId,
        seller: sellerId
    });

    if (!conversation) {
        conversation = await this.create({
            participants: [customerId, sellerId],
            customer: customerId,
            seller: sellerId,
            unreadCount: new Map([[customerId.toString(), 0], [sellerId.toString(), 0]])
        });
    }

    return conversation;
};

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
