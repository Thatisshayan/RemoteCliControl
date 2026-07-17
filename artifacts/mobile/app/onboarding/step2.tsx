import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../constants/colors";
import { useRuntimeConfig } from "../../lib/runtime-config";

export default function BackendSetupScreen() {
  const router = useRouter();
  const { baseUrl, saveBaseUrl } = useRuntimeConfig();
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setUrl(baseUrl);
  }, [baseUrl]);

  const handleTest = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const base = url.replace(/\/+$/, "");
      const res = await fetch(`${base}/health`, { method: "GET", signal: controller.signal });
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      if (res.ok) {
        setTestResult({ success: true, message: `Connected (${latency}ms)` });
        setConnected(true);
      } else {
        setTestResult({ success: false, message: `Server returned ${res.status}` });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleContinue = async () => {
    if (!connected) return;
    const baseUrl = url.replace(/\/+$/, "");
    try {
      await saveBaseUrl(baseUrl);
      router.push("/onboarding/step3");
    } catch (err: any) {
      Alert.alert("Error", "Failed to save server URL. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Connect to Server</Text>
        <Text style={styles.body}>
          Run the server on your Windows PC and enter the URL below.
        </Text>

        <Text style={styles.label}>SERVER URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={(t) => { setUrl(t); setConnected(false); setTestResult(null); }}
          placeholder="https://xxxx.trycloudflare.com"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <TouchableOpacity
          style={styles.testBtn}
          onPress={handleTest}
          disabled={testing || !url.trim()}
        >
          {testing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.testBtnText}>Test Connection</Text>
          )}
        </TouchableOpacity>

        {testResult && (
          <View style={[styles.banner, testResult.success ? styles.successBanner : styles.errorBanner]}>
            <Feather name={testResult.success ? "check-circle" : "alert-circle"} size={16} color={testResult.success ? colors.primary : colors.destructive} />
            <Text style={[styles.bannerText, { color: testResult.success ? colors.primary : colors.destructive }]}>
              {testResult.message}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, !connected && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={!connected}
      >
        <Text style={[styles.continueBtnText, !connected && { color: colors.mutedForeground }]}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 60,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  body: {
    color: colors.mutedForeground,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 32,
    lineHeight: 20,
  },
  label: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    color: colors.foreground,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  testBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  testBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  successBanner: {
    backgroundColor: "rgba(0,255,136,0.1)",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  errorBanner: {
    backgroundColor: "rgba(255,68,68,0.1)",
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  bannerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  continueBtnDisabled: {
    backgroundColor: colors.card,
  },
  continueBtnText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
