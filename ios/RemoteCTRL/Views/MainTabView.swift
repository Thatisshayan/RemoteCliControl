import SwiftUI

/// Phase 1: Connection + Settings only. Terminal/Files/Processes/Commands
/// tabs are added in later phases once the backend WebSocket/SFTP/process
/// endpoints are wired up.
struct MainTabView: View {
    var body: some View {
        TabView {
            ConnectionView()
                .tabItem { Label("Connection", systemImage: "network") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

#Preview {
    MainTabView().environmentObject(AppState())
}
