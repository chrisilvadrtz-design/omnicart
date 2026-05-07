const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

// Initialize Firebase Admin
const initFirebase = () => {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase credentials are not fully set in env; Firestore operations will fail until configured.');
    }

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
// We need raw body for Stripe signature verification on webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    bodyParser.raw({ type: 'application/json' })(req, res, next);
  } else {
    bodyParser.json()(req, res, next);
  }
});

// Simple product catalog for server-side price lookup (unitPrice in cents)
const productCatalog = {
  milk_1l: { id: 'milk_1l', name: 'Organic Milk 1L', unitPrice: 399, image: '/images/milk.png' },
  bread_ww: { id: 'bread_ww', name: 'Whole Wheat Bread', unitPrice: 249, image: '/images/bread.png' },
  eggs_12: { id: 'eggs_12', name: 'Free Range Eggs (12)', unitPrice: 499, image: '/images/eggs.png' },
  apple: { id: 'apple', name: 'Apple', unitPrice: 99, image: '/images/apple.png' },
  chicken_1kg: { id: 'chicken_1kg', name: 'Chicken 1kg', unitPrice: 799, image: '/images/chicken.png' },
};

// Utility: compute total from items array using productCatalog
// items expected: [{ id: productId, quantity }]
const computeItemsTotal = (items = []) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const product = productCatalog[it.id];
    const unit = product ? Number(product.unitPrice) : 0; // cents
    const qty = Number(it.quantity) || 0;
    return sum + unit * qty;
  }, 0);
};

// GET /products - returns product catalog (array)
app.get('/products', (req, res) => {
  try {
    const products = Object.values(productCatalog).map(p => ({ id: p.id, name: p.name, unitPrice: p.unitPrice, image: p.image }));
    res.json({ products });
  } catch (err) {
    console.error('products error', err);
    res.status(500).json({ error: err.message });
  }
});

// Create Stripe Customer and store mapping in Firestore
app.post('/create-customer', async (req, res) => {
  try {
    const { email, name, userId } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    // Create customer in Stripe
    const customer = await stripe.customers.create({ email, name });

    // Store mapping in Firestore (customers collection)
    try {
      await db.collection('customers').doc(customer.id).set({
        stripeCustomerId: customer.id,
        userId: userId || null,
        email: email,
        name: name || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (fireErr) {
      console.warn('Could not write customer mapping to Firestore (customers):', fireErr.message);
    }

    // Also persist stripeCustomerId on user's Firestore document if userId provided
    if (userId) {
      try {
        await db.collection('users').doc(userId).set({
          stripeCustomerId: customer.id,
          email: email,
          name: name || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (userErr) {
        console.warn('Could not write stripeCustomerId to users collection:', userErr.message);
      }
    }

    res.json({ customerId: customer.id });
  } catch (err) {
    console.error('create-customer error', err);
    res.status(500).json({ error: err.message });
  }
});

// Create PaymentIntent with server-side validation of items via productCatalog
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', paymentMethodId, customerId, items, storeId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required for server-side validation' });
    }

    // Server-side validation: compute expected total from product catalog (in cents)
    const computedTotal = computeItemsTotal(items);

    if (!amount || Number(amount) !== computedTotal) {
      return res.status(400).json({ error: 'Amount mismatch', details: { computedTotal, providedAmount: amount } });
    }

    const params = {
      amount: computedTotal,
      currency,
      payment_method_types: ['card'],
    };

    if (customerId) params.customer = customerId;
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
      params.confirm = true; // attempt immediate confirmation when using saved method
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, status: paymentIntent.status });
  } catch (err) {
    console.error('create-payment-intent error', err);
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
    console.error('create-setup-intent error', err);
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
    console.error('attach-payment-method error', err);
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
    console.error('saved-payment-methods error', err);
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook endpoint to update order statuses
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // If no webhook signing secret provided, try to parse the body (unsafe for production)
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      const paymentIntentId = intent.id;
      console.log('PaymentIntent was successful:', paymentIntentId);

      // Update Firestore order with this paymentIntentId
      try {
        const ordersRef = db.collection('orders');
        const snapshot = await ordersRef.where('paymentIntentId', '==', paymentIntentId).get();
        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            doc.ref.update({ paymentStatus: 'succeeded', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          });
        }
      } catch (e) {
        console.error('Error updating order status on success webhook:', e.message);
      }

      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      const paymentIntentId = intent.id;
      console.log('PaymentIntent failed:', paymentIntentId);

      try {
        const ordersRef = db.collection('orders');
        const snapshot = await ordersRef.where('paymentIntentId', '==', paymentIntentId).get();
        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            doc.ref.update({ paymentStatus: 'failed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          });
        }
      } catch (e) {
        console.error('Error updating order status on failed webhook:', e.message);
      }

      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

// Record order in Firestore
app.post('/record-order', async (req, res) => {
  try {
    const { userId, items, total, storeId, paymentIntentId, paymentStatus } = req.body;

    // Basic validation
    if (!paymentIntentId) return res.status(400).json({ error: 'Missing paymentIntentId' });
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Missing items' });

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
    console.error('record-order error', err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
