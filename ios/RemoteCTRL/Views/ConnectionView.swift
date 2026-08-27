import Foundation
import SwiftUI

struct ConnectionView: View {
    @EnvironmentObject var appState: AppState

    @State private var host = ""
    @State private var port = "22"
    @State private var username = ""
    @State private var authMode: AuthMode = .password
    @State private var password = ""
    @State private var privateKey = ""
    @State private var passphrase = ""
    @State private var isBusy = false
    @State private var statusMessage: String?
    @State private var statusIsError = false
    @State private var activeConnection: ConnectionProfileSafe?

    enum AuthMode: String, CaseIterable, Identifiable {
        case password, key
        var id: String { rawValue }
        var label: String { self == .password ? "Password" : "SSH Key" }
    }

    var body: some View {
        NavigationStack {
            Form {
                if let activeConnection {
                    Section("Active Connection") {
                        LabeledContent("Host", value: "\(activeConnection.host):\(activeConnection.port)")
                        LabeledContent("User", value: activeConnection.username)
                    }
                }

                Section("New Connection") {
                    TextField("Host", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Picker("Auth Method", selection: $authMode) {
                        ForEach(AuthMode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    if authMode == .password {
                        SecureField("Password", text: $password)
                    } else {
                        TextField("Private Key (PEM)", text: $privateKey, axis: .vertical)
                            .lineLimit(4...8)
                        SecureField("Passphrase (optional)", text: $passphrase)
                    }
                }

                if let statusMessage {
                    Section {
                        Text(statusMessage)
                            .foregroundStyle(statusIsError ? .red : .green)
                    }
                }

                Section {
                    Button("Test Connection") {
                        Task { await test() }
                    }
                    .disabled(isBusy || !formValid)

                    Button("Save & Activate") {
                        Task { await saveAndActivate() }
                    }
                    .disabled(isBusy || !formValid)
                }
            }
            .navigationTitle("Connection")
            .task { await loadActive() }
        }
    }

    private var formValid: Bool {
        guard !host.trimmingCharacters(in: .whitespaces).isEmpty,
              !username.trimmingCharacters(in: .whitespaces).isEmpty,
              Int(port) != nil else { return false }
        if authMode == .password {
            return !password.isEmpty
        } else {
            return !privateKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    private func buildInput() -> ConnectionInput {
        ConnectionInput(
            host: host,
            port: Int(port) ?? 22,
            username: username,
            authMode: authMode == .password ? "password" : "key",
            password: authMode == .password ? password : nil,
            privateKey: authMode == .key ? privateKey : nil,
            passphrase: authMode == .key && !passphrase.isEmpty ? passphrase : nil
        )
    }

    private func loadActive() async {
        do {
            let profile: ConnectionProfileSafe = try await appState.client.get("/connections/active")
            activeConnection = profile
        } catch {
            activeConnection = nil
        }
    }

    private func test() async {
        isBusy = true
        statusMessage = nil
        defer { isBusy = false }
        do {
            let result: TestResult = try await appState.client.post("/connection/test", body: buildInput())
            statusIsError = !result.success
            statusMessage = result.message
        } catch {
            statusIsError = true
            statusMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func saveAndActivate() async {
        isBusy = true
        statusMessage = nil
        defer { isBusy = false }
        do {
            let named = NamedConnectionInput(name: "\(username)@\(host)", input: buildInput())
            let profile: ConnectionProfileSafe = try await appState.client.post("/connections", body: named)
            let _: SuccessResponse = try await appState.client.post("/connections/\(profile.id)/activate")
            activeConnection = profile
            statusIsError = false
            statusMessage = "Connection saved and activated."
        } catch {
            statusIsError = true
            statusMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

#Preview {
    ConnectionView().environmentObject(AppState())
}
