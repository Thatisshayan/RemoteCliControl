import Foundation

// Mirrors lib/api-spec/openapi.yaml. Field names match the JSON keys
// exactly (camelCase both sides) so no custom CodingKeys are needed.

struct HealthResponse: Decodable {
    let status: String
    let activeSessions: Int
    let connectionConfigured: Bool
    let uptimeSeconds: Int
    let version: String
    let authMode: String
    let tunnelEnabled: Bool
}

struct TunnelStatusResponse: Decodable {
    let active: Bool
    let tunnelUrl: String?
}

struct VersionResponse: Decodable {
    let version: String
    let mobileMinVersion: String?
}

struct SuccessResponse: Decodable {
    let success: Bool
}

struct TestResult: Decodable {
    let success: Bool
    let message: String
    let latencyMs: Double
}

struct ConnectionProfileSafe: Decodable, Identifiable {
    let id: String
    let name: String
    let host: String
    let port: Int
    let username: String
    let authMode: String
    let hasPassword: Bool
    let hasPrivateKey: Bool
    let hasPassphrase: Bool
}

/// Matches ConnectionInput's oneOf(PasswordAuth, KeyAuth) by only
/// populating the fields relevant to `authMode`; the other side's optional
/// fields stay nil and are omitted from the encoded JSON automatically.
struct ConnectionInput: Encodable {
    let host: String
    let port: Int
    let username: String
    let authMode: String
    let password: String?
    let privateKey: String?
    let passphrase: String?
}

/// NamedConnectionInput is `allOf [{name}, ConnectionInput]` in the spec,
/// i.e. a single flat JSON object -- modeled directly as one flat struct
/// rather than trying to compose nested Encodables.
struct NamedConnectionInput: Encodable {
    let name: String
    let host: String
    let port: Int
    let username: String
    let authMode: String
    let password: String?
    let privateKey: String?
    let passphrase: String?

    init(name: String, input: ConnectionInput) {
        self.name = name
        self.host = input.host
        self.port = input.port
        self.username = input.username
        self.authMode = input.authMode
        self.password = input.password
        self.privateKey = input.privateKey
        self.passphrase = input.passphrase
    }
}
