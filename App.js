import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import AIAssistantScreen from './src/screens/AIAssistantScreen';
import StoreComparisonScreen from './src/screens/StoreComparisonScreen';
import CartScreen from './src/screens/CartScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import PaymentSuccessScreen from './src/screens/PaymentSuccessScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AI Assistant') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Stores') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          } else if (route.name === 'Cart') {
            iconName = focused ? 'cart' : 'cart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Omnicart' }} />
      <Tab.Screen name="AI Assistant" component={AIAssistantScreen} options={{ title: 'AI Shopping Assistant' }} />
      <Tab.Screen name="Stores" component={StoreComparisonScreen} options={{ title: 'Compare Prices' }} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ title: 'Your Cart' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile & Settings' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Checkout' }} />
        <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} options={{ title: 'Success' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
