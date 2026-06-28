import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = "folder", message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Feather name={icon} size={48} color={colors.mutedForeground} />
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  message: {
    color: colors.mutedForeground,
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    marginTop: 16,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
