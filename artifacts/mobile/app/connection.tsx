import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useGetConnections,
  useGetActiveConnection,
  useCreateConnection,
  useDeleteConnection,
  useActivateConnection,
  useTestConnection,
} from "@remotectrl/api-client-react";
import { colors } from "../constants/colors";
import type { ConnectionProfile } from "@remotectrl/api-zod";

export default function ConnectionScreen() {
  const router = useRouter();
  const { data: profiles } = useGetConnections();
  const { data: active } = useGetActiveConnection();
  const createProfile = useCreateConnection();
  const deleteProfile = useDeleteConnection();
  const activateProfile = useActivateConnection();
  const testConn = useTestConnection();

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"password" | "key">("password");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (active && !editingId) {
      setName(active.name);
      setHost(active.host);
      setPort(String(active.port));
      setUsername(active.username);
      if (active.privateKey) {
        setAuthMode("key");
        setPrivateKey(active.privateKey);
        setPassphrase(active.passphrase || "");
      }
    }
  }, [active, editingId]);

  const handleTest = async () => {
    setTestResult(null);
    try {
      const data = await testConn.mutateAsync({
        host, port: Number(port), username,
        ...(authMode === "key" ? { privateKey, passphrase } : { password }),
      });
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    }
  };

  const handleSave = async () => {
    if (!host || !username || !name) return Alert.alert("Error", "Name, host and username are required");
    try {
      const data = await createProfile.mutateAsync({
        name, host, port: Number(port), username,
        ...(authMode === "key" ? { privateKey, passphrase } : { password }),
      });
      await activateProfile.mutateAsync(data.id);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Profile", "Remove this connection profile?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteProfile.mutateAsync(id) },
    ]);
  };

  const handleSelectProfile = (p: ConnectionProfile) => {
    setEditingId(p.id);
    setName(p.name);
    setHost(p.host);
    setPort(String(p.port));
    setUsername(p.username);
    setPassword(p.password || "");
    setPrivateKey(p.privateKey || "");
    setPassphrase(p.passphrase || "");
    setAuthMode(p.privateKey ? "key" : "password");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SSH Connection</Text>
        <View style={{ width: 24 }} />
      </View>

      {profiles && profiles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profiles</Text>
          {profiles.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.profileCard, active?.id === p.id && styles.profileActive]}
              onPress={() => handleSelectProfile(p)}
              onLongPress={() => handleDelete(p.id)}
            >
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{p.name}</Text>
                <Text style={styles.profileHost}>{p.host}</Text>
              </View>
              {active?.id === p.id && <Text style={styles.activeBadge}>Active</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New Profile</Text>

        <Text style={styles.label}>NAME</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Home PC" placeholderTextColor={colors.mutedForeground} />

        <Text style={styles.label}>HOST</Text>
        <TextInput style={styles.input} value={host} onChangeText={setHost} placeholder="192.168.1.10" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />

        <Text style={styles.label}>PORT</Text>
        <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder="22" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" />

        <Text style={styles.label}>USERNAME</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="admin" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />

        <View style={styles.authToggle}>
          <TouchableOpacity
            style={[styles.authBtn, authMode === "password" && styles.authBtnActive]}
            onPress={() => setAuthMode("password")}
          >
            <Text style={[styles.authBtnText, authMode === "password" && styles.authBtnTextActive]}>Password</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authBtn, authMode === "key" && styles.authBtnActive]}
            onPress={() => setAuthMode("key")}
          >
            <Text style={[styles.authBtnText, authMode === "key" && styles.authBtnTextActive]}>SSH Key</Text>
          </TouchableOpacity>
        </View>

        {authMode === "password" ? (
          <>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>PRIVATE KEY (PEM)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={privateKey}
              onChangeText={setPrivateKey}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={6}
              secureTextEntry={false}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Text style={styles.label}>PASSPHRASE (optional)</Text>
            <TextInput
              style={styles.input}
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Leave empty if none"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
            />
          </>
        )}

        <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testConn.isPending}>
          {testConn.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.testBtnText}>Test Connection</Text>
          )}
        </TouchableOpacity>

        {testResult && (
          <View style={[styles.testBanner, testResult.success ? styles.testSuccess : styles.testFail]}>
            <Text style={styles.testBannerText}>
              {testResult.message}{testResult.latencyMs ? ` (${testResult.latencyMs}ms)` : ""}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={createProfile.isPending}>
          {createProfile.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveBtnText}>Save & Connect</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.info}>
          Note: Enable OpenSSH Server on Windows (Settings &gt; Apps &gt; Optional Features &gt; Add OpenSSH Server).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingTop: 10 },
  headerTitle: { color: colors.foreground, fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  label: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { padding: 12 },
  authToggle: { flexDirection: "row", gap: 8, marginTop: 12 },
  authBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  authBtnActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  authBtnText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
  authBtnTextActive: { color: colors.primary },
  testBtn: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 20 },
  testBtnText: { color: colors.primary, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  testBanner: { borderRadius: 8, padding: 12, marginTop: 12 },
  testSuccess: { backgroundColor: "rgba(0,255,136,0.1)", borderWidth: 1, borderColor: colors.primary },
  testFail: { backgroundColor: "rgba(255,68,68,0.1)", borderWidth: 1, borderColor: colors.destructive },
  testBannerText: { color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 8, padding: 16, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16, fontFamily: "Inter_700Bold" },
  info: { color: colors.mutedForeground, fontSize: 13, marginTop: 20, textAlign: "center", fontFamily: "Inter_400Regular" },
  profileCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 8 },
  profileActive: { borderColor: colors.primary },
  profileInfo: { flex: 1 },
  profileName: { color: colors.foreground, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  profileHost: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
  activeBadge: { color: colors.primary, fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", backgroundColor: "rgba(0,255,136,0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
});
