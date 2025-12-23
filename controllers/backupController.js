import User from "../models/User.js";
import Budget from "../models/Budget.js";
import Meal from "../models/Meal.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

// Helper: Convert array of objects to CSV string
const arrayToCSV = (data, prefix = "") => {
  if (!data || data.length === 0) return "";
  
  const headers = Object.keys(data[0]).filter(key => 
    typeof data[0][key] !== 'object' || data[0][key] === null
  );
  
  const csvRows = [
    `--- ${prefix} ---`,
    headers.join(","),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(",")
    )
  ];
  return csvRows.join("\n");
};

// Helper: Flatten nested objects for CSV
const flattenObject = (obj, prefix = "") => {
  const result = {};
  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined) {
      result[prefix + key] = "";
    } else if (typeof obj[key] === "object" && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
      Object.assign(result, flattenObject(obj[key], prefix + key + "_"));
    } else if (Array.isArray(obj[key])) {
      result[prefix + key] = obj[key].join("; ");
    } else if (obj[key] instanceof Date) {
      result[prefix + key] = obj[key].toISOString();
    } else {
      result[prefix + key] = obj[key];
    }
  }
  return result;
};

// GET /api/settings/backup/json - Export all user data as JSON
export const exportJSON = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Get full user data
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Common backup data
    const backupData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      role: userRole,
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        theme: user.theme
      }
    };

    if (userRole === "customer") {
      // Customer-specific data
      backupData.preferences = user.preferences || {};
      backupData.savedAddresses = user.savedAddresses || [];
      
      // Get budget
      const budget = await Budget.findOne({ user: userId }).lean();
      backupData.budget = budget ? {
        dailyLimit: budget.dailyLimit,
        weeklyLimit: budget.weeklyLimit,
        alertThreshold: budget.alertThreshold,
        currency: budget.currency
      } : null;

      // Get saved meals
      const meals = await Meal.find({ user: userId }).lean();
      backupData.savedMeals = meals.map(m => ({
        mealName: m.mealName || m.name,
        description: m.description,
        calories: m.calories,
        macros: m.macros,
        estimatedCost: m.estimatedCost,
        ingredients: m.ingredients,
        createdAt: m.createdAt
      }));

      // Get order history
      const orders = await Order.find({ buyer: userId })
        .populate("seller", "name stallName")
        .sort({ createdAt: -1 })
        .lean();
      backupData.orders = orders.map(o => ({
        orderId: o._id,
        seller: o.seller?.stallName || o.seller?.name || "Unknown",
        items: o.items,
        total: o.total,
        status: o.status,
        paymentMethod: o.paymentMethod,
        marketLocation: o.marketLocation,
        deliveryType: o.deliveryType,
        deliveryAddress: o.deliveryAddress,
        createdAt: o.createdAt
      }));

    } else if (userRole === "seller") {
      // Seller-specific data
      backupData.storeInfo = {
        stallName: user.stallName,
        stallNumber: user.stallNumber,
        marketLocation: user.marketLocation
      };
      backupData.operatingHours = user.operatingHours;
      backupData.customCategories = user.customCategories || [];
      backupData.notifications = {
        notifyNewOrders: user.notifyNewOrders,
        notifyLowStock: user.notifyLowStock
      };

      // Get products
      const products = await Product.find({ seller: userId }).lean();
      backupData.products = products.map(p => ({
        name: p.name,
        description: p.description,
        price: p.price,
        quantity: p.quantity,
        unit: p.unit,
        category: p.category,
        isAvailable: p.isAvailable,
        lowStockThreshold: p.lowStockThreshold,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));

      // Get received orders
      const orders = await Order.find({ seller: userId })
        .populate("buyer", "name")
        .sort({ createdAt: -1 })
        .lean();
      backupData.orders = orders.map(o => ({
        orderId: o._id,
        buyer: o.buyer?.name || "Unknown",
        items: o.items,
        total: o.total,
        status: o.status,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt
      }));
    }

    // Set headers for JSON download
    const filename = `mealwise-backup-${userRole}-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backupData);

  } catch (error) {
    console.error("Export JSON error:", error);
    res.status(500).json({ message: "Error exporting data" });
  }
};

// GET /api/settings/backup/csv - Export all user data as CSV
export const exportCSV = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let csvContent = `MealWise Backup Export\nDate: ${new Date().toISOString()}\nRole: ${userRole}\n\n`;

    // Profile section
    csvContent += arrayToCSV([flattenObject({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      theme: user.theme
    })], "PROFILE") + "\n\n";

    if (userRole === "customer") {
      // Preferences
      if (user.preferences) {
        csvContent += arrayToCSV([flattenObject(user.preferences)], "PREFERENCES") + "\n\n";
      }

      // Addresses
      if (user.savedAddresses && user.savedAddresses.length > 0) {
        csvContent += arrayToCSV(user.savedAddresses.map(a => flattenObject(a)), "ADDRESSES") + "\n\n";
      }

      // Budget
      const budget = await Budget.findOne({ user: userId }).lean();
      if (budget) {
        csvContent += arrayToCSV([{
          dailyLimit: budget.dailyLimit,
          weeklyLimit: budget.weeklyLimit,
          alertThreshold: budget.alertThreshold,
          currency: budget.currency
        }], "BUDGET") + "\n\n";
      }

      // Saved Meals
      const meals = await Meal.find({ user: userId }).lean();
      if (meals.length > 0) {
        csvContent += arrayToCSV(meals.map(m => ({
          name: m.mealName || m.name,
          description: m.description || "",
          calories: m.calories,
          protein: m.macros?.protein || "",
          carbs: m.macros?.carbs || "",
          fats: m.macros?.fats || "",
          cost: m.estimatedCost || "",
          ingredients: (m.ingredients || []).join("; "),
          createdAt: m.createdAt
        })), "SAVED_MEALS") + "\n\n";
      }

      // Orders
      const orders = await Order.find({ buyer: userId })
        .populate("seller", "name stallName")
        .sort({ createdAt: -1 })
        .lean();
      if (orders.length > 0) {
        csvContent += arrayToCSV(orders.map(o => ({
          orderId: o._id.toString(),
          seller: o.seller?.stallName || o.seller?.name || "",
          itemCount: o.items?.length || 0,
          total: o.total,
          status: o.status,
          paymentMethod: o.paymentMethod,
          marketLocation: o.marketLocation,
          createdAt: o.createdAt
        })), "ORDERS") + "\n\n";
      }

    } else if (userRole === "seller") {
      // Store info
      csvContent += arrayToCSV([{
        stallName: user.stallName || "",
        stallNumber: user.stallNumber || "",
        marketLocation: user.marketLocation || ""
      }], "STORE_INFO") + "\n\n";

      // Operating hours
      if (user.operatingHours) {
        const hoursData = Object.entries(user.operatingHours).map(([day, hours]) => ({
          day,
          open: hours.open,
          close: hours.close,
          isClosed: hours.isClosed
        }));
        csvContent += arrayToCSV(hoursData, "OPERATING_HOURS") + "\n\n";
      }

      // Products
      const products = await Product.find({ seller: userId }).lean();
      if (products.length > 0) {
        csvContent += arrayToCSV(products.map(p => ({
          name: p.name,
          description: p.description || "",
          price: p.price,
          quantity: p.quantity,
          unit: p.unit,
          category: p.category,
          isAvailable: p.isAvailable,
          lowStockThreshold: p.lowStockThreshold
        })), "PRODUCTS") + "\n\n";
      }

      // Orders
      const orders = await Order.find({ seller: userId })
        .populate("buyer", "name")
        .sort({ createdAt: -1 })
        .lean();
      if (orders.length > 0) {
        csvContent += arrayToCSV(orders.map(o => ({
          orderId: o._id.toString(),
          buyer: o.buyer?.name || "",
          itemCount: o.items?.length || 0,
          total: o.total,
          status: o.status,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt
        })), "ORDERS") + "\n\n";
      }
    }

    const filename = `mealwise-backup-${userRole}-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "text/csv");
    res.send(csvContent);

  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).json({ message: "Error exporting data" });
  }
};

