import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getFirebaseAuth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import userService from '../services/userService';

export default function ProfileScreen() {
  const auth = getFirebaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stripeStatus, setStripeStatus] = useState(null);

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken(true);
      await userService.fetchMeAndPersist(idToken);
      setStripeStatus('Fetched /me and persisted stripeCustomerId (if present)');
      Alert.alert('Signup successful');
    } catch (e) {
      console.error('signup error', e);
      Alert.alert('Signup failed', e.message || e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken(/* forceRefresh */ true);
      const user = await userService.fetchMeAndPersist(idToken);
      setStripeStatus(user?.stripeCustomerId ? 'Stripe customer available' : 'No stripeCustomerId yet');
      Alert.alert('Sign-in successful');
    } catch (e) {
      console.error('signin error', e);
      Alert.alert('Sign-in failed', e.message || e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      await userService.clearStoredStripeCustomerId();
      setStripeStatus(null);
      Alert.alert('Signed out');
    } catch (e) {
      console.error('signout error', e);
      Alert.alert('Sign-out failed', e.message || e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile & Account</Text>

      <View style={styles.form}>
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />

        <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.signout]} onPress={handleSignOut} disabled={loading}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.status}>{stripeStatus}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f8f8' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  form: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  secondary: { backgroundColor: '#34C759' },
  signout: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#fff', fontWeight: '700' },
  status: { marginTop: 12, color: '#666' },
});
