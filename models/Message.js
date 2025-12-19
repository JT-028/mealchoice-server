import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {
        type: String,
        required: [true, "Message content is required"],
        trim: true,
        maxlength: [2000, "Message cannot exceed 2000 characters"]
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for efficient message retrieval
messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
