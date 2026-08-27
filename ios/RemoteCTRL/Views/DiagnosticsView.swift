import Foundation
import SwiftUI
import UIKit

struct DiagnosticsView: View {
    @EnvironmentObject var appState: AppState

    @State private var health: HealthResponse?
    @State private var tunnel: TunnelStatusResponse?
    @State private var isRefreshing = false
    @State private var errorMessage: String?
    @State private var copied = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    }

    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "unknown"
    }

    var body: some View {
        form
            .navigationTitle("Diagnostics")
            .navigationBarTitleDisplayMode(.inline)
            .task { await refresh() }
            .refreshable { await refresh() }
    }

    private var form: some View {
        Form {
            connectionSection
            serverSection
            appSection
            copySection
        }
    }

    private var connectionSection: some View {
        Section("Connection") {
            Row(label: "Base URL", value: appState.baseURLString.isEmpty ? "—" : appState.baseURLString)
            Row(label: "Auth State", value: appState.apiToken.isEmpty ? "No token (unauthenticated mode)" : "Token set")
        }
    }

    @ViewBuilder
    private var serverSection: some View {
        Section("Server") {
            if isRefreshing {
                ProgressView()
            }
            if let errorMessage {
                Text(errorMessage).foregroundStyle(.red)
            }
            Row(label: "Reachable", value: health == nil ? (isRefreshing ? "Checking..." : "No") : "Yes")
            if let health {
                Row(label: "Uptime", value: "\(health.uptimeSeconds / 60)m")
                Row(label: "Active Sessions", value: "\(health.activeSessions)")
                Row(label: "Server Version", value: health.version)
            }
            if let tunnel {
                Row(label: "Tunnel", value: tunnel.active ? (tunnel.tunnelUrl ?? "active") : "inactive")
            }
        }
    }

    private var appSection: some View {
        Section("App") {
            Row(label: "App Version", value: "\(appVersion) (\(buildNumber))")
            Row(label: "Platform", value: "iOS \(UIDevice.current.systemVersion)")
            Row(label: "Device", value: UIDevice.current.model)
        }
    }

    private var copySection: some View {
        Section {
            Button {
                UIPasteboard.general.string = snapshotText()
                copied = true
            } label: {
                Label(copied ? "Copied" : "Copy Diagnostics to Clipboard", systemImage: "doc.on.doc")
            }
        }
    }

    private func snapshotText() -> String {
        [
            "RemoteCTRL diagnostics",
            "Base URL: \(appState.baseURLString)",
            "Auth state: \(appState.apiToken.isEmpty ? "No token" : "Token set")",
            "Server reachable: \(health == nil ? "no" : "yes")",
            "Server version: \(health?.version ?? "—")",
            "Tunnel: \(tunnel?.active == true ? (tunnel?.tunnelUrl ?? "active") : "inactive")",
            "App version: \(appVersion) (\(buildNumber))",
            "Platform: iOS \(UIDevice.current.systemVersion), \(UIDevice.current.model)",
        ].joined(separator: "\n")
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

private struct Row: View {
    let label: String
    let value: String

    var body: some View {
        LabeledContent(label, value: value)
    }
}

#Preview {
    NavigationStack {
        DiagnosticsView().environmentObject(AppState())
    }
}
