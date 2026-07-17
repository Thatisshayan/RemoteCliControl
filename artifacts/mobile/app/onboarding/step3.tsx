import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../constants/colors";
import { useRuntimeConfig } from "../../lib/runtime-config";

export default function ApiTokenScreen() {
  const router = useRouter();
  const { saveApiToken, markOnboardingComplete } = useRuntimeConfig();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleContinue = async () => {
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
            onChangeText={setToken}
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
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>Continue</Text>
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
  continueBtnText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
