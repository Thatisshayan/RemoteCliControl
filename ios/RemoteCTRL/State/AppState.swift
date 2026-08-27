import Foundation

/// Root app state: server URL, API token, and onboarding status, backed by
/// UserDefaults (non-sensitive) and Keychain (token). Equivalent role to
/// the old app's RuntimeConfigProvider.
final class AppState: ObservableObject {
    @Published private(set) var baseURLString: String
    @Published private(set) var apiToken: String
    @Published private(set) var onboardingComplete: Bool

    let client: APIClient

    private static let baseURLKey = "server-url"
    private static let onboardingKey = "onboardingComplete"
    private static let fallbackURL = URL(string: "http://localhost:3000")!

    init() {
        let savedURL = UserDefaults.standard.string(forKey: Self.baseURLKey) ?? ""
        let savedToken = KeychainStore.read() ?? ""
        let onboardingDone = UserDefaults.standard.bool(forKey: Self.onboardingKey)

        self.baseURLString = savedURL
        self.apiToken = savedToken
        self.onboardingComplete = onboardingDone
        self.client = APIClient(
            baseURL: URL(string: savedURL) ?? Self.fallbackURL,
            apiToken: savedToken.isEmpty ? nil : savedToken
        )
    }

    /// Adds a scheme if the user pasted a bare host (defaults to https,
    /// since tunnel URLs are always TLS; local dev servers can type
    /// http:// explicitly).
    private func normalizeURL(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }
        if trimmed.lowercased().hasPrefix("http://") || trimmed.lowercased().hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }

    func saveBaseURL(_ url: String) {
        let normalized = normalizeURL(url)
        baseURLString = normalized
        UserDefaults.standard.set(normalized, forKey: Self.baseURLKey)
        if let parsed = URL(string: normalized) {
            client.baseURL = parsed
        }
    }

    func saveAPIToken(_ token: String) {
        let normalized = token.trimmingCharacters(in: .whitespacesAndNewlines)
        apiToken = normalized
        if normalized.isEmpty {
            KeychainStore.delete()
            client.apiToken = nil
        } else {
            KeychainStore.save(normalized)
            client.apiToken = normalized
        }
    }

    func markOnboardingComplete() {
        onboardingComplete = true
        UserDefaults.standard.set(true, forKey: Self.onboardingKey)
    }

    func resetAll() {
        UserDefaults.standard.removeObject(forKey: Self.baseURLKey)
        UserDefaults.standard.removeObject(forKey: Self.onboardingKey)
        KeychainStore.delete()
        baseURLString = ""
        apiToken = ""
        onboardingComplete = false
        client.baseURL = Self.fallbackURL
        client.apiToken = nil
    }
}
