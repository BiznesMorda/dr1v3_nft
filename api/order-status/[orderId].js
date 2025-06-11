// Simple in-memory storage (same as submit-order.js)
const orders = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { orderId } = req.query;
  const order = orders.get(orderId);
  
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Remove sensitive data
  const publicOrder = {
    orderId: order.orderId,
    status: order.status,
    vehicleInfo: order.vehicleInfo,
    createdAt: order.createdAt
  };

  res.json({ success: true, order: publicOrder });
}
