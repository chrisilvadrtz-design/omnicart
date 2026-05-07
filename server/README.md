# Server README

This folder contains a minimal Express server to handle Stripe payment flows, compute prices and record orders into Firestore.

Environment variables (set these on your server or locally):
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET (recommended)
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY (replace newlines with literal \n)
- PORT (optional)

Install & run:

cd server
npm install
npm start

Notes on rate limiting and security
- The server applies basic rate-limiting (express-rate-limit) to sensitive endpoints (/me, /create-customer, /create-payment-intent) with default limits of 100 requests per 15 minutes per IP.
- Adjust the rate limits and add authentication as needed for production.

Endpoints:
- GET  /products
  - Returns product catalog: { products: [{ id, name, unitPrice, image }, ...] }
- POST /create-customer { email, name, userId }
  - Creates a Stripe Customer and persists stripeCustomerId to users/{userId} (if userId provided)
- GET  /user/:userId
  - Returns the user document from Firestore (including stripeCustomerId when present)
- GET  /me (authenticated)
  - Accepts Authorization: Bearer <Firebase ID token> and returns users/{uid}
- POST /create-payment-intent { amount (cents), currency (optional), paymentMethodId (optional), customerId (optional), items: [{id, quantity}], storeId }
  - Server computes unit prices using a product catalog and validates amount equals computed total
- POST /create-setup-intent { customerId (optional) }
- POST /attach-payment-method { customerId, paymentMethodId }
- GET  /saved-payment-methods?customerId=...
- POST /record-order { userId, items, total, storeId, paymentIntentId, paymentStatus }
- POST /webhook (Stripe webhook endpoint — set STRIPE_WEBHOOK_SECRET and register this endpoint in Stripe dashboard)

Security & notes:
- Keep STRIPE_SECRET_KEY and Firebase credentials server-side only. Do not commit to the repo.
- The product catalog in server/index.js is a mock. In production replace with real store API price lookups or a products DB.
- Use HTTPS for webhook endpoint and protect with STRIPE_WEBHOOK_SECRET.
- For client-side persistence of stripeCustomerId prefer secure storage (react-native-encrypted-storage) instead of AsyncStorage. The app includes migration to secure storage.
