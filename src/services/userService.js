import EncryptedStorage from 'react-native-encrypted-storage';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const getStoredStripeCustomerId = async () => {
  try {
    const val = await EncryptedStorage.getItem('stripeCustomerId');
    return val;
  } catch (e) {
    console.warn('Error reading stripeCustomerId from secure storage', e);
    return null;
  }
};

export const setStoredStripeCustomerId = async (id) => {
  try {
    if (id) {
      await EncryptedStorage.setItem('stripeCustomerId', id);
    } else {
      await EncryptedStorage.removeItem('stripeCustomerId');
    }
  } catch (e) {
    console.warn('Error writing stripeCustomerId to secure storage', e);
  }
};

export const clearStoredStripeCustomerId = async () => {
  try {
    await EncryptedStorage.removeItem('stripeCustomerId');
  } catch (e) {
    console.warn('Error clearing stripeCustomerId from secure storage', e);
  }
};

// Fetch /me from backend using Firebase ID token (Bearer) and persist the returned stripeCustomerId
export const fetchMeAndPersist = async (idToken) => {
  try {
    if (!idToken) return null;
    const resp = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      console.warn('fetchMeAndPersist: server returned', resp.status);
      return null;
    }

    const data = await resp.json();
    const user = data?.user || null;
    if (user?.stripeCustomerId) {
      await setStoredStripeCustomerId(user.stripeCustomerId);
    }
    return user;
  } catch (e) {
    console.warn('fetchMeAndPersist error', e.message || e);
    return null;
  }
};

export default {
  getStoredStripeCustomerId,
  setStoredStripeCustomerId,
  clearStoredStripeCustomerId,
  fetchMeAndPersist,
};
