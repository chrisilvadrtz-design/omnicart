import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function PaymentSuccessScreen({ route, navigation }) {
  const { orderId, total } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Successful</Text>
      <Text style={styles.subtitle}>Thank you for your order!</Text>

      {orderId && (
        <View style={styles.card}>
          <Text style={styles.label}>Order ID</Text>
          <Text style={styles.value}>{orderId}</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Total Paid</Text>
          <Text style={styles.value}>${(total || 0).toFixed(2)}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f8f8', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#34C759', marginTop: 60 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 10 },
  card: { width: '100%', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginTop: 24 },
  label: { fontSize: 12, color: '#888' },
  value: { fontSize: 18, color: '#000', fontWeight: '700', marginTop: 6 },
  homeButton: { marginTop: 30, backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 },
  homeButtonText: { color: '#fff', fontWeight: '700' },
});
