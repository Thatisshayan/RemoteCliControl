import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../constants/colors";
import { useRuntimeConfig } from "../../lib/runtime-config";
import { checkConnection } from "../../lib/connection-check";

export default function ApiTokenScreen() {
  const router = useRouter();
  const { baseUrl, saveApiToken, markOnboardingComplete } = useRuntimeConfig();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [validated, setValidated] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await checkConnection(baseUrl, token.trim());
    setTestResult({ success: result.ok, message: result.message });
    setValidated(result.ok);
    setTesting(false);
  };

  const handleContinue = async () => {
    // A blank token means "run unauthenticated" — nothing to validate. A
    // non-blank token must pass the same check the "Test" button runs
    // before it can be saved, so a rejected token can't silently continue
    // into onboarding completion.
    if (token.trim() && !validated) return;
    await saveApiToken(token.trim());
    await markOnboardingComplete();
    router.replace("/(tabs)/terminal");
  };

  const handleSkip = async () => {
    await saveApiToken("");
    await markOnboardingComplete();
    router.replace("/(tabs)/terminal");
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>API Token</Text>
        <Text style={styles.body}>
          Set an API token to secure your connection (optional).
        </Text>

        <Text style={styles.label}>API TOKEN</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={token}
            onChangeText={(t) => { setToken(t); setValidated(false); setTestResult(null); }}
            placeholder="Enter token or leave blank"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowToken(!showToken)} style={styles.eyeBtn}>
            <Feather name={showToken ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {token.trim() !== "" && (
          <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
            {testing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.testBtnText}>Test Token</Text>
            )}
          </TouchableOpacity>
        )}

        {testResult && (
          <View style={[styles.banner, testResult.success ? styles.successBanner : styles.errorBanner]}>
            <Feather name={testResult.success ? "check-circle" : "alert-circle"} size={16} color={testResult.success ? colors.primary : colors.destructive} />
            <Text style={[styles.bannerText, { color: testResult.success ? colors.primary : colors.destructive }]}>
              {testResult.message}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueBtn, token.trim() !== "" && !validated && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={token.trim() !== "" && !validated}
        >
          <Text style={[styles.continueBtnText, token.trim() !== "" && !validated && { color: colors.mutedForeground }]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  eyeBtn: {
    padding: 12,
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
  bottom: {
    gap: 12,
  },
  skipBtn: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  skipBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
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
