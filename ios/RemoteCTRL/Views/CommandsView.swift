import Foundation
import SwiftUI

struct CommandsView: View {
    @EnvironmentObject var appState: AppState

    @State private var commands: [SavedCommand] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    @State private var showAddSheet = false
    @State private var newLabel = ""
    @State private var newCommand = ""
    @State private var newDescription = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Group {
                if commands.isEmpty && !isLoading {
                    VStack(spacing: 8) {
                        Image(systemName: "list.bullet.rectangle")
                            .font(.system(size: 40))
                            .foregroundStyle(.gray)
                        Text("No Saved Commands")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(commands) { command in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(command.label)
                                    .font(.headline)
                                Text(command.command)
                                    .font(.system(.footnote, design: .monospaced))
                                    .foregroundStyle(.gray)
                                if !command.description.isEmpty {
                                    Text(command.description)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .swipeActions {
                                Button(role: .destructive) {
                                    Task { await delete(command) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Commands")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        newLabel = ""
                        newCommand = ""
                        newDescription = ""
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $showAddSheet) {
                addSheet
            }
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

    private var addSheet: some View {
        NavigationStack {
            Form {
                Section("New Command") {
                    TextField("Label", text: $newLabel)
                    TextField("Command", text: $newCommand)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                    TextField("Description (optional)", text: $newDescription)
                }
            }
            .navigationTitle("New Command")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { showAddSheet = false }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await create() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(isSaving || newLabel.trimmingCharacters(in: .whitespaces).isEmpty || newCommand.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            commands = try await appState.client.get("/commands")
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func create() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let input = NewSavedCommandInput(
                label: newLabel,
                command: newCommand,
                description: newDescription.isEmpty ? nil : newDescription
            )
            let created: SavedCommand = try await appState.client.post("/commands", body: input)
            commands.append(created)
            showAddSheet = false
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func delete(_ command: SavedCommand) async {
        do {
            let _: SuccessResponse = try await appState.client.delete("/commands/\(command.id)")
            commands.removeAll { $0.id == command.id }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

#Preview {
    CommandsView().environmentObject(AppState())
}
