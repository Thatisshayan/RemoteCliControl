import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useGetCommands, useCreateCommand, useDeleteCommand, useGetSessions } from "@remotectrl/api-client-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import ActionSheet from "../../components/ui/ActionSheet";
import { colors } from "../../constants/colors";
import { getErrorMessage, isServerUnreachable } from "../../lib/error-message";
import type { SavedCommand, Session } from "@remotectrl/api-zod";

export default function CommandsScreen() {
  const router = useRouter();
  const { data: commands, isError, error, refetch } = useGetCommands();
  const { data: sessions } = useGetSessions();
  const createCommand = useCreateCommand();
  const deleteCommand = useDeleteCommand();

  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCmd, setSelectedCmd] = useState<SavedCommand | null>(null);

  const handleCopy = async (cmd: SavedCommand) => {
    await Clipboard.setStringAsync(cmd.command);
    setSelectedCmd(null);
  };

  const handleSend = (cmd: SavedCommand) => {
    setSelectedCmd(null);
    const activeSessions = (sessions || []) as Session[];
    if (activeSessions.length === 0) return;
    router.push(`/session/${activeSessions[0].id}?prefill=${encodeURIComponent(cmd.command)}`);
  };

  const handleDelete = async (cmd: SavedCommand) => {
    setSelectedCmd(null);
    try {
      await deleteCommand.mutateAsync(cmd.id);
    } catch (err: any) {
      Alert.alert("Error", getErrorMessage(err));
    }
  };

  const handleSave = async () => {
    if (!label.trim() || !command.trim()) return;
    try {
      await createCommand.mutateAsync({ label: label.trim(), command: command.trim(), description: description.trim() });
      setShowModal(false);
      setLabel("");
      setCommand("");
      setDescription("");
    } catch (err: any) {
      Alert.alert("Error", getErrorMessage(err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commands</Text>
      </View>

      {isError && isServerUnreachable(error) ? (
        <EmptyState
          icon="wifi-off"
          message={getErrorMessage(error)}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (
      <FlatList
        data={(commands || []) as SavedCommand[]}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <TouchableOpacity onPress={() => setSelectedCmd(item)} onLongPress={() => setSelectedCmd(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel} numberOfLines={1}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
              <Text style={styles.cardCommand} numberOfLines={2}>{item.command}</Text>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
            </TouchableOpacity>
          </Card>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="list" message="No saved commands. Tap + to add one." />}
      />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <ActionSheet
        visible={selectedCmd !== null}
        title={selectedCmd?.label}
        message={selectedCmd?.command}
        items={[
          { label: "Copy to Clipboard", icon: "copy" as const, onPress: () => { if (selectedCmd) handleCopy(selectedCmd); } },
          ...((sessions || []).length > 0
            ? [{ label: "Send to Session", icon: "send" as const, onPress: () => { if (selectedCmd) handleSend(selectedCmd); } }
            ] : []),
          { label: "Delete", icon: "trash-2" as const, destructive: true, onPress: () => { if (selectedCmd) handleDelete(selectedCmd); } },
        ]}
        onCancel={() => setSelectedCmd(null)}
      />

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
  list: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  cardCommand: { color: colors.primary, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 6 },
  cardDesc: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
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
