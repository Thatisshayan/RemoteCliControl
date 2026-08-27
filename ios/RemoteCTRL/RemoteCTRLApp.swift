import SwiftUI

@main
struct RemoteCTRLApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var biometricLock = BiometricLockManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(biometricLock)
        }
    }
}
