import SwiftUI

/// Phase 2: Connection + Terminal + Settings. Files/Processes/Commands
/// tabs are added in Phase 3 once the SFTP/process endpoints are wired up.
struct MainTabView: View {
    var body: some View {
        TabView {
            ConnectionView()
                .tabItem { Label("Connection", systemImage: "network") }
            SessionListView()
                .tabItem { Label("Terminal", systemImage: "terminal") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

#Preview {
    MainTabView().environmentObject(AppState())
}
