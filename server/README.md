# Server README

This folder contains a minimal Express server to handle Stripe payment flows and record orders into Firestore.

Environment variables (set these on your server or locally):
- STRIPE_SECRET_KEY
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY (replace newlines with literal \n)
- PORT (optional)

Install & run:

cd server
npm install
npm start

Endpoints:
- POST /create-payment-intent { amount (cents), paymentMethodId (optional), customerId (optional) }
- POST /create-setup-intent { customerId (optional) }
- POST /attach-payment-method { customerId, paymentMethodId }
- GET  /saved-payment-methods?customerId=...
- POST /record-order { userId, items, total, storeId, paymentIntentId, paymentStatus }

Security:
- Keep STRIPE_SECRET_KEY and Firebase credentials server-side only.
- Use HTTPS in production.
