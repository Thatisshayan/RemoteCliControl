import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var biometricLock: BiometricLockManager

    @State private var editingURL = ""
    @State private var editingToken = ""
    @State private var health: HealthResponse?
    @State private var tunnel: TunnelStatusResponse?
    @State private var isRefreshing = false
    @State private var errorMessage: String?
    @State private var showResetConfirm = false

    var body: some View {
        NavigationStack {
            form
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
                    resetConfirmActions
                }
        }
    }

    private var form: some View {
        Form {
            serverSection
            statusSection
            securitySection
            diagnosticsSection
            resetSection
        }
    }

    private var serverSection: some View {
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
    }

    @ViewBuilder
    private var statusSection: some View {
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
            refreshButton
        }
    }

    private var refreshButton: some View {
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

    private var securitySection: some View {
        Section("Security") {
            Toggle("Require Face ID / Touch ID", isOn: Binding(
                get: { biometricLock.isEnabled },
                set: { biometricLock.setEnabled($0) }
            ))
        }
    }

    private var diagnosticsSection: some View {
        Section {
            NavigationLink("Diagnostics") {
                DiagnosticsView()
            }
        }
    }

    private var resetSection: some View {
        Section {
            Button("Reset App", role: .destructive) {
                showResetConfirm = true
            }
        }
    }

    @ViewBuilder
    private var resetConfirmActions: some View {
        Button("Reset", role: .destructive) {
            appState.resetAll()
            editingURL = ""
            editingToken = ""
            health = nil
            tunnel = nil
        }
        Button("Cancel", role: .cancel) {}
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
    SettingsView()
        .environmentObject(AppState())
        .environmentObject(BiometricLockManager())
}
