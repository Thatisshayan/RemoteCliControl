import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

interface BadgeProps {
  label: string;
  variant?: "connected" | "connecting" | "error" | "disconnected" | "default";
}

const VARIANTS = {
  connected: { bg: "rgba(0,255,136,0.15)", text: colors.primary },
  connecting: { bg: "rgba(255,170,0,0.15)", text: colors.warning },
  error: { bg: "rgba(255,68,68,0.15)", text: colors.destructive },
  disconnected: { bg: "rgba(102,102,102,0.2)", text: colors.mutedForeground },
  default: { bg: "rgba(102,102,102,0.2)", text: colors.mutedForeground },
};

export default function Badge({ label, variant = "default" }: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
