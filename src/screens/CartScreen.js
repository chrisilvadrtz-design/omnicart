import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CartScreen({ navigation }) {
  // Note: productId values should match server product catalog keys
  const [user, setUser] = useState({ id: 'user_123', email: 'user@example.com', name: 'John Doe', customerId: null });

  const [cartItems, setCartItems] = useState([
    { id: '1', productId: 'milk_1l', name: 'Organic Milk', price: 399, quantity: 2 },
    { id: '2', productId: 'bread_ww', name: 'Whole Wheat Bread', price: 249, quantity: 1 },
    { id: '3', productId: 'eggs_12', name: 'Free Range Eggs', price: 499, quantity: 1 },
  ]);

  const calculateTotal = () => {
    return (
      cartItems.reduce((total, item) => total + (item.price * item.quantity) / 100, 0)
    ).toFixed(2);
  };

  const updateQuantity = (id, newQuantity) => {
    if (newQuantity === 0) {
      setCartItems(cartItems.filter(item => item.id !== id));
    } else {
      setCartItems(cartItems.map(item =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const handleCheckout = async () => {
    // Before navigating, ensure we have a Stripe customerId for this user.
    // If not, call the server to create one. Then navigate to Payment with items and user info.
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3000';

    let updatedUser = { ...user };

    try {
      if (!user.customerId) {
        const resp = await fetch(`${apiBase}/create-customer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.name, userId: user.id }),
        });
        const data = await resp.json();
        if (data?.customerId) {
          updatedUser.customerId = data.customerId;
          setUser(updatedUser);
        }
      }
    } catch (e) {
      console.warn('Could not create or fetch customerId:', e.message || e);
    }

    // Prepare items in the format expected by server: [{ id: productId, quantity }]
    const itemsForServer = cartItems.map(ci => ({ id: ci.productId, quantity: ci.quantity }));

    navigation.navigate('Payment', { items: itemsForServer, total: parseFloat(calculateTotal()), user: updatedUser, storeId: 'freshmart' });
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>${(item.price / 100).toFixed(2)}</Text>
      </View>
      <View style={styles.quantityControl}>
        <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)}>
          <Ionicons name="remove-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)}>
          <Ionicons name="add-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>${((item.price * item.quantity) / 100).toFixed(2)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.storeSelector}>
          <Text style={styles.label}>Shopping at:</Text>
          <View style={styles.storeButton}>
            <Text style={styles.storeButtonText}>FreshMart</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </View>
        </View>

        <View style={styles.itemsContainer}>
          <Text style={styles.sectionTitle}>Items ({cartItems.length})</Text>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>${calculateTotal()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax:</Text>
            <Text style={styles.summaryValue}>${(parseFloat(calculateTotal()) * 0.08).toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>${(parseFloat(calculateTotal()) * 1.08).toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.checkoutButton}
        onPress={handleCheckout}
      >
        <Ionicons name="card" size={20} color="#fff" />
        <Text style={styles.checkoutButtonText}>Proceed to Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  storeSelector: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  storeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  storeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  itemsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  itemPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    minWidth: 50,
    textAlign: 'right',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTopMargin: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
  },
  checkoutButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    margin: 15,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
