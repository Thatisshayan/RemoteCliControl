import SwiftUI

/// Root router: onboarding until the server URL/token are set and verified,
/// then the main tab flow.
struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if appState.onboardingComplete {
                MainTabView()
            } else {
                OnboardingView()
            }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    ContentView().environmentObject(AppState())
}
