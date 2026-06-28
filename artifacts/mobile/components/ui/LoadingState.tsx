import { View, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

interface LoadingStateProps {
  count?: number;
}

function SkeletonCard() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLineNarrow} />
    </View>
  );
}

export default function LoadingState({ count = 3 }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  skeleton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonLineWide: {
    height: 16,
    backgroundColor: colors.border,
    borderRadius: 4,
    width: "70%",
    marginBottom: 8,
  },
  skeletonLineNarrow: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 4,
    width: "40%",
  },
});
