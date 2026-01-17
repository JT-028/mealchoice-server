import cron from "node-cron";
import BackupSettings from "../models/BackupSettings.js";
import User from "../models/User.js";
import Budget from "../models/Budget.js";
import Meal from "../models/Meal.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let scheduledJob = null;

// Ensure backup directory exists
const getBackupDir = () => {
    const backupDir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
};

// Run the actual backup
const runBackup = async () => {
    console.log("[BackupScheduler] Running scheduled backup...");

    try {
        const settings = await BackupSettings.getSettings();
        const collectionsToBackup = settings.selectedCollections;

        const backupData = {
            exportDate: new Date().toISOString(),
            version: "1.0",
            type: "admin_scheduled_backup",
            collections: collectionsToBackup,
            stats: {},
            data: {}
        };

        // Backup each selected collection
        if (collectionsToBackup.includes('users')) {
            const users = await User.find({}).select("-password -emailVerificationToken").lean();
            backupData.data.users = users;
            backupData.stats.totalUsers = users.length;
        }

        if (collectionsToBackup.includes('products')) {
            const products = await Product.find({}).lean();
            backupData.data.products = products;
            backupData.stats.totalProducts = products.length;
        }

        if (collectionsToBackup.includes('orders')) {
            const orders = await Order.find({}).lean();
            backupData.data.orders = orders;
            backupData.stats.totalOrders = orders.length;
        }

        if (collectionsToBackup.includes('budgets')) {
            const budgets = await Budget.find({}).lean();
            backupData.data.budgets = budgets;
            backupData.stats.totalBudgets = budgets.length;
        }

        if (collectionsToBackup.includes('meals')) {
            const meals = await Meal.find({}).lean();
            backupData.data.meals = meals;
            backupData.stats.totalMeals = meals.length;
        }

        // Save backup to file
        const backupDir = getBackupDir();
        const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const filepath = path.join(backupDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
        console.log(`[BackupScheduler] Backup saved to: ${filepath}`);

        // Update settings with last backup info
        settings.lastBackupAt = new Date();
        settings.lastBackupStatus = 'success';
        settings.lastBackupMessage = `Scheduled backup completed: ${collectionsToBackup.length} collections`;
        await settings.save();

        // Clean up old backups based on retention
        cleanOldBackups(settings.retentionDays);

        console.log("[BackupScheduler] Scheduled backup completed successfully");
    } catch (error) {
        console.error("[BackupScheduler] Backup failed:", error);

        try {
            const settings = await BackupSettings.getSettings();
            settings.lastBackupAt = new Date();
            settings.lastBackupStatus = 'failed';
            settings.lastBackupMessage = error.message;
            await settings.save();
        } catch (e) {
            console.error("[BackupScheduler] Failed to update backup status:", e);
        }
    }
};

// Clean up backups older than retention days
const cleanOldBackups = (retentionDays) => {
    try {
        const backupDir = getBackupDir();
        const files = fs.readdirSync(backupDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        files.forEach(file => {
            const filepath = path.join(backupDir, file);
            const stats = fs.statSync(filepath);
            if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filepath);
                console.log(`[BackupScheduler] Deleted old backup: ${file}`);
            }
        });
    } catch (error) {
        console.error("[BackupScheduler] Error cleaning old backups:", error);
    }
};

// Build cron expression from settings
const buildCronExpression = (schedule) => {
    const [hour, minute] = schedule.time.split(':').map(Number);

    switch (schedule.frequency) {
        case 'daily':
            return `${minute} ${hour} * * *`;
        case 'weekly':
            return `${minute} ${hour} * * ${schedule.dayOfWeek}`;
        case 'monthly':
            return `${minute} ${hour} ${schedule.dayOfMonth} * *`;
        default:
            return `${minute} ${hour} * * *`;
    }
};

// Schedule the backup job
export const scheduleBackup = async () => {
    try {
        const settings = await BackupSettings.getSettings();

        // Cancel existing job if any
        if (scheduledJob) {
            scheduledJob.stop();
            scheduledJob = null;
            console.log("[BackupScheduler] Cancelled existing scheduled backup");
        }

        if (!settings.autoBackupEnabled) {
            console.log("[BackupScheduler] Auto backup is disabled");
            return;
        }

        const cronExpression = buildCronExpression(settings.schedule);
        console.log(`[BackupScheduler] Scheduling backup with cron: ${cronExpression}`);

        scheduledJob = cron.schedule(cronExpression, runBackup, {
            timezone: "Asia/Manila" // Philippine timezone
        });

        console.log("[BackupScheduler] Backup scheduled successfully");
    } catch (error) {
        console.error("[BackupScheduler] Error scheduling backup:", error);
    }
};

// Initialize scheduler on server start
export const initBackupScheduler = async () => {
    console.log("[BackupScheduler] Initializing...");
    await scheduleBackup();
};

export default { initBackupScheduler, scheduleBackup, runBackup };
