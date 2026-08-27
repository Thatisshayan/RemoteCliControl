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

    private func validate(_ data: Data, _ response: URLResponse) throws {
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
    }

    private func execute(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.network(error)
        }
        try validate(data, response)
        return data
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

        let data = try await execute(request)

        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// Raw bytes rather than a decoded JSON response -- for file downloads.
    func getRawData(_ path: String, query: [String: String]? = nil, usesApiPrefix: Bool = true) async throws -> Data {
        let url = try buildURL(path: path, usesApiPrefix: usesApiPrefix, query: query)
        var request = URLRequest(url: url)
        if let token = apiToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return try await execute(request)
    }

    /// multipart/form-data upload matching POST /api/files/upload's single
    /// required "file" field.
    func uploadFile(path: String, fileURL: URL) async throws -> SuccessResponse {
        let url = try buildURL(path: "/files/upload", usesApiPrefix: true, query: ["path": path])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        if let token = apiToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let fileData = try Data(contentsOf: fileURL)
        let filename = fileURL.lastPathComponent

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let data = try await execute(request)
        do {
            return try JSONDecoder().decode(SuccessResponse.self, from: data)
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
