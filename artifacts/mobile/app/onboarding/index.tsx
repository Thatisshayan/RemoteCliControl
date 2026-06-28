import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Feather name="terminal" size={64} color={colors.primary} />
        <Text style={styles.title}>RemoteCTRL</Text>
        <Text style={styles.tagline}>Control your PC from anywhere</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => router.push("/onboarding/step2")}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 120,
    paddingBottom: 60,
  },
  top: {
    alignItems: "center",
  },
  title: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginTop: 24,
  },
  tagline: {
    color: colors.mutedForeground,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
