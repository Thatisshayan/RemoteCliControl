import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as KeepAwake from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../constants/colors";

const DOMAIN_RAW = process.env.EXPO_PUBLIC_DOMAIN || "http://localhost:3000";
const DOMAIN = DOMAIN_RAW.replace(/^https?:\/\//, "");

// ANSI color parser
const ANSI_COLORS: Record<number, string> = {
  30: "#4d4d4d", 31: "#ff4444", 32: "#00ff88", 33: "#ffaa00",
  34: "#5599ff", 35: "#cc44ff", 36: "#00ccff", 37: "#e0e0e0",
  90: "#999999", 91: "#ff6666", 92: "#33ff99", 93: "#ffcc44",
  94: "#77bbff", 95: "#dd77ff", 97: "#ffffff",
};

interface AnsiSegment { text: string; color?: string; bold?: boolean; }

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let currentColor: string | undefined = colors.primary;
  let currentBold = false;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), color: currentColor, bold: currentBold });
    }
    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) { currentColor = colors.primary; currentBold = false; }
      else if (code === 1) currentBold = true;
      else if (ANSI_COLORS[code]) currentColor = ANSI_COLORS[code];
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), color: currentColor, bold: currentBold });
  }
  return segments.length ? segments : [{ text, color: colors.primary }];
}

const MAX_HISTORY = 100;

export default function SessionScreen() {
  const router = useRouter();
  const { sessionId, prefill } = useLocalSearchParams<{ sessionId: string; prefill?: string }>();
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const shouldReconnect = useRef(true);

  // Load persisted font size
  useEffect(() => {
    AsyncStorage.getItem("terminal-font-size").then((v) => {
      if (v) setFontSize(Number(v));
    });
  }, []);

  // Save font size on change
  useEffect(() => {
    AsyncStorage.setItem("terminal-font-size", String(fontSize));
  }, [fontSize]);

  // Keep awake
  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync();
    return () => { KeepAwake.deactivateKeepAwakeAsync(); };
  }, []);

  // Handle prefill from navigation (e.g., from commands tab)
  useEffect(() => {
    if (prefill) {
      setInput(decodeURIComponent(prefill));
    }
  }, [prefill]);

  const openWs = useCallback(() => {
    if (!sessionId) return;
    const isHttps = DOMAIN_RAW.startsWith("https") || (Platform.OS === "web" && location.protocol === "https:");
    const protocol = isHttps ? "wss:" : "ws:";
    const url = `${protocol}//${DOMAIN}/api/ws/terminal/${sessionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempts.current = 0;
      setReconnectStatus("");
    };

    ws.onmessage = (e) => {
      setOutput((prev) => prev + e.data);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    };

    ws.onclose = () => {
      setConnected(false);
      if (shouldReconnect.current && reconnectAttempts.current < 10) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        setReconnectStatus(`Reconnecting (${reconnectAttempts.current}/10)...`);
        setTimeout(openWs, delay);
      } else {
        setReconnectStatus("Disconnected");
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId]);

  useEffect(() => {
    shouldReconnect.current = true;
    openWs();
    return () => {
      shouldReconnect.current = false;
      wsRef.current?.close();
    };
  }, [openWs]);

  const sendInput = (text?: string) => {
    const cmd = text ?? input;
    if (!cmd || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(cmd + "\n");
    setHistory((prev) => {
      const next = [...prev, cmd];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setHistoryIndex(-1);
    setInput("");
  };

  const historyUp = () => {
    if (history.length === 0) return;
    const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(newIndex);
    setInput(history[newIndex]);
  };

  const historyDown = () => {
    if (historyIndex === -1) return;
    const newIndex = historyIndex + 1;
    if (newIndex >= history.length) {
      setHistoryIndex(-1);
      setInput("");
    } else {
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    }
  };

  const clearOutput = () => setOutput("");

  const renderAnsi = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const segments = parseAnsi(line);
      return (
        <Text key={i}>
          {segments.map((seg, j) => (
            <Text key={j} style={{ color: seg.color || colors.primary, fontWeight: seg.bold ? "bold" : "normal", fontSize, lineHeight: fontSize * 1.5, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
              {seg.text}
            </Text>
          ))}
          {"\n"}
        </Text>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.sessionId}>{(sessionId || "").slice(-6)}</Text>
        <View style={[styles.statusDot, { backgroundColor: connected ? colors.primary : colors.destructive }]} />
        {reconnectStatus !== "" && <Text style={styles.reconnectText}>{reconnectStatus}</Text>}
        <TouchableOpacity onPress={clearOutput} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.outputContainer} contentContainerStyle={styles.outputContent}>
        {output ? (
          renderAnsi(output)
        ) : (
          <Text style={styles.placeholder}>Waiting for output...</Text>
        )}
      </ScrollView>

      <View style={styles.quickKeys}>
        <TouchableOpacity style={styles.quickKey} onPress={() => sendInput("\t")}>
          <Text style={styles.quickKeyText}>Tab</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickKey} onPress={() => sendInput("\x03")}>
          <Text style={styles.quickKeyText}>Ctrl+C</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickKey} onPress={() => sendInput("\x04")}>
          <Text style={styles.quickKeyText}>Ctrl+D</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickKey} onPress={historyUp}>
          <Feather name="chevron-up" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickKey} onPress={historyDown}>
          <Feather name="chevron-down" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickKey} onPress={() => setFontSize((s) => Math.max(8, s - 1))}>
          <Text style={styles.quickKeyText}>A-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickKey} onPress={() => setFontSize((s) => Math.min(20, s + 1))}>
          <Text style={styles.quickKeyText}>A+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendInput()}
          placeholder="Type command..."
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          editable={connected}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !connected && styles.sendBtnDisabled]}
          onPress={() => sendInput()}
          disabled={!connected}
        >
          <Feather name="send" size={20} color={connected ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: 12, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  backBtn: { padding: 4 },
  sessionId: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  reconnectText: { color: colors.warning, fontSize: 12, fontFamily: "Inter_400Regular" },
  outputContainer: { flex: 1, backgroundColor: colors.surface },
  outputContent: { padding: 12 },
  placeholder: { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  quickKeys: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 6, paddingHorizontal: 8, gap: 6, justifyContent: "center" },
  quickKey: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  quickKeyText: { color: colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", padding: 12, paddingBottom: 30, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  sendBtn: { backgroundColor: colors.primary, borderRadius: 8, width: 48, height: 48, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { backgroundColor: colors.card },
});
