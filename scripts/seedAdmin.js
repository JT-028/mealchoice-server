import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mealwise";

// Admin credentials
const ADMIN_EMAIL = "admin@mealwise.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin";

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // Check if admin exists
    const existingAdmin = await usersCollection.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log("Admin account already exists!");
      console.log(`Email: ${ADMIN_EMAIL}`);
    } else {
      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

      // Create admin
      await usersCollection.insertOne({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log("✅ Admin account created successfully!");
      console.log(`Email: ${ADMIN_EMAIL}`);
      console.log(`Password: ${ADMIN_PASSWORD}`);
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
}

seedAdmin();
