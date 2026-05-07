// src/services/userService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const getStoredStripeCustomerId = async () => {
  try {
    return await AsyncStorage.getItem('stripeCustomerId');
  } catch (e) {
    console.warn('Error reading stripeCustomerId from storage', e);
    return null;
  }
};

export const setStoredStripeCustomerId = async (id) => {
  try {
    if (id) await AsyncStorage.setItem('stripeCustomerId', id);
  } catch (e) {
    console.warn('Error writing stripeCustomerId to storage', e);
  }
};

// Fetch /me from backend using Firebase ID token (Bearer)
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
  fetchMeAndPersist,
};
