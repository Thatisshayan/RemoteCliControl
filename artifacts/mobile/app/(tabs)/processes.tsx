import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGetProcesses, useKillProcess } from "@remotectrl/api-client-react";
import { colors } from "../../constants/colors";
import type { RemoteProcess } from "@remotectrl/api-zod";

export default function ProcessesScreen() {
  const { data: processes, isLoading, refetch } = useGetProcesses();
  const killProcess = useKillProcess();
  const [search, setSearch] = useState("");

  const filtered = (processes || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleKill = (proc: RemoteProcess) => {
    Alert.alert("Kill Process", `Kill "${proc.name}" (PID ${proc.pid})?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Kill", style: "destructive", onPress: () => killProcess.mutateAsync(proc.pid) },
    ]);
  };

  const getCpuColor = (cpu: number) => {
    if (cpu > 80) return colors.destructive;
    if (cpu > 50) return colors.warning;
    return colors.primary;
  };

  const renderItem = ({ item }: { item: RemoteProcess }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.pid}>PID {item.pid}</Text>
        </View>
        <TouchableOpacity onPress={() => handleKill(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
        <View style={[styles.badge, item.status === "running" ? styles.badgeRunning : styles.badgeError]}>
          <Text style={[styles.badgeText, item.status === "running" ? styles.badgeTextRunning : styles.badgeTextError]}>{item.status}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Processes</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Feather name="refresh-cw" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search processes..."
          placeholderTextColor={colors.mutedForeground}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {search ? `Showing ${filtered.length} of ${(processes || []).length}` : `${(processes || []).length} processes`}
          {" · "}Tap X to kill
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.pid)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onRefresh={() => refetch()}
        refreshing={isLoading}
        ListEmptyComponent={<Text style={styles.empty}>{isLoading ? "Loading..." : "No processes found"}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50 },
  headerTitle: { color: colors.foreground, fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, padding: 10, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  countBar: { paddingHorizontal: 16, paddingBottom: 8 },
  countText: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardInfo: { flex: 1 },
  name: { color: colors.foreground, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  pid: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
  barContainer: { marginTop: 10 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabelText: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" },
  barValue: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  barTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  metaText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeRunning: { backgroundColor: "rgba(0,255,136,0.15)" },
  badgeError: { backgroundColor: "rgba(255,68,68,0.15)" },
  badgeText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  badgeTextRunning: { color: colors.primary },
  badgeTextError: { color: colors.destructive },
  empty: { color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: "Inter_400Regular" },
});
