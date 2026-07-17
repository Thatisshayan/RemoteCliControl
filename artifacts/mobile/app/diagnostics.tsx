import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { useRuntimeConfig } from "../lib/runtime-config";
import { useServerStatus } from "../lib/server-status";

const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { baseUrl, apiToken, authExpired } = useRuntimeConfig();
  const { health, tunnelStatus, mobileMinVersion, isUnreachable, isLoading, refetch } = useServerStatus(baseUrl, {
    intervalMs: 10_000,
  });

  const authState = authExpired
    ? "Rejected — token needs re-entry"
    : apiToken
      ? "Token set"
      : "No token (unauthenticated mode)";

  const buildSnapshotText = () => {
    const lines = [
      "RemoteCTRL mobile diagnostics",
      `Base URL: ${baseUrl}`,
      `Auth state: ${authState}`,
      `Server reachable: ${isUnreachable ? "no" : health ? "yes" : "unknown"}`,
      `Server uptime: ${health?.uptimeSeconds !== undefined ? `${Math.floor(health.uptimeSeconds / 60)}m` : "—"}`,
      `Active sessions: ${health?.activeSessions ?? "—"}`,
      `Server version: ${health?.version ?? "—"}`,
      `Server min mobile version: ${mobileMinVersion ?? "—"}`,
      `Tunnel: ${tunnelStatus?.active ? tunnelStatus.tunnelUrl || "active (no URL)" : "inactive"}`,
      `App version: ${APP_VERSION}`,
    ];
    return lines.join("\n");
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildSnapshotText());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diagnostics</Text>
        <TouchableOpacity onPress={() => refetch()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isUnreachable && (
          <View style={styles.unreachableBanner}>
            <Feather name="wifi-off" size={16} color={colors.destructive} />
            <Text style={styles.unreachableText}>Can't reach the server at this URL right now.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.card}>
          <Row label="Base URL" value={baseUrl || "—"} />
          <Row label="Auth State" value={authState} valueColor={authExpired ? colors.destructive : undefined} />
        </View>

        <Text style={styles.sectionTitle}>Server</Text>
        <View style={styles.card}>
          <Row
            label="Reachable"
            value={isLoading ? "Checking..." : isUnreachable ? "No" : health ? "Yes" : "Unknown"}
            valueColor={isUnreachable ? colors.destructive : health ? colors.primary : undefined}
          />
          <Row
            label="Uptime"
            value={health?.uptimeSeconds !== undefined ? `${Math.floor(health.uptimeSeconds / 60)}m` : "—"}
          />
          <Row label="Active Sessions" value={health?.activeSessions !== undefined ? String(health.activeSessions) : "—"} />
          <Row label="Server Version" value={health?.version || "—"} />
          <Row label="Server Min App Version" value={mobileMinVersion || "—"} />
        </View>

        <Text style={styles.sectionTitle}>Tunnel</Text>
        <View style={styles.card}>
          <Row label="Status" value={tunnelStatus?.active ? "Active" : "Inactive"} />
          <Row label="URL" value={tunnelStatus?.tunnelUrl || "—"} />
        </View>

        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <Row label="App Version" value={APP_VERSION} />
        </View>

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          <Feather name="copy" size={16} color={colors.primaryForeground} />
          <Text style={styles.copyBtnText}>Copy Diagnostics to Clipboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  content: { padding: 16, paddingBottom: 40 },
  unreachableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,68,68,0.1)",
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  unreachableText: { color: colors.destructive, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  sectionTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 8, marginTop: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, gap: 12 },
  rowLabel: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
  rowValue: { color: colors.foreground, fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium", flexShrink: 1, textAlign: "right" },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    marginTop: 24,
  },
  copyBtnText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
