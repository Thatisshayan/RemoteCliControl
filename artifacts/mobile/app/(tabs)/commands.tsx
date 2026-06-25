import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useGetCommands, useCreateCommand, useDeleteCommand, useGetSessions } from "@remotectrl/api-client-react";
import { colors } from "../../constants/colors";
import type { SavedCommand, Session } from "@remotectrl/api-zod";

export default function CommandsScreen() {
  const router = useRouter();
  const { data: commands } = useGetCommands();
  const { data: sessions } = useGetSessions();
  const createCommand = useCreateCommand();
  const deleteCommand = useDeleteCommand();

  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");

  const handleCopy = async (cmd: SavedCommand) => {
    await Clipboard.setStringAsync(cmd.command);
    Alert.alert("Copied", "Command copied to clipboard");
  };

  const handleSend = (cmd: SavedCommand) => {
    const activeSessions = (sessions || []) as Session[];
    if (activeSessions.length === 0) {
      Alert.alert("No Sessions", "Create a terminal session first");
      return;
    }
    if (activeSessions.length === 1) {
      router.push(`/session/${activeSessions[0].id}?prefill=${encodeURIComponent(cmd.command)}`);
      return;
    }
    Alert.alert(
      "Send to Session",
      "Choose a session:",
      activeSessions.map((s) => ({
        text: s.title,
        onPress: () => router.push(`/session/${s.id}?prefill=${encodeURIComponent(cmd.command)}`),
      })).concat([{ text: "Cancel", style: "cancel" as const }])
    );
  };

  const handleCardPress = (cmd: SavedCommand) => {
    Alert.alert(cmd.label, cmd.command, [
      { text: "Copy", onPress: () => handleCopy(cmd) },
      ...(sessions && (sessions as Session[]).length > 0
        ? [{ text: "Send to Session", onPress: () => handleSend(cmd) }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const handleDelete = (cmd: SavedCommand) => {
    Alert.alert("Delete", `Delete "${cmd.label}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCommand.mutateAsync(cmd.id) },
    ]);
  };

  const handleSave = async () => {
    if (!label.trim() || !command.trim()) return Alert.alert("Error", "Label and command are required");
    try {
      await createCommand.mutateAsync({ label: label.trim(), command: command.trim(), description: description.trim() });
      setShowModal(false);
      setLabel("");
      setCommand("");
      setDescription("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const renderItem = ({ item }: { item: SavedCommand }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleCardPress(item)} onLongPress={() => handleDelete(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{item.label}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleCopy(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="copy" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardCommand} numberOfLines={2}>{item.command}</Text>
      {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commands</Text>
      </View>

      <FlatList
        data={(commands || []) as SavedCommand[]}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No saved commands. Tap + to add one.</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Command</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>LABEL</Text>
            <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="List directory" placeholderTextColor={colors.mutedForeground} />

            <Text style={styles.label}>COMMAND</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={command}
              onChangeText={setCommand}
              placeholder="dir /w"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>DESCRIPTION (optional)</Text>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Short description" placeholderTextColor={colors.mutedForeground} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={createCommand.isPending}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50 },
  headerTitle: { color: colors.foreground, fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  list: { padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  cardActions: { flexDirection: "row", gap: 12 },
  cardCommand: { color: colors.primary, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6 },
  cardDesc: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  empty: { color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: "Inter_400Regular" },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  label: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  cancelBtnText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center" },
  saveBtnText: { color: colors.primaryForeground, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
