import SwiftUI

/// Root router: onboarding until the server URL/token are set and verified,
/// then the main tab flow, with a biometric lock overlay on top once
/// onboarding is done (locks on background, prompts on foreground/launch).
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var biometricLock: BiometricLockManager
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        mainContent
            .preferredColorScheme(.dark)
            .onChange(of: scenePhase, perform: handleScenePhaseChange)
            .task { await lockIfNeededOnLaunch() }
    }

    @ViewBuilder
    private var mainContent: some View {
        ZStack {
            rootFlow
            if appState.onboardingComplete {
                BiometricLockOverlay(manager: biometricLock)
            }
        }
    }

    @ViewBuilder
    private var rootFlow: some View {
        if appState.onboardingComplete {
            MainTabView()
        } else {
            OnboardingView()
        }
    }

    private func handleScenePhaseChange(_ newPhase: ScenePhase) {
        guard appState.onboardingComplete else { return }
        if newPhase == .background {
            biometricLock.lock()
        } else if newPhase == .active && biometricLock.isLocked {
            Task { await biometricLock.authenticate() }
        }
    }

    private func lockIfNeededOnLaunch() async {
        guard appState.onboardingComplete, biometricLock.isEnabled else { return }
        biometricLock.lock()
        await biometricLock.authenticate()
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(BiometricLockManager())
}
