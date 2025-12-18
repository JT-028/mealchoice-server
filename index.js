import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import mealRoutes from "./routes/mealRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/meals', mealRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Basic Route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Mealwise Server is running" });
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mealwise")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
