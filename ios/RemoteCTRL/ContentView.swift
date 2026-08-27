import SwiftUI

/// Phase 0 placeholder: this screen exists only to prove the native
/// project/signing/CI pipeline works end to end before any real feature
/// code is written on top of it. Replaced in Phase 1 by onboarding.
struct ContentView: View {
    var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.05, blue: 0.05)
                .ignoresSafeArea()
            VStack(spacing: 12) {
                Text(">_")
                    .font(.system(size: 48, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
                Text("RemoteCTRL")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Native rebuild — foundation build")
                    .font(.system(size: 13))
                    .foregroundStyle(.gray)
            }
        }
    }
}

#Preview {
    ContentView()
}
