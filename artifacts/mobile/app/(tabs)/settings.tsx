import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { HealthResponseSchema, TunnelStatusResponseSchema } from "@remotectrl/api-zod";
import { publicApi } from "@remotectrl/api-client-react";
import { colors } from "../../constants/colors";
import { useRuntimeConfig } from "../../lib/runtime-config";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    baseUrl,
    apiToken,
    saveBaseUrl,
    saveApiToken,
    clearLocalState,
  } = useRuntimeConfig();
  const [serverUrl, setServerUrl] = useState(baseUrl);
  const [tokenInput, setTokenInput] = useState(apiToken);
  const [showToken, setShowToken] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [fontSize, setFontSizeState] = useState(12);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [health, setHealth] = useState<ReturnType<typeof HealthResponseSchema.parse> | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<ReturnType<typeof TunnelStatusResponseSchema.parse> | null>(null);

  useEffect(() => {
    setServerUrl(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    setTokenInput(apiToken);
  }, [apiToken]);

  useEffect(() => {
    AsyncStorage.multiGet(["biometric-lock", "terminal-font-size"]).then((values) => {
      for (const [key, val] of values) {
        if (key === "terminal-font-size" && val) setFontSizeState(Number(val));
        if (key === "biometric-lock") setBiometricEnabled(val === "true");
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    const refreshStatus = async () => {
      try {
        const [healthResponse, tunnelResponse] = await Promise.all([
          publicApi.get("/health", undefined, HealthResponseSchema),
          publicApi.get("/tunnel-url", undefined, TunnelStatusResponseSchema),
        ]);
        if (!active) return;
        setHealth(healthResponse);
        setTunnelStatus(tunnelResponse);
      } catch {
        if (!active) return;
        setHealth(null);
        setTunnelStatus(null);
      }
    };
    refreshStatus().catch(() => {});
    const interval = setInterval(() => {
      refreshStatus().catch(() => {});
    }, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [baseUrl]);

  const handleSaveUrl = async () => {
    const url = serverUrl.replace(/\/+$/, "");
    await saveBaseUrl(url);
    Alert.alert("Saved", "Server URL updated");
  };

  const handleSaveToken = async () => {
    await saveApiToken(tokenInput);
    Alert.alert("Saved", "API token updated");
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const base = serverUrl.replace(/\/+$/, "");
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        setTestResult("Connection successful");
      } else {
        setTestResult(`Server returned ${response.status}`);
      }
    } catch (err: any) {
      setTestResult(err?.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricEnabled(value);
    await AsyncStorage.setItem("biometric-lock", value ? "true" : "false");
  };

  const handleFontSizeChange = async (value: number) => {
    const clamped = Math.max(8, Math.min(20, value));
    setFontSizeState(clamped);
    await AsyncStorage.setItem("terminal-font-size", String(clamped));
  };

  const handleClearData = () => {
    Alert.alert("Clear Local Data", "This will reset all settings and sign you out.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearLocalState();
          router.replace("/onboarding");
        },
      },
    ]);
  };

  const uptime = health?.uptimeSeconds;
  const activeSessions = health?.activeSessions;
  const tunnelUrl = tunnelStatus?.tunnelUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <Text style={styles.label}>BACKEND URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://localhost:3000"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleTestConnection} disabled={testing}>
            {testing ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.secondaryBtnText}>Test</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveUrl}>
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
        {testResult && (
          <Text style={[styles.resultText, testResult === "Connection successful" ? styles.successText : styles.errorText]}>
            {testResult}
          </Text>
        )}

        <Text style={styles.label}>API TOKEN</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Bearer token"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showToken}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowToken(!showToken)} style={styles.eyeBtn}>
            <Feather name={showToken ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveToken}>
          <Text style={styles.primaryBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Remote Access</Text>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: tunnelStatus?.active ? colors.primary : colors.mutedForeground }]} />
            <Text style={styles.statusLabel}>{tunnelStatus?.active ? "Connected" : "Inactive"}</Text>
          </View>
          {tunnelUrl ? (
            <TouchableOpacity onPress={() => Alert.alert("Tunnel URL", tunnelUrl)}>
              <Text style={styles.tunnelUrl} numberOfLines={1}>{tunnelUrl}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.helperText}>Cloudflare Tunnel is not active on this server.</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Biometric Lock (stored preference only)</Text>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.foreground}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        <View style={styles.serverCard}>
          <Text style={styles.helperText}>
            Push notifications are unavailable in the current stabilization build and are intentionally hidden from active use.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Terminal</Text>
        <Text style={styles.label}>FONT SIZE: {fontSize}px</Text>
        <View style={styles.sliderRow}>
          <TouchableOpacity onPress={() => handleFontSizeChange(fontSize - 1)} style={styles.sliderBtn}>
            <Text style={styles.sliderBtnText}>A-</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((fontSize - 8) / 12) * 100}%` }]} />
          </View>
          <TouchableOpacity onPress={() => handleFontSizeChange(fontSize + 1)} style={styles.sliderBtn}>
            <Text style={styles.sliderBtnText}>A+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server Status</Text>
        <View style={styles.serverCard}>
          <View style={styles.serverRow}>
            <Text style={styles.serverLabel}>Status</Text>
            <Text style={[styles.serverValue, { color: health ? colors.primary : colors.destructive }]}>
              {health ? "Online" : "Offline"}
            </Text>
          </View>
          {uptime !== undefined && (
            <View style={styles.serverRow}>
              <Text style={styles.serverLabel}>Uptime</Text>
              <Text style={styles.serverValue}>
                {Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m
              </Text>
            </View>
          )}
          {activeSessions !== undefined && (
            <View style={styles.serverRow}>
              <Text style={styles.serverLabel}>Active Sessions</Text>
              <Text style={styles.serverValue}>{activeSessions}</Text>
            </View>
          )}
          {health?.version && (
            <View style={styles.serverRow}>
              <Text style={styles.serverLabel}>Server Version</Text>
              <Text style={styles.serverValue}>{health.version}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <View style={styles.serverRow}>
            <Text style={styles.serverLabel}>App Version</Text>
            <Text style={styles.serverValue}>1.0.0</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.destructiveBtn} onPress={handleClearData}>
          <Text style={styles.destructiveBtnText}>Clear Local Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { paddingTop: 50, marginBottom: 20 },
  headerTitle: { color: colors.foreground, fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  section: { marginBottom: 28 },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  label: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { padding: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", flex: 1 },
  primaryBtnText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  secondaryBtn: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", flex: 1 },
  secondaryBtnText: { color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  resultText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },
  successText: { color: colors.primary },
  errorText: { color: colors.destructive },
  statusCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_500Medium" },
  tunnelUrl: { color: colors.primary, fontSize: 13, fontFamily: "Inter_400Regular" },
  helperText: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  toggleLabel: { color: colors.foreground, fontSize: 15, flex: 1, fontFamily: "Inter_400Regular" },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sliderBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
  sliderBtnText: { color: colors.foreground, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  sliderTrack: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2 },
  sliderFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  serverCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  serverRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  serverLabel: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
  serverValue: { color: colors.foreground, fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  aboutCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  destructiveBtn: { backgroundColor: "rgba(255,68,68,0.1)", borderWidth: 1, borderColor: colors.destructive, borderRadius: 8, padding: 14, alignItems: "center" },
  destructiveBtnText: { color: colors.destructive, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
