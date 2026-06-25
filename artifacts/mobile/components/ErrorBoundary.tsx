import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../constants/colors";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: string | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 20 },
  title: { color: colors.destructive, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  message: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
});
