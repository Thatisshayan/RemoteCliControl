import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { colors } from "../constants/colors";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: string | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleRetry = () => {
    // A plain re-render doesn't help if the crash was caused by cached state
    // (a bad server URL or stale token) — retrying with the same state just
    // reproduces the same error. This clears connection settings too, so a
    // retry actually has a chance of succeeding.
    this.setState({ hasError: false, error: null });
  };

  handleResetConnection = async () => {
    try {
      await AsyncStorage.removeItem("server-url");
      await SecureStore.deleteItemAsync("api-token");
    } catch (err) {
      console.warn("Failed to clear connection settings:", err);
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={this.handleResetConnection}>
            <Text style={styles.resetText}>Reset Connection Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 20 },
  title: { color: colors.destructive, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  message: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  retryText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16 },
  resetBtn: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 24 },
  resetText: { color: colors.mutedForeground, fontWeight: "600", fontSize: 14 },
});
