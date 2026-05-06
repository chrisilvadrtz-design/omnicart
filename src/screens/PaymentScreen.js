import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { initializeStripe } from '../services/paymentService';

export default function PaymentScreen({ route, navigation }) {
  const total = route?.params?.total ?? 0.0;
  const user = route?.params?.user || { id: null, email: 'user@example.com', customerId: null };

  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [savedMethods, setSavedMethods] = useState([]);
  const [usingSavedMethod, setUsingSavedMethod] = useState(null);

  const { confirmPayment, confirmSetupIntent } = useStripe();

  useEffect(() => {
    initializeStripe();
    if (user?.customerId) fetchSavedMethods();
  }, []);

  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  const fetchSavedMethods = async () => {
    try {
      const resp = await fetch(`${apiBase}/saved-payment-methods?customerId=${user.customerId}`);
      const data = await resp.json();
      if (data?.paymentMethods) setSavedMethods(data.paymentMethods);
    } catch (e) {
      console.error('Error fetching saved methods', e);
    }
  };

  const fetchPaymentIntentClientSecret = async (amount, paymentMethodId, customerId) => {
    const resp = await fetch(`${apiBase}/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amount * 100), paymentMethodId, customerId }),
    });
    return resp.json();
  };

  const fetchSetupIntentClientSecret = async (customerId) => {
    const resp = await fetch(`${apiBase}/create-setup-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    });
    return resp.json();
  };

  const handleSaveCardAndAttach = async (setupClientSecret) => {
    // Confirm the SetupIntent on-device
    const { setupIntent, error } = await confirmSetupIntent(setupClientSecret, { paymentMethodType: 'Card' });

    if (error) {
      throw new Error(error.message);
    }

    // setupIntent.payment_method contains the saved payment_method id
    return setupIntent.payment_method;
  };

  const handlePayWithSavedMethod = async (methodId) => {
    setLoading(true);
    try {
      // Create a PaymentIntent server-side using saved payment method and customer
      const res = await fetchPaymentIntentClientSecret(total, methodId, user.customerId);
      const { clientSecret, paymentIntentId, error: serverError } = res;
      if (serverError) throw new Error(serverError);

      // Confirm payment using the saved method
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        type: 'Card',
        paymentMethodId: methodId,
      });

      if (error) throw new Error(error.message || 'Payment confirmation failed');

      // Record order server-side
      await fetch(`${apiBase}/record-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, items: route?.params?.items || [], total, storeId: route?.params?.storeId || null, paymentIntentId: paymentIntent?.id || paymentIntentId, paymentStatus: paymentIntent?.status || 'succeeded' }),
      });

      navigation.replace('PaymentSuccess', { orderId: paymentIntent?.id || paymentIntentId, total });
    } catch (e) {
      console.error('Saved method pay error', e);
      Alert.alert('Payment failed', e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!cardComplete && !usingSavedMethod) {
      Alert.alert('Incomplete card', 'Please enter all card details.');
      return;
    }

    setLoading(true);

    try {
      let paymentMethodId = null;

      // If user wants to save card, create SetupIntent first
      if (saveCard) {
        const setupResp = await fetchSetupIntentClientSecret(user.customerId);
        if (setupResp?.clientSecret) {
          const pmId = await handleSaveCardAndAttach(setupResp.clientSecret);

          // Notify backend to attach this PaymentMethod to customer record
          await fetch(`${apiBase}/attach-payment-method`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: user.customerId, paymentMethodId: pmId }),
          });

          paymentMethodId = pmId;
          // refresh saved methods list
          await fetchSavedMethods();
        }
      }

      // If not saving or after saving, create payment intent
      const res = await fetchPaymentIntentClientSecret(total, paymentMethodId, user.customerId);
      const { clientSecret, paymentIntentId, error: serverError } = res;
      if (serverError) throw new Error(serverError);

      // If we have a paymentMethodId (saved or from setup), confirm using it; otherwise confirm with card details
      let confirmResult;

      if (paymentMethodId) {
        confirmResult = await confirmPayment(clientSecret, {
          type: 'Card',
          paymentMethodId,
        });
      } else {
        confirmResult = await confirmPayment(clientSecret, {
          type: 'Card',
        });
      }

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message);
      }

      const paymentIntent = confirmResult.paymentIntent;

      // Record order server-side
      await fetch(`${apiBase}/record-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, items: route?.params?.items || [], total, storeId: route?.params?.storeId || null, paymentIntentId: paymentIntent?.id || paymentIntentId, paymentStatus: paymentIntent?.status || 'succeeded' }),
      });

      // Navigate to success
      navigation.replace('PaymentSuccess', { orderId: paymentIntent?.id || paymentIntentId, total });
    } catch (e) {
      console.error('Payment error', e);
      Alert.alert('Payment failed', e.message || 'An error occurred during payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Total</Text>
        <Text style={styles.amount}>${total.toFixed(2)}</Text>
      </View>

      {savedMethods.length > 0 && (
        <View style={styles.savedContainer}>
          <Text style={styles.sectionTitle}>Saved payment methods</Text>
          {savedMethods.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodRow, usingSavedMethod === m.id && styles.methodSelected]}
              onPress={() => setUsingSavedMethod(usingSavedMethod === m.id ? null : m.id)}
            >
              <Text style={styles.methodText}>{`•••• ${m.card.last4} • ${m.card.brand}`}</Text>
              {usingSavedMethod === m.id && <Text style={styles.selectedText}>Selected</Text>}
            </TouchableOpacity>
          ))}

          {usingSavedMethod && (
            <TouchableOpacity style={styles.paySavedButton} onPress={() => handlePayWithSavedMethod(usingSavedMethod)} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.paySavedText}>Pay ${total.toFixed(2)} with saved card</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.cardContainer}>
        <Text style={styles.label}>Card Details</Text>
        <CardField
          postalCodeEnabled={false}
          placeholders={{ number: '4242 4242 4242 4242' }}
          cardStyle={styles.cardStyle}
          style={styles.cardField}
          onCardChange={(card) => setCardComplete(card?.complete ?? false)}
        />

        <View style={styles.saveRow}>
          <Text style={styles.saveLabel}>Save card for later</Text>
          <Switch value={saveCard} onValueChange={setSaveCard} />
        </View>
      </View>

      <TouchableOpacity style={[styles.payButton, (!cardComplete && !usingSavedMethod) && styles.disabled]} onPress={handlePay} disabled={loading || (!cardComplete && !usingSavedMethod)}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Pay ${total.toFixed(2)}</Text>}
      </TouchableOpacity>

      <Text style={styles.note}>Note: Card details are sent directly to Stripe; Omnicart never stores raw card numbers.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f8f8' },
  summary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  summaryText: { fontSize: 16, color: '#666' },
  amount: { fontSize: 28, fontWeight: '700', marginTop: 6, color: '#000' },
  cardContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20 },
  label: { fontSize: 14, color: '#333', marginBottom: 8 },
  cardField: { height: 50 },
  cardStyle: { backgroundColor: '#FFFFFF', textColor: '#000000' },
  payButton: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  payButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { backgroundColor: '#9bbcff' },
  note: { marginTop: 12, color: '#666', fontSize: 12, textAlign: 'center' },
  saveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  saveLabel: { fontSize: 14, color: '#333' },
  savedContainer: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  methodRow: { paddingVertical: 10, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodText: { fontSize: 14, color: '#000' },
  methodSelected: { backgroundColor: '#E6F0FF', borderRadius: 8 },
  paySavedButton: { marginTop: 10, backgroundColor: '#34C759', padding: 12, borderRadius: 8, alignItems: 'center' },
  paySavedText: { color: '#fff', fontWeight: '700' },
  selectedText: { color: '#007AFF', fontWeight: '700' },
});
