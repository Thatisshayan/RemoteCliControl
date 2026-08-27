import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState

    @State private var editingURL = ""
    @State private var editingToken = ""
    @State private var health: HealthResponse?
    @State private var tunnel: TunnelStatusResponse?
    @State private var isRefreshing = false
    @State private var errorMessage: String?
    @State private var showResetConfirm = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Server URL", text: $editingURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    SecureField("API Token", text: $editingToken)
                    Button("Save") {
                        appState.saveBaseURL(editingURL)
                        appState.saveAPIToken(editingToken)
                        Task { await refresh() }
                    }
                }

                Section("Status") {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                    LabeledContent("Reachable", value: health == nil ? "Unknown" : "Yes")
                    if let health {
                        LabeledContent("Server Version", value: health.version)
                        LabeledContent("Active Sessions", value: "\(health.activeSessions)")
                        LabeledContent("Uptime", value: "\(health.uptimeSeconds / 60)m")
                        LabeledContent("Auth Mode", value: health.authMode)
                    }
                    if let tunnel {
                        LabeledContent("Tunnel", value: tunnel.active ? (tunnel.tunnelUrl ?? "active") : "inactive")
                    }
                    Button {
                        Task { await refresh() }
                    } label: {
                        if isRefreshing {
                            ProgressView()
                        } else {
                            Text("Refresh")
                        }
                    }
                    .disabled(isRefreshing)
                }

                Section {
                    Button("Reset App", role: .destructive) {
                        showResetConfirm = true
                    }
                }
            }
            .navigationTitle("Settings")
            .task {
                editingURL = appState.baseURLString
                editingToken = appState.apiToken
                await refresh()
            }
            .confirmationDialog(
                "Reset app and sign out?",
                isPresented: $showResetConfirm,
                titleVisibility: .visible
            ) {
                Button("Reset", role: .destructive) {
                    appState.resetAll()
                    editingURL = ""
                    editingToken = ""
                    health = nil
                    tunnel = nil
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private func refresh() async {
        isRefreshing = true
        errorMessage = nil
        defer { isRefreshing = false }
        do {
            health = try await appState.client.get("/health", usesApiPrefix: false)
        } catch {
            health = nil
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        tunnel = try? await appState.client.get("/tunnel-url", usesApiPrefix: false)
    }
}

#Preview {
    SettingsView().environmentObject(AppState())
}
