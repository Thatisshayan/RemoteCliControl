import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(status: Int, code: String, message: String)
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL."
        case .invalidResponse:
            return "The server returned an unexpected response."
        case .server(_, _, let message):
            return message
        case .decoding:
            return "Could not understand the server's response."
        case .network(let err):
            return err.localizedDescription
        }
    }
}

private struct ServerErrorBody: Decodable {
    let error: String?
    let code: String?
}

/// Phantom "no body" placeholder for GET/DELETE/bodyless-POST -- `Never`
/// doesn't conform to Encodable, so this fills the generic slot instead.
private struct NoBody: Encodable {}

/// Thin async/await REST client for the RemoteCTRL backend. All SSH work
/// happens on the Windows server itself (sshManager/wsHandler) -- this app
/// only ever talks REST + WebSocket to it, never SSH directly.
final class APIClient {
    var baseURL: URL
    var apiToken: String?

    init(baseURL: URL, apiToken: String?) {
        self.baseURL = baseURL
        self.apiToken = apiToken
    }

    private func buildURL(path: String, usesApiPrefix: Bool, query: [String: String]?) throws -> URL {
        let prefix = usesApiPrefix ? "/api" : ""
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        components.path = prefix + normalizedPath
        if let query, !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else { throw APIError.invalidURL }
        return url
    }

    private func send<Body: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Body?,
        query: [String: String]? = nil,
        usesApiPrefix: Bool = true
    ) async throws -> Response {
        let url = try buildURL(path: path, usesApiPrefix: usesApiPrefix, query: query)

        var request = URLRequest(url: url)
        request.httpMethod = method
        if let token = apiToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let errorBody = try? JSONDecoder().decode(ServerErrorBody.self, from: data)
            throw APIError.server(
                status: http.statusCode,
                code: errorBody?.code ?? "HTTP_\(http.statusCode)",
                message: errorBody?.error ?? "Request failed with status \(http.statusCode)"
            )
        }

        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    func get<Response: Decodable>(
        _ path: String,
        query: [String: String]? = nil,
        usesApiPrefix: Bool = true
    ) async throws -> Response {
        try await send(path: path, method: "GET", body: Optional<NoBody>.none, query: query, usesApiPrefix: usesApiPrefix)
    }

    func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
        usesApiPrefix: Bool = true
    ) async throws -> Response {
        try await send(path: path, method: "POST", body: body, usesApiPrefix: usesApiPrefix)
    }

    func post<Response: Decodable>(
        _ path: String,
        usesApiPrefix: Bool = true
    ) async throws -> Response {
        try await send(path: path, method: "POST", body: Optional<NoBody>.none, usesApiPrefix: usesApiPrefix)
    }

    func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
        usesApiPrefix: Bool = true
    ) async throws -> Response {
        try await send(path: path, method: "PATCH", body: body, usesApiPrefix: usesApiPrefix)
    }

    func delete<Response: Decodable>(
        _ path: String,
        query: [String: String]? = nil,
        usesApiPrefix: Bool = true
    ) async throws -> Response {
        try await send(path: path, method: "DELETE", body: Optional<NoBody>.none, query: query, usesApiPrefix: usesApiPrefix)
    }
}
