import SwiftUI

/// Phase 3: full feature set except biometric lock / push notifications /
/// diagnostics, which land in Phase 4.
struct MainTabView: View {
    var body: some View {
        TabView {
            ConnectionView()
                .tabItem { Label("Connection", systemImage: "network") }
            SessionListView()
                .tabItem { Label("Terminal", systemImage: "terminal") }
            FilesView()
                .tabItem { Label("Files", systemImage: "folder") }
            ProcessesView()
                .tabItem { Label("Processes", systemImage: "cpu") }
            CommandsView()
                .tabItem { Label("Commands", systemImage: "list.bullet.rectangle") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

#Preview {
    MainTabView().environmentObject(AppState())
}
