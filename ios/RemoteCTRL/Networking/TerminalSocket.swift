import Foundation

enum TerminalEvent {
    case connected
    case output(String)
    case disconnected(code: Int, reason: String?)
    case failed(Error)
}

/// Talks to wsHandler.ts's /api/ws/terminal/{sessionId} endpoint. The token
/// travels as the Sec-WebSocket-Protocol header (not a query param) so it
/// never lands in access/proxy/edge logs -- matching the server's own
/// stated contract. Output arrives as raw text frames (not JSON-wrapped);
/// only resize is a structured message the client sends.
@MainActor
final class TerminalSocket: NSObject {
    private var task: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private(set) var isConnected = false

    var onEvent: ((TerminalEvent) -> Void)?

    func connect(baseURL: URL, sessionId: String, apiToken: String?) {
        disconnect()

        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return }
        components.scheme = (components.scheme == "https") ? "wss" : "ws"
        components.path = "/api/ws/terminal/\(sessionId)"
        guard let url = components.url else { return }

        var request = URLRequest(url: url)
        if let apiToken, !apiToken.isEmpty {
            request.setValue(apiToken, forHTTPHeaderField: "Sec-WebSocket-Protocol")
        }

        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        self.urlSession = session
        let newTask = session.webSocketTask(with: request)
        self.task = newTask
        newTask.resume()
        listen(on: newTask)
    }

    private func listen(on task: URLSessionWebSocketTask) {
        Task { [weak self] in
            while true {
                guard let self, self.task === task else { return }
                do {
                    let message = try await task.receive()
                    switch message {
                    case .string(let text):
                        self.onEvent?(.output(text))
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            self.onEvent?(.output(text))
                        }
                    @unknown default:
                        break
                    }
                } catch {
                    if self.task === task {
                        self.onEvent?(.failed(error))
                    }
                    return
                }
            }
        }
    }

    func send(_ text: String) {
        task?.send(.string(text)) { _ in }
    }

    func sendResize(rows: Int, cols: Int) {
        let payload = #"{"type":"resize","rows":\#(rows),"cols":\#(cols)}"#
        task?.send(.string(payload)) { _ in }
    }

    func disconnect() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        isConnected = false
    }
}

extension TerminalSocket: URLSessionWebSocketDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol _: String?
    ) {
        Task { @MainActor in
            self.isConnected = true
            self.onEvent?(.connected)
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let reasonText = reason.flatMap { String(data: $0, encoding: .utf8) }
        Task { @MainActor in
            self.isConnected = false
            self.onEvent?(.disconnected(code: closeCode.rawValue, reason: reasonText))
        }
    }
}
