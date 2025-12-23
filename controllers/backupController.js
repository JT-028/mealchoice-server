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

// ============================================
// ADMIN-ONLY: Full Database Backup & Restore
// ============================================

// GET /api/admin/backup/json - Export entire database as JSON (Admin only)
export const exportAdminJSON = async (req, res) => {
  try {
    // Get all users (excluding passwords)
    const users = await User.find({}).select("-password -emailVerificationToken").lean();
    
    // Get all products
    const products = await Product.find({}).lean();
    
    // Get all orders
    const orders = await Order.find({})
      .populate("buyer", "name email")
      .populate("seller", "name email stallName")
      .lean();
    
    // Get all budgets
    const budgets = await Budget.find({}).lean();
    
    // Get all meals
    const meals = await Meal.find({}).lean();

    const backupData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      type: "admin_full_backup",
      stats: {
        totalUsers: users.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalBudgets: budgets.length,
        totalMeals: meals.length
      },
      data: {
        users: users.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          marketLocation: u.marketLocation,
          stallName: u.stallName,
          stallNumber: u.stallNumber,
          customCategories: u.customCategories,
          operatingHours: u.operatingHours,
          paymentQR: u.paymentQR,
          notifyNewOrders: u.notifyNewOrders,
          notifyLowStock: u.notifyLowStock,
          theme: u.theme,
          savedAddresses: u.savedAddresses,
          isActive: u.isActive,
          isMainAdmin: u.isMainAdmin,
          isVerified: u.isVerified,
          isEmailVerified: u.isEmailVerified,
          hasCompletedOnboarding: u.hasCompletedOnboarding,
          preferences: u.preferences,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        })),
        products,
        orders,
        budgets,
        meals
      }
    };

    const filename = `mealwise-full-backup-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backupData);

  } catch (error) {
    console.error("Admin export JSON error:", error);
    res.status(500).json({ message: "Error exporting database" });
  }
};

// GET /api/admin/backup/csv - Export entire database as CSV (Admin only)
export const exportAdminCSV = async (req, res) => {
  try {
    let csvContent = `MealWise Full Database Backup\nDate: ${new Date().toISOString()}\nType: Admin Full Backup\n\n`;

    // Users
    const users = await User.find({}).select("-password -emailVerificationToken").lean();
    if (users.length > 0) {
      csvContent += arrayToCSV(users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        role: u.role,
        marketLocation: u.marketLocation || "",
        stallName: u.stallName || "",
        stallNumber: u.stallNumber || "",
        isActive: u.isActive,
        isVerified: u.isVerified,
        createdAt: u.createdAt
      })), "USERS") + "\n\n";
    }

    // Products
    const products = await Product.find({}).populate("seller", "name email").lean();
    if (products.length > 0) {
      csvContent += arrayToCSV(products.map(p => ({
        id: p._id.toString(),
        name: p.name,
        description: p.description || "",
        price: p.price,
        quantity: p.quantity,
        unit: p.unit,
        category: p.category,
        sellerName: p.seller?.name || "",
        sellerEmail: p.seller?.email || "",
        marketLocation: p.marketLocation,
        isAvailable: p.isAvailable,
        createdAt: p.createdAt
      })), "PRODUCTS") + "\n\n";
    }

    // Orders
    const orders = await Order.find({})
      .populate("buyer", "name email")
      .populate("seller", "name email stallName")
      .lean();
    if (orders.length > 0) {
      csvContent += arrayToCSV(orders.map(o => ({
        id: o._id.toString(),
        buyerName: o.buyer?.name || "",
        buyerEmail: o.buyer?.email || "",
        sellerName: o.seller?.name || "",
        sellerEmail: o.seller?.email || "",
        itemCount: o.items?.length || 0,
        total: o.total,
        status: o.status,
        paymentMethod: o.paymentMethod,
        marketLocation: o.marketLocation,
        deliveryType: o.deliveryType,
        createdAt: o.createdAt
      })), "ORDERS") + "\n\n";
    }

    // Budgets
    const budgets = await Budget.find({}).populate("user", "name email").lean();
    if (budgets.length > 0) {
      csvContent += arrayToCSV(budgets.map(b => ({
        id: b._id.toString(),
        userName: b.user?.name || "",
        userEmail: b.user?.email || "",
        dailyLimit: b.dailyLimit,
        weeklyLimit: b.weeklyLimit,
        alertThreshold: b.alertThreshold,
        currency: b.currency
      })), "BUDGETS") + "\n\n";
    }

    // Meals
    const meals = await Meal.find({}).populate("user", "name email").lean();
    if (meals.length > 0) {
      csvContent += arrayToCSV(meals.map(m => ({
        id: m._id.toString(),
        userName: m.user?.name || "",
        userEmail: m.user?.email || "",
        mealName: m.mealName || m.name,
        calories: m.calories,
        estimatedCost: m.estimatedCost || "",
        createdAt: m.createdAt
      })), "MEALS") + "\n\n";
    }

    const filename = `mealwise-full-backup-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "text/csv");
    res.send(csvContent);

  } catch (error) {
    console.error("Admin export CSV error:", error);
    res.status(500).json({ message: "Error exporting database" });
  }
};

