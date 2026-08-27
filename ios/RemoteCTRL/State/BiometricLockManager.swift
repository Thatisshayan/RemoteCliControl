import Foundation
import LocalAuthentication

/// Face ID/Touch ID app lock. Deliberately biometrics-only (no device
/// passcode fallback) -- a stored biometric-lock preference shouldn't
/// quietly downgrade to a weaker unlock method, matching the old app's
/// stated behavior for the same feature.
@MainActor
final class BiometricLockManager: ObservableObject {
    @Published private(set) var isEnabled: Bool
    @Published private(set) var isLocked = false
    @Published private(set) var lastError: String?

    private static let enabledKey = "biometric-lock-enabled"

    init() {
        isEnabled = UserDefaults.standard.bool(forKey: Self.enabledKey)
    }

    func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: Self.enabledKey)
        if !enabled {
            isLocked = false
            lastError = nil
        }
    }

    func lock() {
        guard isEnabled else { return }
        isLocked = true
    }

    func authenticate() async {
        guard isLocked else { return }
        lastError = nil

        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        var evalError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &evalError) else {
            lastError = evalError?.localizedDescription ?? "Biometric authentication is not available on this device."
            return
        }

        let success = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock RemoteCTRL") { success, _ in
                continuation.resume(returning: success)
            }
        }

        if success {
            isLocked = false
            lastError = nil
        } else {
            lastError = "Authentication was not completed. Try again to unlock RemoteCTRL."
        }
    }
}
