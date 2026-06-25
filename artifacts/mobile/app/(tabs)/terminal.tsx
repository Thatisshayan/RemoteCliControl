import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetSessions, useCreateSession, useCloseSession, useRenameSession } from "@remotectrl/api-client-react";
import { colors } from "../../constants/colors";
import type { Session } from "@remotectrl/api-zod";

const STATUS_COLORS: Record<string, string> = {
  connected: colors.primary,
  connecting: colors.warning,
  error: colors.destructive,
  disconnected: colors.mutedForeground,
};

export default function TerminalScreen() {
  const router = useRouter();
  const { data: sessions, isLoading } = useGetSessions();
  const createSession = useCreateSession();
  const closeSession = useCloseSession();
  const renameSession = useRenameSession();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const handleNewSession = async () => {
    try {
      const session = await createSession.mutateAsync();
      router.push(`/session/${session.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleRename = (session: Session) => {
    setRenamingId(session.id);
    setRenameText(session.title);
  };

  const confirmRename = async () => {
    if (!renamingId || !renameText.trim()) return;
    try {
      await renameSession.mutateAsync({ id: renamingId, title: renameText.trim() });
      setRenamingId(null);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleClose = (id: string) => {
    Alert.alert("Close Session", "Close this SSH session?", [
      { text: "Cancel", style: "cancel" },
      { text: "Close", style: "destructive", onPress: () => closeSession.mutateAsync(id) },
    ]);
  };

  const renderItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/session/${item.id}`)}
      onLongPress={() => handleRename(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLORS[item.status] || colors.mutedForeground }]} />
          {renamingId === item.id ? (
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              onBlur={confirmRename}
              onSubmitEditing={confirmRename}
              autoFocus
            />
          ) : (
            <Text style={styles.cardTitle}>{item.title}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => handleClose(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <Text style={styles.cardStatus}>{item.status}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Terminal</Text>
        <TouchableOpacity onPress={() => router.push("/connection")}>
          <Feather name="settings" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={(sessions || []) as Session[]}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No sessions. Tap + to create one.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleNewSession} disabled={createSession.isPending}>
        {createSession.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Feather name="plus" size={24} color={colors.primaryForeground} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50 },
  headerTitle: { color: colors.foreground, fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  list: { padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  cardTitle: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  cardStatus: { color: colors.mutedForeground, fontSize: 13, marginTop: 6, fontFamily: "Inter_400Regular" },
  renameInput: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", borderBottomWidth: 1, borderBottomColor: colors.primary, flex: 1, paddingVertical: 2 },
  empty: { color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: "Inter_400Regular" },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 8 },
});