// POST /api/admin/restore - Restore entire database from JSON (Admin only)
export const importAdminJSON = async (req, res) => {
  try {
    const backupData = req.body;

    // Validate backup data
    if (!backupData || !backupData.version || backupData.type !== "admin_full_backup") {
      return res.status(400).json({ message: "Invalid admin backup file format" });
    }

    const results = { restored: [], errors: [], skipped: [] };

    // Restore Products (merge by name per seller)
    if (backupData.data?.products && backupData.data.products.length > 0) {
      try {
        let newCount = 0;
        for (const product of backupData.data.products) {
          const existing = await Product.findOne({ 
            seller: product.seller, 
            name: product.name 
          });
          if (!existing) {
            await Product.create({
              name: product.name,
              description: product.description,
              price: product.price,
              quantity: product.quantity,
              unit: product.unit,
              category: product.category,
              seller: product.seller,
              marketLocation: product.marketLocation,
              isAvailable: product.isAvailable,
              lowStockThreshold: product.lowStockThreshold
            });
            newCount++;
          }
        }
        results.restored.push(`products (${newCount} new)`);
      } catch (e) {
        console.error("Error restoring products:", e);
        results.errors.push("products");
      }
    }

    // Restore Budgets (upsert by user)
    if (backupData.data?.budgets && backupData.data.budgets.length > 0) {
      try {
        let count = 0;
        for (const budget of backupData.data.budgets) {
          await Budget.findOneAndUpdate(
            { user: budget.user },
            {
              dailyLimit: budget.dailyLimit,
              weeklyLimit: budget.weeklyLimit,
              alertThreshold: budget.alertThreshold,
              currency: budget.currency
            },
            { upsert: true }
          );
          count++;
        }
        results.restored.push(`budgets (${count})`);
      } catch (e) {
        console.error("Error restoring budgets:", e);
        results.errors.push("budgets");
      }
    }

    // Restore Meals (merge by name per user)
    if (backupData.data?.meals && backupData.data.meals.length > 0) {
      try {
        let newCount = 0;
        for (const meal of backupData.data.meals) {
          const existing = await Meal.findOne({ 
            user: meal.user, 
            mealName: meal.mealName || meal.name 
          });
          if (!existing) {
            await Meal.create({
              user: meal.user,
              mealName: meal.mealName || meal.name,
              name: meal.name,
              description: meal.description,
              calories: meal.calories,
              macros: meal.macros,
              estimatedCost: meal.estimatedCost,
              ingredients: meal.ingredients
            });
            newCount++;
          }
        }
        results.restored.push(`meals (${newCount} new)`);
      } catch (e) {
        console.error("Error restoring meals:", e);
        results.errors.push("meals");
      }
    }

    // Note: We don't restore users or orders as they are sensitive
    results.skipped.push("users (security reasons)", "orders (transaction history preserved)");

    res.json({
      message: "Admin restore completed",
      restored: results.restored,
      errors: results.errors,
      skipped: results.skipped
    });

  } catch (error) {
    console.error("Admin import JSON error:", error);
    res.status(500).json({ message: "Error restoring database" });
  }
};
