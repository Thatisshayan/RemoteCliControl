import Foundation
import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState

    @State private var step = 0
    @State private var serverURL = ""
    @State private var apiToken = ""
    @State private var isTesting = false
    @State private var testError: String?

    var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.05, blue: 0.05).ignoresSafeArea()
            VStack(spacing: 24) {
                switch step {
                case 0: welcomeStep
                case 1: serverStep
                default: tokenStep
                }
            }
            .padding(24)
        }
        .foregroundStyle(.white)
    }

    private var welcomeStep: some View {
        VStack(spacing: 16) {
            Spacer()
            Text(">_")
                .font(.system(size: 56, weight: .bold, design: .monospaced))
            Text("RemoteCTRL")
                .font(.title)
                .bold()
            Text("Control your PC from your phone.")
                .foregroundStyle(.gray)
                .multilineTextAlignment(.center)
            Spacer()
            Button("Get Started") { step = 1 }
                .buttonStyle(.borderedProminent)
        }
    }

    private var serverStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Server Address")
                .font(.title2)
                .bold()
            Text("Enter the tunnel URL or local address shown by the RemoteCTRL desktop app.")
                .foregroundStyle(.gray)
            TextField("your-tunnel.trycloudflare.com", text: $serverURL)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .foregroundStyle(.black)
            Spacer()
            Button("Continue") {
                appState.saveBaseURL(serverURL)
                step = 2
            }
            .buttonStyle(.borderedProminent)
            .disabled(serverURL.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    private var tokenStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("API Token")
                .font(.title2)
                .bold()
            Text("Paste the API token from the desktop app's setup wizard. Leave blank if your server has no token configured.")
                .foregroundStyle(.gray)
            SecureField("API token (optional)", text: $apiToken)
                .textFieldStyle(.roundedBorder)
                .foregroundStyle(.black)

            if let testError {
                Text(testError)
                    .foregroundStyle(.red)
                    .font(.footnote)
            }

            Spacer()
            Button {
                Task { await testAndFinish() }
            } label: {
                if isTesting {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Connect")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isTesting)

            Button("Back") { step = 1 }
                .buttonStyle(.plain)
                .foregroundStyle(.gray)
        }
    }

    private func testAndFinish() async {
        isTesting = true
        testError = nil
        defer { isTesting = false }

        appState.saveAPIToken(apiToken)

        do {
            let _: HealthResponse = try await appState.client.get("/health", usesApiPrefix: false)
            appState.markOnboardingComplete()
        } catch {
            testError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

#Preview {
    OnboardingView().environmentObject(AppState())
}
