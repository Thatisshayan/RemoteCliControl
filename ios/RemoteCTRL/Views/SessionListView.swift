import SwiftUI

struct SessionListView: View {
    @EnvironmentObject var appState: AppState

    @State private var sessions: [Session] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty && !isLoading {
                    VStack(spacing: 12) {
                        Image(systemName: "terminal")
                            .font(.system(size: 40))
                            .foregroundStyle(.gray)
                        Text("No Sessions")
                            .font(.headline)
                        Text("Start a new terminal session on your active connection.")
                            .font(.subheadline)
                            .foregroundStyle(.gray)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(sessions) { session in
                            NavigationLink(value: session) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(session.title)
                                        .font(.headline)
                                    Text(session.status)
                                        .font(.caption)
                                        .foregroundStyle(statusColor(session.status))
                                }
                            }
                        }
                        .onDelete { indexSet in
                            Task { await deleteSessions(at: indexSet) }
                        }
                    }
                }
            }
            .navigationTitle("Terminal")
            .navigationDestination(for: Session.self) { session in
                TerminalView(session: session)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await createSession() }
                    } label: {
                        if isCreating {
                            ProgressView()
                        } else {
                            Image(systemName: "plus")
                        }
                    }
                    .disabled(isCreating)
                }
            }
            .task { await loadSessions() }
            .refreshable { await loadSessions() }
            .alert("Error", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "connected": return .green
        case "connecting": return .yellow
        case "error": return .red
        default: return .gray
        }
    }

    private func loadSessions() async {
        isLoading = true
        defer { isLoading = false }
        do {
            sessions = try await appState.client.get("/sessions")
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func createSession() async {
        isCreating = true
        defer { isCreating = false }
        do {
            let session: Session = try await appState.client.post("/sessions")
            sessions.append(session)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func deleteSessions(at indexSet: IndexSet) async {
        for index in indexSet {
            let session = sessions[index]
            do {
                let _: SuccessResponse = try await appState.client.delete("/sessions/\(session.id)")
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
        await loadSessions()
    }
}

#Preview {
    SessionListView().environmentObject(AppState())
}
