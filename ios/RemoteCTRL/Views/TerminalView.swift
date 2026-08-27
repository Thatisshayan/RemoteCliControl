import Foundation
import SwiftUI

struct TerminalView: View {
    @EnvironmentObject var appState: AppState
    let session: Session

    // wsHandler.ts closes with this code when the given session id doesn't
    // exist server-side -- the normal outcome of a backend restart, since
    // sessions live only in server memory. Retrying forever would never
    // succeed; this needs a distinct "session lost" UX instead.
    private static let sessionNotFoundCode = 4004
    private static let maxLines = 5000
    private static let maxHistory = 100
    private static let fontSizeKey = "terminal-font-size"

    @State private var socket = TerminalSocket()
    @State private var lines: [String] = []
    @State private var input = ""
    @State private var connected = false
    @State private var reconnectStatus = ""
    @State private var sessionLost = false
    @State private var fontSize: CGFloat = 12
    @State private var history: [String] = []
    @State private var historyIndex = -1
    @State private var reconnectAttempts = 0
    @State private var reconnectTask: Task<Void, Never>?
    @State private var shouldReconnect = true

    var body: some View {
        VStack(spacing: 0) {
            header

            if !reconnectStatus.isEmpty {
                reconnectBanner
            }

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        if lines.isEmpty {
                            Text("Waiting for output...")
                                .foregroundStyle(.gray)
                                .font(.system(size: fontSize, design: .monospaced))
                        }
                        ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                            renderLine(line)
                                .id(index)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Color(red: 0.03, green: 0.03, blue: 0.03))
                .onChange(of: lines.count) { _ in
                    if let last = lines.indices.last {
                        withAnimation(nil) {
                            proxy.scrollTo(last, anchor: .bottom)
                        }
                    }
                }
            }

            quickKeys
            inputRow
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(session.title)
        .onAppear {
            fontSize = CGFloat(UserDefaults.standard.double(forKey: Self.fontSizeKey))
            if fontSize == 0 { fontSize = 12 }
            shouldReconnect = true
            reconnectAttempts = 0
            connectSocket()
        }
        .onDisappear {
            shouldReconnect = false
            reconnectTask?.cancel()
            socket.disconnect()
        }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(connected ? Color.green : Color.red)
                .frame(width: 8, height: 8)
            Text(connected ? "Connected" : "Disconnected")
                .font(.caption)
                .foregroundStyle(.gray)
            Spacer()
            Button {
                fontSize = max(8, fontSize - 1)
                UserDefaults.standard.set(Double(fontSize), forKey: Self.fontSizeKey)
            } label: {
                Text("A-").bold()
            }
            Button {
                fontSize = min(20, fontSize + 1)
                UserDefaults.standard.set(Double(fontSize), forKey: Self.fontSizeKey)
            } label: {
                Text("A+").bold()
            }
            Button {
                lines = []
            } label: {
                Image(systemName: "trash")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var reconnectBanner: some View {
        VStack(spacing: 8) {
            Text(reconnectStatus)
                .font(.footnote)
                .foregroundStyle(sessionLost ? .red : .yellow)
                .multilineTextAlignment(.center)
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .background(sessionLost ? Color.red.opacity(0.15) : Color.yellow.opacity(0.15))
    }

    private var quickKeys: some View {
        HStack(spacing: 8) {
            quickKeyButton("Tab") { sendRaw("\t") }
            quickKeyButton("Ctrl+C") { sendRaw("\u{03}") }
            quickKeyButton("Ctrl+D") { sendRaw("\u{04}") }
            Button(action: historyUp) {
                Image(systemName: "chevron.up")
            }
            Button(action: historyDown) {
                Image(systemName: "chevron.down")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    private func quickKeyButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.gray.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }

    private var inputRow: some View {
        HStack(spacing: 8) {
            TextField("Type command...", text: $input)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .disabled(!connected)
                .onSubmit { sendCurrentInput() }
            Button {
                sendCurrentInput()
            } label: {
                Image(systemName: "paperplane.fill")
            }
            .disabled(!connected)
        }
        .padding(12)
    }

    private func renderLine(_ line: String) -> Text {
        let segments = AnsiParser.parse(line, defaultColor: .green)
        return segments.reduce(Text("")) { partial, segment in
            partial + Text(segment.text)
                .font(.system(size: fontSize, design: .monospaced))
                .foregroundColor(segment.color)
                .fontWeight(segment.bold ? .bold : nil)
        }
    }

    // MARK: - Networking

    private func connectSocket() {
        guard let baseURL = URL(string: appState.baseURLString) else { return }
        let token = appState.apiToken.isEmpty ? nil : appState.apiToken

        socket.onEvent = { event in
            switch event {
            case .connected:
                connected = true
                sessionLost = false
                reconnectStatus = ""
                reconnectAttempts = 0
            case .output(let text):
                appendOutput(text)
            case .disconnected(let code, _):
                connected = false
                handleDisconnect(code: code)
            case .failed:
                connected = false
                handleDisconnect(code: nil)
            }
        }
        socket.connect(baseURL: baseURL, sessionId: session.id, apiToken: token)
    }

    private func handleDisconnect(code: Int?) {
        if code == Self.sessionNotFoundCode {
            shouldReconnect = false
            sessionLost = true
            reconnectStatus = "Session no longer exists on the server — it may have restarted."
            return
        }
        guard shouldReconnect else { return }
        if reconnectAttempts >= 10 {
            reconnectStatus = "Disconnected"
            return
        }
        reconnectAttempts += 1
        let delaySeconds = min(pow(2.0, Double(reconnectAttempts)), 30.0)
        reconnectStatus = "Reconnecting (\(reconnectAttempts)/10)..."
        reconnectTask?.cancel()
        reconnectTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(delaySeconds * 1_000_000_000))
            guard !Task.isCancelled, shouldReconnect else { return }
            connectSocket()
        }
    }

    private func appendOutput(_ text: String) {
        let newLines = text.components(separatedBy: "\n")
        lines.append(contentsOf: newLines)
        if lines.count > Self.maxLines {
            lines.removeFirst(lines.count - Self.maxLines)
        }
    }

    // MARK: - Input

    private func sendRaw(_ text: String) {
        send(text)
    }

    private func sendCurrentInput() {
        guard !input.isEmpty else { return }
        if send(input) {
            history.append(input)
            if history.count > Self.maxHistory {
                history.removeFirst(history.count - Self.maxHistory)
            }
            historyIndex = -1
            input = ""
        }
    }

    @discardableResult
    private func send(_ text: String) -> Bool {
        guard connected else { return false }
        do {
            let sanitized = try sanitizeCommand(text)
            socket.send(sanitized + "\n")
            return true
        } catch {
            reconnectStatus = "Error: \((error as? SanitizeCommandError)?.errorDescription ?? "Invalid command")"
            return false
        }
    }

    private func historyUp() {
        guard !history.isEmpty else { return }
        let newIndex = historyIndex == -1 ? history.count - 1 : max(0, historyIndex - 1)
        historyIndex = newIndex
        input = history[newIndex]
    }

    private func historyDown() {
        guard historyIndex != -1 else { return }
        let newIndex = historyIndex + 1
        if newIndex >= history.count {
            historyIndex = -1
            input = ""
        } else {
            historyIndex = newIndex
            input = history[newIndex]
        }
    }
}

#Preview {
    TerminalView(session: Session(id: "1", title: "Session 1", status: "connected", createdAt: ""))
        .environmentObject(AppState())
}
