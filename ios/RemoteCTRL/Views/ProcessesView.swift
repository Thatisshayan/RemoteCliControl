import Foundation
import SwiftUI

struct ProcessesView: View {
    @EnvironmentObject var appState: AppState

    @State private var processes: [RemoteProcess] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    private var filtered: [RemoteProcess] {
        guard !searchText.isEmpty else { return processes }
        return processes.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(filtered) { process in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(process.name)
                                .font(.body)
                            Text("PID \(process.pid) · \(process.user)")
                                .font(.caption)
                                .foregroundStyle(.gray)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(String(format: "%.1f%% CPU", process.cpu))
                                .font(.caption)
                            Text(String(format: "%.0f MB", process.memory))
                                .font(.caption)
                                .foregroundStyle(.gray)
                        }
                        if process.status != "running" {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            Task { await kill(process) }
                        } label: {
                            Label("Kill", systemImage: "xmark.octagon")
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Filter processes")
            .navigationTitle("Processes")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await load() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(isLoading)
                }
            }
            .task { await load() }
            .refreshable { await load() }
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

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            processes = try await appState.client.get("/processes")
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func kill(_ process: RemoteProcess) async {
        do {
            let _: SuccessResponse = try await appState.client.delete("/processes/\(process.pid)")
            processes.removeAll { $0.pid == process.pid }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

#Preview {
    ProcessesView().environmentObject(AppState())
}
