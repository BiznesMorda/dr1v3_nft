const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Simple in-memory storage (replace with database in production)
const orders = new Map();

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const {
      sessionId,
      customerName,
      email,
      phone,
      vehicleInfo,
      specialInstructions,
      deliveryPreference,
      photoData // Base64 encoded photos or URLs
    } = req.body;

    // Verify the payment session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment not verified' });
    }

    const orderId = `DR1V3-${uuidv4().substr(0, 8).toUpperCase()}`;
    
    // Store order data
    const orderData = {
      orderId,
      sessionId,
      customerName,
      email,
      phone,
      vehicleInfo: typeof vehicleInfo === 'string' ? JSON.parse(vehicleInfo) : vehicleInfo,
      specialInstructions,
      deliveryPreference,
      photoData,
      status: 'submitted',
      createdAt: new Date()
    };

    orders.set(orderId, orderData);

    // Send confirmation emails
    await sendConfirmationEmail(orderData);
    await sendInternalNotification(orderData);

    res.json({
      success: true,
      orderId,
      message: 'Order submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function sendConfirmationEmail(orderData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: orderData.email,
    subject: `DR1V3 Order Confirmation - ${orderData.orderId}`,
    html: `
      <h2>Thank you for your DR1V3 order!</h2>
      <p>Hi ${orderData.customerName},</p>
      <p>We've received your order and will begin processing your vehicle's 3D model.</p>
      
      <h3>Order Details:</h3>
      <ul>
        <li><strong>Order ID:</strong> ${orderData.orderId}</li>
        <li><strong>Vehicle:</strong> ${orderData.vehicleInfo.year} ${orderData.vehicleInfo.make} ${orderData.vehicleInfo.model}</li>
        <li><strong>Delivery Method:</strong> ${orderData.deliveryPreference}</li>
      </ul>
      
      <h3>What's Next?</h3>
      <ol>
        <li>Our team will review your photos within 24 hours</li>
        <li>We'll begin the 3D modeling process</li>
        <li>You'll receive progress updates via email</li>
        <li>Your digital twin will be ready in 5-7 business days</li>
      </ol>
      
      <p>Questions? Reply to this email or contact us at hello@dr1v3.com</p>
      
      <p>Best regards,<br>The DR1V3 Team</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function sendInternalNotification(orderData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'orders@dr1v3.com',
    subject: `New DR1V3 Order - ${orderData.orderId}`,
    html: `
      <h2>New Order Received</h2>
      
      <h3>Customer Info:</h3>
      <ul>
        <li><strong>Name:</strong> ${orderData.customerName}</li>
        <li><strong>Email:</strong> ${orderData.email}</li>
        <li><strong>Phone:</strong> ${orderData.phone}</li>
      </ul>
      
      <h3>Vehicle Details:</h3>
      <ul>
        <li><strong>Make/Model:</strong> ${orderData.vehicleInfo.year} ${orderData.vehicleInfo.make} ${orderData.vehicleInfo.model}</li>
        <li><strong>Color:</strong> ${orderData.vehicleInfo.color}</li>
        <li><strong>VIN:</strong> ${orderData.vehicleInfo.vin}</li>
      </ul>
      
      <h3>Order Info:</h3>
      <ul>
        <li><strong>Order ID:</strong> ${orderData.orderId}</li>
        <li><strong>Special Instructions:</strong> ${orderData.specialInstructions || 'None'}</li>
        <li><strong>Delivery Preference:</strong> ${orderData.deliveryPreference}</li>
      </ul>
    `
  };

  await transporter.sendMail(mailOptions);
}
