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
 * Send new order notification email to seller
 */
export const sendNewOrderEmail = async ({ to, sellerName, orderId, buyerName, items, total, marketLocation }) => {
  const itemsList = items.map(item =>
    `<tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity} ${item.unit}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₱${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4CAF50;">🛒 New Order Received!</h1>
      <p>Hi ${sellerName},</p>
      <p>Great news! You have received a new order from <strong>${buyerName}</strong>.</p>
      
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px;"><strong>Order ID:</strong> ${orderId}</p>
        <p style="margin: 0;"><strong>Market Location:</strong> ${marketLocation}</p>
      </div>
      
      <h3 style="color: #333; margin-top: 24px;">Order Items</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: center;">Quantity</th>
            <th style="padding: 10px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
        <tfoot>
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td colspan="2" style="padding: 12px;">Total</td>
            <td style="padding: 12px; text-align: right;">₱${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/seller/orders" 
           style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Order Details
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        Please review the order and update its status as you prepare it.
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject: `New Order #${orderId.toString().slice(-6).toUpperCase()} - ${items.length} item(s)`,
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

/**
 * Send seller deactivation notification email
 * @param {Object} options - Email options
 * @param {string} options.to - Seller's email
 * @param {string} options.name - Seller's name
 * @param {string} options.adminEmail - Admin email to contact for reactivation
 */
export const sendSellerDeactivationEmail = async ({ to, name, adminEmail }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #DC2626;">Account Deactivated</h1>
      <p>Hi ${name},</p>
      <p>Your MealChoice seller account has been deactivated by an administrator.</p>
      
      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #DC2626; margin-top: 0;">What does this mean?</h3>
        <ul style="color: #7F1D1D;">
          <li>Your products are no longer visible to customers</li>
          <li>You cannot receive new orders</li>
          <li>You cannot access your seller dashboard</li>
        </ul>
      </div>
      
      <p><strong>To reactivate your account:</strong></p>
      <p>Please contact the administrator by sending an email to:</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="mailto:${adminEmail}?subject=Request%20to%20Reactivate%20Seller%20Account" 
           style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Contact Admin
        </a>
      </div>
      
      <p style="color: #666;">Or email directly: <a href="mailto:${adminEmail}">${adminEmail}</a></p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        This is an automated message from MealChoice. Please do not reply to this email.
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Your MealChoice Seller Account Has Been Deactivated",
    html,
  });
};

/**
 * Send verification email to a sub-admin after account creation
 */
export const sendAdminVerificationEmail = async ({ to, name, verificationToken }) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4CAF50;">Welcome to MealChoice Admin!</h1>
      <p>Hi ${name},</p>
      <p>You have been added as a sub-administrator on MealChoice. Please verify your email address to activate your account.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" 
           style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email & Activate Account
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This verification link will expire in 24 hours.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        If you didn't expect this email, please contact your administrator.
      </p>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Verify Your MealChoice Admin Account",
    html,
  });
};

