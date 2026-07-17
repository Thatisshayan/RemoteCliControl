import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal } from "react-native";
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
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import ActionSheet from "../components/ui/ActionSheet";
import { colors } from "../constants/colors";
import { getErrorMessage } from "../lib/error-message";
import type { ConnectionProfile } from "@remotectrl/api-zod";

export default function ConnectionScreen() {
  const router = useRouter();
  const { data: profiles } = useGetConnections();
  const { data: active } = useGetActiveConnection();
  const createProfile = useCreateConnection();
  const deleteProfile = useDeleteConnection();
  const activateProfile = useActivateConnection();
  const testConn = useTestConnection();

  const [showAddSheet, setShowAddSheet] = useState(false);
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
  const [deleteTarget, setDeleteTarget] = useState<ConnectionProfile | null>(null);

  const handleTest = async () => {
    setTestResult(null);
    try {
      const body: any = { host, port: Number(port), username };
      if (authMode === "key") {
        if (!privateKey || !privateKey.includes("-----BEGIN")) {
          setTestResult({ success: false, message: "Invalid SSH private key - must include private key header" });
          return;
        }
        if (privateKey.includes("passphrase") && !passphrase) {
          setTestResult({ success: false, message: "Passphrase required for encrypted key" });
          return;
        }
        body.privateKey = privateKey;
        body.passphrase = passphrase || "";
      } else { 
        if (!password) {
          setTestResult({ success: false, message: "Password is required for password authentication" });
          return;
        }
        body.password = password;
      }
      const data = await testConn.mutateAsync(body);
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: getErrorMessage(err) });
    }
  };

  const handleSave = async () => {
    if (!host || !username || !name) return Alert.alert("Error", "Name, host and username are required");
    if (authMode === "key" && !privateKey) {
      return Alert.alert("Error", "SSH private key is required when using key authentication");
    }
    if (authMode === "key" && privateKey.includes("passphrase") && !passphrase) {
      return Alert.alert("Error", "Passphrase is required when key is encrypted");
    }
    if (authMode === "password" && !password) {
      return Alert.alert("Error", "Password is required when using password authentication");
    }
    try {
      const body: any = { name, host, port: Number(port), username };
      if (authMode === "key") { 
        body.privateKey = privateKey; 
        body.passphrase = passphrase || "";
      } else { body.password = password; }
      const data = await createProfile.mutateAsync(body);
      await activateProfile.mutateAsync(data.id);
      setShowAddSheet(false);
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", getErrorMessage(err));
    }
  };

  const resetForm = () => {
    setName("");
    setHost("");
    setPort("22");
    setUsername("");
    setPassword("");
    setPrivateKey("");
    setPassphrase("");
    setTestResult(null);
    setAuthMode("password");
  };

  const handleActivate = async (id: string) => {
    try {
      await activateProfile.mutateAsync(id);
    } catch (err: any) {
      Alert.alert("Error", getErrorMessage(err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SSH Profiles</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/settings")}>
          <Feather name="settings" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {(profiles || []).length === 0 ? (
          <EmptyState
            icon="server"
            message="No profiles yet"
            actionLabel="Add Profile"
            onAction={() => { resetForm(); setShowAddSheet(true); }}
          />
        ) : (
          (profiles || []).map((p) => (
            <TouchableOpacity key={p.id} onPress={() => handleActivate(p.id)} onLongPress={() => setDeleteTarget(p)}>
              <Card style={styles.profileCard} active={active?.id === p.id}>
                <View style={styles.profileRow}>
                  <Feather name="server" size={20} color={colors.primary} />
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{p.name}</Text>
                    <Text style={styles.profileHost}>{p.host}:{p.port}</Text>
                  </View>
                  {active?.id === p.id ? (
                    <Badge label="Active" variant="connected" />
                  ) : (
                    <Feather name="circle" size={10} color={colors.mutedForeground} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {!(profiles || []).length ? null : (
        <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setShowAddSheet(true); }}>
          <Feather name="plus" size={24} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      <ActionSheet
        visible={deleteTarget !== null}
        title="Delete Profile"
        message={deleteTarget ? `Remove "${deleteTarget.name}"?` : ""}
        items={[
          { label: "Delete", destructive: true, onPress: async () => { if (deleteTarget) { try { await deleteProfile.mutateAsync(deleteTarget.id); } catch (err: any) { Alert.alert("Error", getErrorMessage(err)); } } setDeleteTarget(null); } },
        ]}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal visible={showAddSheet} animationType="slide" transparent onRequestClose={() => setShowAddSheet(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Profile</Text>
              <TouchableOpacity onPress={() => setShowAddSheet(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

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
                <Text style={styles.saveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50 },
  headerTitle: { color: colors.foreground, fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  content: { padding: 16, paddingBottom: 80 },
  profileCard: { marginBottom: 10 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileInfo: { flex: 1 },
  profileName: { color: colors.foreground, fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  profileHost: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
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
});
