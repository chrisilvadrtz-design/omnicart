const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin
const initFirebase = () => {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
};

initFirebase();
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Create PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', paymentMethodId, customerId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const params = {
      amount,
      currency,
      payment_method_types: ['card'],
    };

    if (customerId) params.customer = customerId;
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
      params.confirm = true; // attempt to confirm immediately with saved method
    }

    const paymentIntent = await stripe.paymentIntents.create(params);
    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, status: paymentIntent.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create SetupIntent to save card
app.post('/create-setup-intent', async (req, res) => {
  try {
    const { customerId } = req.body;
    const params = {};
    if (customerId) params.customer = customerId;
    const setupIntent = await stripe.setupIntents.create(params);
    res.json({ clientSecret: setupIntent.client_secret, setupIntentId: setupIntent.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Attach payment method to customer
app.post('/attach-payment-method', async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;
    if (!customerId || !paymentMethodId) return res.status(400).json({ error: 'Missing params' });

    // Attach
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    // Optionally set as default
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List saved payment methods for a customer
app.get('/saved-payment-methods', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

    const paymentMethods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    res.json({ paymentMethods: paymentMethods.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Record order in Firestore
app.post('/record-order', async (req, res) => {
  try {
    const { userId, items, total, storeId, paymentIntentId, paymentStatus } = req.body;
    const order = {
      userId: userId || null,
      items: items || [],
      total: total || 0,
      storeId: storeId || null,
      paymentIntentId: paymentIntentId || null,
      paymentStatus: paymentStatus || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('orders').add(order);
    res.json({ success: true, orderId: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
