import mongoose from "mongoose";

const backupSettingsSchema = new mongoose.Schema({
    // Singleton pattern - only one settings document
    singleton: {
        type: Boolean,
        default: true,
        unique: true
    },

    // Auto backup configuration
    autoBackupEnabled: {
        type: Boolean,
        default: false
    },

    // Schedule configuration
    schedule: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'daily'
        },
        time: {
            type: String,
            default: '02:00' // HH:MM format, default 2 AM
        },
        dayOfWeek: {
            type: Number,
            min: 0,
            max: 6,
            default: 0 // Sunday
        },
        dayOfMonth: {
            type: Number,
            min: 1,
            max: 28,
            default: 1
        }
    },

    // Collections to backup
    selectedCollections: {
        type: [String],
        enum: ['users', 'products', 'orders', 'budgets', 'meals'],
        default: ['users', 'products', 'orders', 'budgets', 'meals']
    },

    // Backup history tracking
    lastBackupAt: {
        type: Date,
        default: null
    },
    lastBackupStatus: {
        type: String,
        enum: ['success', 'failed', null],
        default: null
    },
    lastBackupMessage: {
        type: String,
        default: null
    },

    // Retention settings
    retentionDays: {
        type: Number,
        default: 30 // Keep backups for 30 days
    }
}, {
    timestamps: true
});

// Static method to get or create settings
backupSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne({ singleton: true });
    if (!settings) {
        settings = await this.create({ singleton: true });
    }
    return settings;
};

const BackupSettings = mongoose.model("BackupSettings", backupSettingsSchema);

export default BackupSettings;
