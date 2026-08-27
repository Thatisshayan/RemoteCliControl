import SwiftUI

/// Phase 4: full feature set including biometric lock (see ContentView's
/// overlay) and diagnostics (a Settings sub-screen). Push notifications
/// remain deferred until the App ID's Push Notifications capability is
/// confirmed enabled -- adding the entitlement without it would break
/// code signing.
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
    MainTabView()
        .environmentObject(AppState())
        .environmentObject(BiometricLockManager())
}
