import nodemailer from "nodemailer";

let transporter = null;

// Create transporter lazily to ensure env vars are loaded
const getTransporter = () => {
  if (!transporter) {
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.error("SMTP credentials not configured. Set SMTP_EMAIL and SMTP_PASSWORD in .env");
      return null;
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    console.log("SMTP transporter created for:", process.env.SMTP_EMAIL);
  }
  return transporter;
};

/**
 * Send an email using Gmail SMTP
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 */
export const sendEmail = async ({ to, subject, html }) => {
  const transport = getTransporter();

  if (!transport) {
    throw new Error("SMTP not configured");
  }

  const mailOptions = {
    from: `"MealChoice" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html,
  };

  console.log(`Sending email to: ${to}, subject: ${subject}`);

  try {
    const result = await transport.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("Email send failed:", error.message);
    throw error;
  }
};

/**
 * Send seller welcome email with temp password and verification link
 */
export const sendSellerWelcomeEmail = async ({ to, name, tempPassword, verificationToken }) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4CAF50;">Welcome to MealChoice!</h1>
      <p>Hi ${name},</p>
      <p>Your seller account has been created by our admin team. Here are your login credentials:</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> <code style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
      </div>
      
      <p>Please click the button below to verify your email and activate your account:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" 
           style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email & Activate Account
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This verification link will expire in 24 hours. After logging in, we recommend changing your password immediately.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        If you didn't expect this email, please ignore it.
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Welcome to MealChoice - Verify Your Seller Account",
    html,
  });
};

/**
 * Send low stock warning email to seller
 */
export const sendLowStockEmail = async ({ to, productName, currentStock, threshold }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ff9800;">⚠️ Low Stock Warning</h1>
      <p>Your product <strong>${productName}</strong> is running low on stock.</p>
      
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
        <p><strong>Current Stock:</strong> ${currentStock}</p>
        <p><strong>Low Stock Threshold:</strong> ${threshold}</p>
      </div>
      
      <p>Please restock this item soon to avoid running out.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/seller/products" 
           style="background: #ff9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Manage Products
        </a>
      </div>
    </div>
  `;

  await sendEmail({
    to,
    subject: `Low Stock Alert: ${productName}`,
    html,
  });
};

/**
 * Send verification email to a customer after registration
 */
export const sendCustomerVerificationEmail = async ({ to, name, verificationToken }) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4CAF50;">Welcome to MealChoice!</h1>
      <p>Hi ${name},</p>
      <p>Thank you for registering with MealChoice. Please verify your email address to activate your account.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" 
           style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This verification link will expire in 24 hours.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        If you didn't create an account with MealChoice, please ignore this email.
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Verify Your MealChoice Account",
    html,
  });
};
