import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as KeepAwake from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../constants/colors";

const DOMAIN_RAW = process.env.EXPO_PUBLIC_DOMAIN || "http://localhost:3000";
const DOMAIN = DOMAIN_RAW.replace(/^https?:\/\//, "");

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

function sanitizeSessionId(id: string | null): string | null {
  if (!id) return null;
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return sanitized.length > 0 ? sanitized : null;
}

const MAX_HISTORY = 100;
const MAX_LINES = 5000;
const CONTROL_CHARS = new Set(["\t", "\x03", "\x04", "\x0d", "\x7f"]);

function sanitizeCommand(cmd: string): string {
  if (!cmd || typeof cmd !== "string") return cmd;
  cmd = cmd.replace(/\x1b\[[0-9;]*m/g, "");
  cmd = cmd.trim();
  if (cmd.length === 0) return cmd;
  if (cmd.length > 128) throw new Error("Command too long");
  if (cmd.includes("\x00")) throw new Error("Null byte not allowed");
  if (CONTROL_CHARS.has(cmd)) return cmd;
  const dangerousChars = /[<>&;'"|`]/;
  if (dangerousChars.test(cmd)) throw new Error("Invalid command characters");
  if (!/^[a-zA-Z0-9_\-./=@:\s\\]+$/.test(cmd)) throw new Error("Command contains invalid characters");
  return cmd;
}

export default function SessionScreen() {
  const router = useRouter();
  const { sessionId: rawSessionId, prefill } = useLocalSearchParams<{ sessionId: string; prefill?: string }>();
  const [lines, setLines] = useState<string[]>([]);
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReconnecting = useRef(false);

  const sessionId = sanitizeSessionId(rawSessionId);

  useEffect(() => {
    AsyncStorage.getItem("terminal-font-size").then((v) => {
      if (v) setFontSize(Number(v));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("terminal-font-size", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    let mounted = true;
    KeepAwake.activateKeepAwakeAsync().catch(() => {});
    return () => {
      if (!mounted) return;
      try {
        const fn = (KeepAwake as any).deactivateKeepAwake;
        if (typeof fn === "function") fn().catch(() => {});
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    if (prefill) {
      setInput(decodeURIComponent(prefill));
    }
  }, [prefill]);

  const openWs = useCallback(() => {
    if (!sessionId || isReconnecting.current) return;
    isReconnecting.current = true;

    const isHttps = DOMAIN_RAW.startsWith("https");
    const protocol = isHttps ? "wss:" : "ws:";
    const url = `${protocol}//${DOMAIN}/api/ws/terminal/${sessionId}`;
    const token = (globalThis as any).EXPO_PUBLIC_API_TOKEN as string | undefined;
    const urlWithToken = token ? `${url}?token=${encodeURIComponent(token)}` : url;

    let ws: WebSocket;
    try {
      ws = new WebSocket(urlWithToken);
    } catch (err) {
      isReconnecting.current = false;
      setReconnectStatus("Failed to create WebSocket connection");
      return;
    }
    wsRef.current = ws;

    const cleanupReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onopen = () => {
      isReconnecting.current = false;
      cleanupReconnectTimer();
      setConnected(true);
      reconnectAttempts.current = 0;
      setReconnectStatus("");
    };

    ws.onmessage = (e) => {
      setLines((prev) => {
        const next = [...prev, ...e.data.split("\n")];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    };

    ws.onclose = () => {
      isReconnecting.current = false;
      setConnected(false);
      if (shouldReconnect.current && reconnectAttempts.current < 10) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        setReconnectStatus(`Reconnecting (${reconnectAttempts.current}/10)...`);
        cleanupReconnectTimer();
        reconnectTimerRef.current = setTimeout(openWs, delay);
      } else {
        setReconnectStatus("Disconnected");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setReconnectStatus("Connection error. Attempting to reconnect...");
      isReconnecting.current = false;
      ws.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    shouldReconnect.current = true;
    reconnectAttempts.current = 0;
    isReconnecting.current = false;
    openWs();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      isReconnecting.current = false;
    };
  }, [sessionId]);

  const sendInput = (text?: string) => {
    const cmd = text ?? input;
    if (!cmd || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const sanitizedCmd = sanitizeCommand(cmd);
      wsRef.current.send(sanitizedCmd + "\n");
      if (text === undefined) {
        setHistory((prev) => {
          const next = [...prev, cmd];
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
        setHistoryIndex(-1);
        setInput("");
      }
    } catch (error: any) {
      console.log("Command validation failed:", error?.message);
      setReconnectStatus(`Error: ${error?.message || "Invalid command"}`);
    }
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

  const clearOutput = () => setLines([]);

  const changeFontSize = (delta: number) => {
    setFontSize((s) => Math.max(8, Math.min(20, s + delta)));
  };

  const renderAnsi = () => {
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
        <View style={[styles.statusDot, { backgroundColor: connected ? colors.primary : colors.destructive }]} />
        <Text style={styles.sessionId} numberOfLines={1}>Session</Text>
        <TouchableOpacity onPress={() => changeFontSize(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.fontBtn}>A-</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeFontSize(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.fontBtn}>A+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clearOutput} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {reconnectStatus !== "" && (
        <View style={styles.reconnectBanner}>
          <Text style={styles.reconnectText}>{reconnectStatus}</Text>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.outputContainer} contentContainerStyle={styles.outputContent}>
        {lines.length > 0 ? (
          renderAnsi()
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
  header: { flexDirection: "row", alignItems: "center", padding: 12, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  backBtn: { padding: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sessionId: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold", flex: 1 },
  fontBtn: { color: colors.primary, fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", paddingHorizontal: 8 },
  reconnectBanner: { backgroundColor: "rgba(255,170,0,0.15)", padding: 8, alignItems: "center" },
  reconnectText: { color: colors.warning, fontSize: 13, fontFamily: "Inter_500Medium" },
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
