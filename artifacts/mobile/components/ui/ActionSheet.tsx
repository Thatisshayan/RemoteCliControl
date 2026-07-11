import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

interface ActionItem {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  items: ActionItem[];
  onCancel: () => void;
}

export default function ActionSheet({ visible, title, message, items, onCancel }: ActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <View style={styles.sheet}>
          <View style={styles.handleBar} />
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}
          {items.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.item}
              onPress={() => {
                item.onPress();
                onCancel();
              }}
            >
              {item.icon && (
                <Feather
                  name={item.icon}
                  size={20}
                  color={item.destructive ? colors.destructive : colors.foreground}
                />
              )}
              <Text style={[styles.itemText, item.destructive && styles.destructiveText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.separator} />
          <TouchableOpacity style={styles.cancelItem} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
    paddingTop: 8,
  },
  handleBar: {
    width: 32,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  message: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
    fontFamily: "Inter_400Regular",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 20,
    gap: 12,
  },
  itemText: {
    color: colors.foreground,
    fontSize: 17,
    fontFamily: "Inter_400Regular",
  },
  destructiveText: {
    color: colors.destructive,
  },
  separator: {
    height: 8,
    backgroundColor: colors.background,
    marginTop: 8,
  },
  cancelItem: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
