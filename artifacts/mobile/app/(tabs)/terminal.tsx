import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetSessions, useCreateSession, useCloseSession, useRenameSession } from "@remotectrl/api-client-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { colors } from "../../constants/colors";
import type { Session } from "@remotectrl/api-zod";

const STATUS_VARIANT: Record<string, "connected" | "connecting" | "error" | "disconnected"> = {
  connected: "connected",
  connecting: "connecting",
  error: "error",
  disconnected: "disconnected",
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
    if (!renamingId || !renameText.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameSession.mutateAsync({ id: renamingId, title: renameText.trim() });
    } catch {}
    setRenamingId(null);
  };

  const handleClose = (id: string) => {
    closeSession.mutateAsync(id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Terminal</Text>
        <TouchableOpacity onPress={() => router.push("/connection")}>
          <Feather name="settings" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingState count={3} />
      ) : (
        <FlatList
          data={(sessions || []) as Session[]}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/session/${item.id}`)}
              onLongPress={() => handleRename(item)}
            >
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
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
                        item.title
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleClose(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardFooter}>
                  <Badge label={item.status} variant={STATUS_VARIANT[item.status] || "disconnected"} />
                  <Text style={styles.cardTime}>
                    {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="terminal"
              message="No active sessions"
              actionLabel="New Session"
              onAction={handleNewSession}
            />
          }
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
  list: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  cardTitle: { color: colors.foreground, fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  cardTime: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
  renameInput: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", borderBottomWidth: 1, borderBottomColor: colors.primary, flex: 1, paddingVertical: 2 },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 8 },
});
