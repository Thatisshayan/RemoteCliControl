import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { setBaseUrl, setApiToken, getBaseUrl } from "@remotectrl/api-client-react";
import { colors } from "../../constants/colors";
import { getStoredApiToken, setStoredApiToken } from "../../lib/secure-token";

export default function SettingsScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState("");
  const [apiToken, setApiTokenState] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [fontSize, setFontSizeState] = useState(12);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [health, setHealth] = useState<{ tunnelUrl?: string; uptimeSeconds?: number; activeSessions?: number } | null>(null);
  const [pushPerms, setPushPerms] = useState<{ sessionDisconnected: boolean; serverHealthChange: boolean } | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) setHealth(await res.json());
    } catch (err: any) {
      console.warn("Failed to fetch health:", err?.message);
    }
  }, []);

  const fetchPushPreferences = useCallback(async () => {
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/push/preferences`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) setPushPerms(await res.json());
    } catch (err: any) {
      console.warn("Failed to fetch push preferences:", err?.message);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.multiGet(["server-url", "biometric-lock", "terminal-font-size"]).then((values) => {
      for (const [key, val] of values) {
        if (key === "server-url" && val) setServerUrl(val);
        if (key === "terminal-font-size" && val) setFontSizeState(Number(val));
        if (key === "biometric-lock") setBiometricEnabled(val === "true");
      }
    });
    getStoredApiToken().then((val) => {
      if (val) setApiTokenState(val);
    });
    fetchHealth();
    fetchPushPreferences();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchPushPreferences]);

  const handleSaveUrl = async () => {
    const url = serverUrl.replace(/\/+$/, "");
    await AsyncStorage.setItem("server-url", url);
    setBaseUrl(url);
    Alert.alert("Saved", "Server URL updated");
  };

  const handleSaveToken = async () => {
    await setStoredApiToken(apiToken);
    setApiToken(apiToken);
    Alert.alert("Saved", "API token updated");
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setTestResult("Connection successful");
      } else {
        setTestResult(`Server returned ${res.status}`);
      }
    } catch (err: any) {
      setTestResult(err?.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const handleBiometricToggle = async (val: boolean) => {
    setBiometricEnabled(val);
    await AsyncStorage.setItem("biometric-lock", val ? "true" : "false");
  };

  const handleFontSizeChange = async (val: number) => {
    const clamped = Math.max(8, Math.min(20, val));
    setFontSizeState(clamped);
    await AsyncStorage.setItem("terminal-font-size", String(clamped));
  };

  const handlePushPrefToggle = async (key: string, value: boolean) => {
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/push/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) setPushPerms(await res.json());
    } catch (err: any) {
      console.warn("Failed to update push preference:", err?.message);
    }
  };

  const handlePushPreferenceToggle = async (key: "sessionDisconnected" | "serverHealthChange", val: boolean) => {
    setPushPerms((prev) => prev ? { ...prev, [key]: val } : { sessionDisconnected: true, serverHealthChange: true });
    try {
      const base = getBaseUrl();
      await fetch(`${base}/api/push/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: val }),
      });
    } catch (err: any) {
      console.warn("Failed to update push preference:", err?.message);
    }
  };

  const handleClearData = () => {
    Alert.alert("Clear Local Data", "This will reset all settings and sign you out.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/onboarding");
        },
      },
    ]);
  };

  const tunnelUrl = health?.tunnelUrl as string | undefined;
  const uptime = health?.uptimeSeconds as number | undefined;
  const activeSessions = health?.activeSessions as number | undefined;

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
            value={apiToken}
            onChangeText={setApiTokenState}
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
            <View style={[styles.statusDot, { backgroundColor: tunnelUrl ? colors.primary : colors.mutedForeground }]} />
            <Text style={styles.statusLabel}>{tunnelUrl ? "Connected" : "Inactive"}</Text>
          </View>
          {tunnelUrl && (
            <TouchableOpacity onPress={() => Alert.alert("Tunnel URL", tunnelUrl)}>
              <Text style={styles.tunnelUrl} numberOfLines={1}>{tunnelUrl}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Biometric Lock (Face ID / Touch ID)</Text>
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
          <View style={styles.serverRow}>
            <Text style={styles.serverLabel}>Session Disconnected</Text>
            <Switch
              value={pushPerms?.sessionDisconnected ?? true}
              onValueChange={(v) => handlePushPreferenceToggle("sessionDisconnected", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>
          <View style={styles.serverRow}>
            <Text style={styles.serverLabel}>Server Health Changes</Text>
            <Switch
              value={pushPerms?.serverHealthChange ?? true}
              onValueChange={(v) => handlePushPreferenceToggle("serverHealthChange", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>
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
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <View style={styles.serverRow}>
            <Text style={styles.serverLabel}>App Version</Text>
            <Text style={styles.serverValue}>{"1.0.0"}</Text>
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
