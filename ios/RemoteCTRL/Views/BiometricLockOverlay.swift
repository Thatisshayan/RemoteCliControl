import SwiftUI

struct BiometricLockOverlay: View {
    @ObservedObject var manager: BiometricLockManager

    var body: some View {
        if manager.isLocked {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 16) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.white)
                    Text("RemoteCTRL is locked")
                        .font(.title3)
                        .bold()
                        .foregroundStyle(.white)
                    if let lastError = manager.lastError {
                        Text(lastError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    Button("Unlock") {
                        Task { await manager.authenticate() }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .transition(.opacity)
        }
    }
}
