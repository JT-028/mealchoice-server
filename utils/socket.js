// Shared Socket.io instance
// This module allows controllers to access the Socket.io instance

let io = null;

export const setIO = (ioInstance) => {
    io = ioInstance;
};

export const getIO = () => {
    if (!io) {
        console.warn("Socket.io not initialized yet");
    }
    return io;
};

/**
 * Emit low stock notification to a specific seller
 */
export const emitLowStockNotification = (sellerId, product) => {
    if (!io) return;

    io.to(`user:${sellerId}`).emit("low_stock_warning", {
        type: "low_stock",
        productId: product._id,
        productName: product.name,
        currentStock: product.quantity,
        threshold: product.lowStockThreshold,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit general notification to a user
 */
export const emitNotification = (userId, notification) => {
    if (!io) return;

    io.to(`user:${userId}`).emit("notification", {
        ...notification,
        timestamp: new Date().toISOString()
    });
};
