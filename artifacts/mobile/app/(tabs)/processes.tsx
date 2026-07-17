import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGetProcesses, useKillProcess } from "@remotectrl/api-client-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import SearchBar from "../../components/ui/SearchBar";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import ActionSheet from "../../components/ui/ActionSheet";
import { colors } from "../../constants/colors";
import { getErrorMessage, isServerUnreachable } from "../../lib/error-message";
import type { RemoteProcess } from "@remotectrl/api-zod";

function getCpuColor(cpu: number) {
  if (cpu > 80) return colors.destructive;
  if (cpu > 50) return colors.warning;
  return colors.primary;
}

export default function ProcessesScreen() {
  const { data: processes, isLoading, isError, error, refetch } = useGetProcesses({ refetchInterval: 10000 });
  const killProcess = useKillProcess();
  const [search, setSearch] = useState("");
  const [killTarget, setKillTarget] = useState<RemoteProcess | null>(null);

  const filtered = (processes || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    String(p.pid).includes(search)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Processes</Text>
        <TouchableOpacity onPress={() => refetch()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="refresh-cw" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search processes..." />
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {search
            ? `Showing ${filtered.length} of ${(processes || []).length}`
            : `${(processes || []).length} processes`}
        </Text>
      </View>

      {isLoading ? (
        <LoadingState count={5} />
      ) : isError && isServerUnreachable(error) ? (
        <EmptyState
          icon="wifi-off"
          message={getErrorMessage(error)}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.pid)}
          renderItem={({ item }) => (
            <Card style={styles.processCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.pid}>PID {item.pid}</Text>
                </View>
                <TouchableOpacity onPress={() => setKillTarget(item)}>
                  <Feather name="x" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
              <View style={styles.barContainer}>
                <View style={styles.barLabel}>
                  <Text style={styles.barLabelText}>CPU</Text>
                  <Text style={[styles.barValue, { color: getCpuColor(item.cpu) }]}>{item.cpu.toFixed(1)}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(item.cpu, 100)}%`, backgroundColor: getCpuColor(item.cpu) }]} />
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{item.memory.toFixed(1)} MB</Text>
                <Badge label={item.status} variant={item.status === "running" ? "connected" : "error"} />
              </View>
            </Card>
          )}
          contentContainerStyle={styles.list}
          onRefresh={() => refetch()}
          refreshing={isLoading}
          ListEmptyComponent={<EmptyState icon="cpu" message={isLoading ? "Loading..." : "No processes found"} />}
        />
      )}

      <ActionSheet
        visible={killTarget !== null}
        title="Kill Process"
        message={killTarget ? `Kill "${killTarget.name}" (PID ${killTarget.pid})?` : ""}
        items={[
          { label: "Kill", destructive: true, onPress: async () => {
            if (killTarget) {
              const target = killTarget;
              setKillTarget(null);
              try {
                await killProcess.mutateAsync(target.pid);
              } catch (err: any) {
                Alert.alert("Error", getErrorMessage(err));
              }
            }
          }},
        ]}
        onCancel={() => setKillTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50 },
  headerTitle: { color: colors.foreground, fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  countBar: { paddingHorizontal: 16, paddingBottom: 8 },
  countText: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  processCard: { marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardInfo: { flex: 1 },
  name: { color: colors.foreground, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  pid: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  barContainer: { marginTop: 10 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabelText: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" },
  barValue: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  barTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  metaText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
});