// POST /api/settings/restore - Import and restore user data from JSON
export const importJSON = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const backupData = req.body;

    // Validate backup data
    if (!backupData || !backupData.version || !backupData.role) {
      return res.status(400).json({ message: "Invalid backup file format" });
    }

    if (backupData.role !== userRole) {
      return res.status(400).json({ 
        message: `Cannot restore ${backupData.role} backup to ${userRole} account` 
      });
    }

    const results = { restored: [], errors: [] };

    if (userRole === "customer") {
      // Restore preferences
      if (backupData.preferences) {
        try {
          await User.findByIdAndUpdate(userId, { preferences: backupData.preferences });
          results.restored.push("preferences");
        } catch (e) {
          results.errors.push("preferences");
        }
      }

      // Restore addresses
      if (backupData.savedAddresses) {
        try {
          await User.findByIdAndUpdate(userId, { savedAddresses: backupData.savedAddresses });
          results.restored.push("addresses");
        } catch (e) {
          results.errors.push("addresses");
        }
      }

      // Restore budget
      if (backupData.budget) {
        try {
          await Budget.findOneAndUpdate(
            { user: userId },
            { ...backupData.budget, user: userId },
            { upsert: true }
          );
          results.restored.push("budget");
        } catch (e) {
          results.errors.push("budget");
        }
      }

      // Restore saved meals (add new ones, don't overwrite existing)
      if (backupData.savedMeals && backupData.savedMeals.length > 0) {
        try {
          const existingMeals = await Meal.find({ user: userId }).lean();
          const existingNames = new Set(existingMeals.map(m => m.mealName || m.name));
          
          const newMeals = backupData.savedMeals
            .filter(m => !existingNames.has(m.mealName))
            .map(m => ({ ...m, user: userId }));
          
          if (newMeals.length > 0) {
            await Meal.insertMany(newMeals);
          }
          results.restored.push(`meals (${newMeals.length} new)`);
        } catch (e) {
          results.errors.push("meals");
        }
      }

    } else if (userRole === "seller") {
      // Restore store settings
      if (backupData.operatingHours) {
        try {
          await User.findByIdAndUpdate(userId, { 
            operatingHours: backupData.operatingHours,
            customCategories: backupData.customCategories || []
          });
          results.restored.push("store settings");
        } catch (e) {
          results.errors.push("store settings");
        }
      }

      // Restore notifications
      if (backupData.notifications) {
        try {
          await User.findByIdAndUpdate(userId, {
            notifyNewOrders: backupData.notifications.notifyNewOrders,
            notifyLowStock: backupData.notifications.notifyLowStock
          });
          results.restored.push("notifications");
        } catch (e) {
          results.errors.push("notifications");
        }
      }

      // Restore products (add new ones by name)
      if (backupData.products && backupData.products.length > 0) {
        try {
          const existingProducts = await Product.find({ seller: userId }).lean();
          const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
          
          const newProducts = backupData.products
            .filter(p => !existingNames.has(p.name.toLowerCase()))
            .map(p => ({ 
              ...p, 
              seller: userId,
              marketLocation: req.user.marketLocation || backupData.storeInfo?.marketLocation
            }));
          
          if (newProducts.length > 0) {
            await Product.insertMany(newProducts);
          }
          results.restored.push(`products (${newProducts.length} new)`);
        } catch (e) {
          results.errors.push("products");
        }
      }
    }

    res.json({
      message: "Restore completed",
      restored: results.restored,
      errors: results.errors
    });

  } catch (error) {
    console.error("Import JSON error:", error);
    res.status(500).json({ message: "Error restoring data" });
  }
};
