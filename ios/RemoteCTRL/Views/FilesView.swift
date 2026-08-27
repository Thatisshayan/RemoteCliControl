import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct FilesView: View {
    @EnvironmentObject var appState: AppState

    @State private var pathStack: [String] = []
    @State private var items: [FileItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    @State private var showNewFolderPrompt = false
    @State private var newFolderName = ""

    @State private var showFileImporter = false
    @State private var isUploading = false

    @State private var previewContent: String?
    @State private var previewName: String?

    @State private var actionTarget: FileItem?
    @State private var shareURL: URL?

    @State private var renameTarget: FileItem?
    @State private var renameText = ""

    private var currentPath: String? { pathStack.last }

    // `body` intentionally stays tiny: a single base view with each
    // presentation modifier chained on separately. Swift's type-checker
    // previously choked ("unable to type-check this expression in
    // reasonable time") when the NavigationStack, its content, and every
    // alert/sheet/dialog modifier were all part of one expression --
    // splitting into small, individually-typed properties fixes that.
    var body: some View {
        screen
            .alert("New Folder", isPresented: $showNewFolderPrompt) {
                newFolderAlertActions
            }
            .alert("Rename", isPresented: renameAlertPresented) {
                renameAlertActions
            }
            .confirmationDialog(
                actionTarget?.name ?? "",
                isPresented: actionDialogPresented,
                titleVisibility: .visible
            ) {
                actionDialogButtons
            }
            .sheet(isPresented: previewSheetPresented) {
                previewSheet
            }
            .sheet(isPresented: shareSheetPresented) {
                shareSheetContent
            }
            .alert("Error", isPresented: errorAlertPresented) {
                errorAlertActions
            } message: {
                errorAlertMessage
            }
    }

    private var screen: some View {
        NavigationStack {
            fileListContent
                .navigationTitle(navTitle)
                .toolbar { toolbarContent }
                .task { await load() }
                .refreshable { await load() }
                .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.item], onCompletion: handleImport)
        }
    }

    private var navTitle: String {
        guard let last = pathStack.last else { return "Files" }
        return last.split(separator: "/").last.map(String.init) ?? "Files"
    }

    @ViewBuilder
    private var fileListContent: some View {
        if items.isEmpty && !isLoading {
            emptyState
        } else {
            fileList
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "folder")
                .font(.system(size: 40))
                .foregroundStyle(.gray)
            Text("Empty Directory")
                .font(.headline)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fileList: some View {
        List {
            ForEach(items) { item in
                fileRow(item)
            }
        }
    }

    private func fileRow(_ item: FileItem) -> some View {
        Button {
            handleTap(item)
        } label: {
            HStack {
                Image(systemName: item.isDirectory ? "folder.fill" : "doc.fill")
                    .foregroundStyle(item.isDirectory ? .yellow : .gray)
                VStack(alignment: .leading) {
                    Text(item.name)
                        .foregroundStyle(.primary)
                    if !item.isDirectory {
                        Text(formattedSize(item.size))
                            .font(.caption)
                            .foregroundStyle(.gray)
                    }
                }
                Spacer()
            }
        }
        .swipeActions {
            Button(role: .destructive) {
                Task { await delete(item) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            Button {
                renameTarget = item
                renameText = item.name
            } label: {
                Label("Rename", systemImage: "pencil")
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            if !pathStack.isEmpty {
                Button {
                    pathStack.removeLast()
                    Task { await load() }
                } label: {
                    Image(systemName: "chevron.left")
                }
            }
        }
        ToolbarItemGroup(placement: .navigationBarTrailing) {
            Button {
                showFileImporter = true
            } label: {
                if isUploading {
                    ProgressView()
                } else {
                    Image(systemName: "square.and.arrow.up")
                }
            }
            .disabled(isUploading)

            Button {
                newFolderName = ""
                showNewFolderPrompt = true
            } label: {
                Image(systemName: "folder.badge.plus")
            }
        }
    }

    @ViewBuilder
    private var newFolderAlertActions: some View {
        TextField("Folder name", text: $newFolderName)
        Button("Create") { Task { await createFolder() } }
        Button("Cancel", role: .cancel) {}
    }

    @ViewBuilder
    private var renameAlertActions: some View {
        TextField("New name", text: $renameText)
        Button("Rename") { Task { await rename() } }
        Button("Cancel", role: .cancel) { renameTarget = nil }
    }

    @ViewBuilder
    private var actionDialogButtons: some View {
        Button("Preview") { Task { await preview() } }
        Button("Download & Share") { Task { await download() } }
        Button("Cancel", role: .cancel) { actionTarget = nil }
    }

    @ViewBuilder
    private var errorAlertActions: some View {
        Button("OK") { errorMessage = nil }
    }

    private var errorAlertMessage: some View {
        Text(errorMessage ?? "")
    }

    private var previewSheet: some View {
        NavigationStack {
            ScrollView {
                Text(previewContent ?? "")
                    .font(.system(.body, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .navigationTitle(previewName ?? "Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { previewContent = nil }
                }
            }
        }
    }

    @ViewBuilder
    private var shareSheetContent: some View {
        if let shareURL {
            ShareSheet(items: [shareURL])
        }
    }

    private var renameAlertPresented: Binding<Bool> {
        Binding(get: { renameTarget != nil }, set: { if !$0 { renameTarget = nil } })
    }

    private var actionDialogPresented: Binding<Bool> {
        Binding(get: { actionTarget != nil }, set: { if !$0 { actionTarget = nil } })
    }

    private var previewSheetPresented: Binding<Bool> {
        Binding(get: { previewContent != nil }, set: { if !$0 { previewContent = nil } })
    }

    private var shareSheetPresented: Binding<Bool> {
        Binding(get: { shareURL != nil }, set: { if !$0 { shareURL = nil } })
    }

    private var errorAlertPresented: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func handleImport(_ result: Result<URL, Error>) {
        if case .success(let url) = result {
            Task { await upload(from: url) }
        }
    }

    private func formattedSize(_ bytes: Double) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }

    private func handleTap(_ item: FileItem) {
        if item.isDirectory {
            pathStack.append(item.path)
            Task { await load() }
        } else {
            actionTarget = item
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            var query: [String: String]?
            if let currentPath { query = ["path": currentPath] }
            let response: FileListResponse = try await appState.client.get("/files", query: query)
            items = response.items.sorted { lhs, rhs in
                if lhs.isDirectory != rhs.isDirectory { return lhs.isDirectory }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func delete(_ item: FileItem) async {
        do {
            let _: SuccessResponse = try await appState.client.delete("/files", query: ["path": item.path])
            await load()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func createFolder() async {
        let trimmed = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let base = currentPath.map { $0.hasSuffix("/") ? $0 : "\($0)/" } ?? ""
        let newPath = base + trimmed
        do {
            let _: SuccessResponse = try await appState.client.post("/files/mkdir", body: FilePathInput(path: newPath))
            await load()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func rename() async {
        guard let renameTarget else { return }
        let trimmed = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let parent = renameTarget.path.split(separator: "/").dropLast().joined(separator: "/")
        let newPath = parent.isEmpty ? trimmed : "\(parent)/\(trimmed)"
        do {
            let _: SuccessResponse = try await appState.client.patch(
                "/files/rename",
                body: FileRenameInput(from: renameTarget.path, to: newPath)
            )
            self.renameTarget = nil
            await load()
        } catch {
            self.renameTarget = nil
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func preview() async {
        guard let target = actionTarget else { return }
        actionTarget = nil
        do {
            let response: FileReadResponse = try await appState.client.get("/files/read", query: ["path": target.path])
            previewName = target.name
            previewContent = response.content
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func download() async {
        guard let target = actionTarget else { return }
        actionTarget = nil
        do {
            let data = try await appState.client.getRawData("/files/download", query: ["path": target.path])
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(target.name)
            try data.write(to: tempURL, options: .atomic)
            shareURL = tempURL
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func upload(from url: URL) async {
        isUploading = true
        defer { isUploading = false }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let base = currentPath.map { $0.hasSuffix("/") ? $0 : "\($0)/" } ?? ""
            let destPath = base + url.lastPathComponent
            let _ = try await appState.client.uploadFile(path: destPath, fileURL: url)
            await load()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

/// UIKit share sheet bridge -- SwiftUI's ShareLink needs to already be
/// visible to tap, which doesn't fit "download completes, then share";
/// this presents immediately once the file is on disk.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    FilesView().environmentObject(AppState())
}
