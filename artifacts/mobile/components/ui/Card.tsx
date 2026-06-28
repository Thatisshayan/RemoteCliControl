import { View, StyleSheet, type ViewStyle } from "react-native";
import { colors } from "../../constants/colors";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  active?: boolean;
}

export default function Card({ children, style, active }: CardProps) {
  return (
    <View style={[styles.card, active && styles.active, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  active: {
    borderColor: colors.primary,
  },
});
