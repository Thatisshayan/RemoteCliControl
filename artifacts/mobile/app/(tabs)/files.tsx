import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getAuthHeaders, getBaseUrl, useListFiles, useDeleteFile, useMakeDirectory, useReadFile } from "@remotectrl/api-client-react";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import ActionSheet from "../../components/ui/ActionSheet";
import { colors } from "../../constants/colors";
import type { FileItem } from "@remotectrl/api-zod";

const BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".zip", ".exe", ".pdf", ".bin", ".dll", ".so", ".dmg", ".iso"]);
const MAX_PREVIEW_SIZE = 100 * 1024; // 100KB limit for preview

function isBinary(name: string): boolean {
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  return BINARY_EXTENSIONS.has(ext);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function FilesScreen() {
  const [currentPath, setCurrentPath] = useState("/");
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [showMkdir, setShowMkdir] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, refetch } = useListFiles(currentPath);
  const deleteFile = useDeleteFile();
  const makeDir = useMakeDirectory();
  const readFile = useReadFile();

  const navigateInto = (item: FileItem) => {
    if (item.type === "directory") {
      setPathHistory((prev) => [...prev, currentPath]);
      setCurrentPath(item.path);
    }
  };

  const navigateTo = (path: string) => {
    setPathHistory((prev) => [...prev, currentPath]);
    setCurrentPath(path);
  };

  const goBack = () => {
    if (pathHistory.length > 0) {
      const prev = pathHistory[pathHistory.length - 1];
      setPathHistory((h) => h.slice(0, -1));
      setCurrentPath(prev);
    }
  };

  const handleDelete = async (item: FileItem) => {
    setSelectedFile(null);
    try {
      await deleteFile.mutateAsync(item.path);
      refetch();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handlePreview = async (item: FileItem) => {
    setSelectedFile(null);
    if (isBinary(item.name)) {
      Alert.alert("Binary File", "Binary file — download to view");
      return;
    }
    if (item.size && item.size > MAX_PREVIEW_SIZE) {
      Alert.alert("File Too Large", `Preview limited to ${MAX_PREVIEW_SIZE / 1024}KB. File is ${formatSize(item.size)}.`);
      return;
    }
    setPreviewLoading(true);
    setPreviewName(item.name);
    try {
      const result = await readFile.mutateAsync(item.path);
      setPreviewContent(result.content);
    } catch (err: any) {
      setPreviewContent(`Error: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (item: FileItem) => {
    setSelectedFile(null);
    setDownloading(true);
    try {
      const url = `${getBaseUrl()}/api/files/download?path=${encodeURIComponent(item.path)}`;
      const localUri = FileSystem.documentDirectory + item.name;
      const headers = getAuthHeaders();
      await FileSystem.downloadAsync(url, localUri, { headers });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert("Downloaded", `Saved to ${localUri}`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const filename = asset.name || "upload";
      const remotePath = currentPath.endsWith("/") ? currentPath + filename : currentPath + "/" + filename;
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, name: filename, type: asset.mimeType || "application/octet-stream" } as any);
      const headers = getAuthHeaders();
      const res = await fetch(`${getBaseUrl()}/api/files/upload?path=${encodeURIComponent(remotePath)}`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }
      refetch();
    } catch (err: any) {
      Alert.alert("Upload Error", err.message);
    }
  };

  const handleMkdir = async () => {
    if (!newFolderName.trim()) return;
    const fullPath = currentPath.endsWith("/")
      ? currentPath + newFolderName.trim()
      : currentPath + "/" + newFolderName.trim();
    try {
      await makeDir.mutateAsync(fullPath);
      setNewFolderName("");
      setShowMkdir(false);
      refetch();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const breadcrumbs = currentPath.split("/").filter(Boolean);
  const items = (data?.items || []) as FileItem[];
  const directories = items.filter((i) => i.type === "directory");
  const files = items.filter((i) => i.type !== "directory");
  const sorted = [...directories, ...files];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Files</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleUpload} disabled={downloading}>
            <Feather name="upload" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMkdir(!showMkdir)}>
            <Feather name="folder-plus" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.breadcrumb}>
        <TouchableOpacity onPress={() => { setCurrentPath("/"); setPathHistory([]); }}>
          <Text style={[styles.breadItem, currentPath === "/" && styles.breadActive]}>/</Text>
        </TouchableOpacity>
        {breadcrumbs.map((seg, i) => (
          <TouchableOpacity key={i} onPress={() => navigateTo("/" + breadcrumbs.slice(0, i + 1).join("/"))}>
            <Text style={[styles.breadItem, i === breadcrumbs.length - 1 && styles.breadActive]}>{seg}/</Text>
          </TouchableOpacity>
        ))}
        {pathHistory.length > 0 && (
          <TouchableOpacity onPress={goBack} style={styles.backBreadcrumb}>
            <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {showMkdir && (
        <View style={styles.mkdirRow}>
          <TextInput
            style={styles.mkdirInput}
            value={newFolderName}
            onChangeText={setNewFolderName}
            placeholder="Folder name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
          <TouchableOpacity style={styles.mkdirBtn} onPress={handleMkdir}>
            <Text style={styles.mkdirBtnText}>Create</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <LoadingState count={5} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigateInto(item)}
              onLongPress={() => setSelectedFile(item)}
            >
              <Feather
                name={item.type === "directory" ? "folder" : "file"}
                size={20}
                color={item.type === "directory" ? colors.primary : colors.mutedForeground}
              />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.type === "directory" ? "Folder" : formatSize(item.size)}
                  {item.modifiedAt ? ` · ${new Date(item.modifiedAt).toLocaleDateString()}` : ""}
                </Text>
              </View>
              {item.type === "directory" && <Feather name="chevron-right" size={18} color={colors.mutedForeground} />}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          onRefresh={() => refetch()}
          refreshing={false}
          ListEmptyComponent={<EmptyState icon="folder" message="Empty directory" />}
        />
      )}

      <ActionSheet
        visible={selectedFile !== null}
        title={selectedFile?.name}
        items={[
          ...(selectedFile?.type !== "directory"
            ? [{ label: "Preview", icon: "eye" as const, onPress: () => { if (selectedFile) handlePreview(selectedFile); } }
            ] : []),
          { label: "Download", icon: "download" as const, onPress: () => { if (selectedFile) handleDownload(selectedFile); } },
          { label: "Delete", icon: "trash-2" as const, destructive: true, onPress: () => { if (selectedFile) handleDelete(selectedFile); } },
        ]}
        onCancel={() => setSelectedFile(null)}
      />

      <Modal visible={previewLoading || previewContent !== null} animationType="slide" onRequestClose={() => { setPreviewContent(null); setPreviewName(null); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{previewName}</Text>
            <TouchableOpacity onPress={() => { setPreviewContent(null); setPreviewName(null); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {previewLoading ? (
            <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
          ) : (
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalText}>{previewContent}</Text>
            </ScrollView>
          )}
        </View>
      </Modal>

      {downloading && <ActivityIndicator color={colors.primary} style={styles.downloadOverlay} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50 },
  headerTitle: { color: colors.foreground, fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerActions: { flexDirection: "row", gap: 16 },
  breadcrumb: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingBottom: 8, gap: 2, alignItems: "center" },
  breadItem: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
  breadActive: { color: colors.primary },
  backBreadcrumb: { marginLeft: 8 },
  mkdirRow: { flexDirection: "row", padding: 16, gap: 8 },
  mkdirInput: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground, fontFamily: "Inter_400Regular" },
  mkdirBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  mkdirBtnText: { color: colors.primaryForeground, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  list: { padding: 16 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.card, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border, gap: 12 },
  rowInfo: { flex: 1 },
  rowName: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_500Medium" },
  rowMeta: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: "Inter_400Regular" },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  modalContent: { flex: 1, padding: 16 },
  modalText: { color: colors.primary, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  downloadOverlay: { position: "absolute", bottom: 20, alignSelf: "center" },
});
