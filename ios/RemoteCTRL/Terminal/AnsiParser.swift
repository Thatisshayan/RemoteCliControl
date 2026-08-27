import Foundation
import SwiftUI

struct AnsiSegment {
    let text: String
    let color: Color
    let bold: Bool
}

/// Basic SGR color-code parser (16-color palette + bold) -- not a full
/// VT100 emulator, matching the old app's line-buffered terminal (each
/// server output chunk is split on "\n" and rendered as plain colored
/// text, not a real character-grid terminal).
enum AnsiParser {
    private static let colors: [Int: Color] = [
        30: Color(red: 0.30, green: 0.30, blue: 0.30),
        31: Color(red: 1.00, green: 0.27, blue: 0.27),
        32: Color(red: 0.00, green: 1.00, blue: 0.53),
        33: Color(red: 1.00, green: 0.67, blue: 0.00),
        34: Color(red: 0.33, green: 0.60, blue: 1.00),
        35: Color(red: 0.80, green: 0.27, blue: 1.00),
        36: Color(red: 0.00, green: 0.80, blue: 1.00),
        37: Color(red: 0.88, green: 0.88, blue: 0.88),
        90: Color(red: 0.60, green: 0.60, blue: 0.60),
        91: Color(red: 1.00, green: 0.40, blue: 0.40),
        92: Color(red: 0.20, green: 1.00, blue: 0.60),
        93: Color(red: 1.00, green: 0.80, blue: 0.27),
        94: Color(red: 0.47, green: 0.73, blue: 1.00),
        95: Color(red: 0.87, green: 0.47, blue: 1.00),
        97: Color.white,
    ]

    static func parse(_ text: String, defaultColor: Color) -> [AnsiSegment] {
        var segments: [AnsiSegment] = []
        var currentColor = defaultColor
        var currentBold = false

        guard let regex = try? NSRegularExpression(pattern: #"\x1B\[([0-9;]*)m"#) else {
            return [AnsiSegment(text: text, color: defaultColor, bold: false)]
        }

        let nsText = text as NSString
        var lastIndex = 0
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))

        for match in matches {
            if match.range.location > lastIndex {
                let chunk = nsText.substring(with: NSRange(location: lastIndex, length: match.range.location - lastIndex))
                segments.append(AnsiSegment(text: chunk, color: currentColor, bold: currentBold))
            }
            let codesString = nsText.substring(with: match.range(at: 1))
            let codes = codesString.split(separator: ";").compactMap { Int($0) }
            for code in codes {
                if code == 0 {
                    currentColor = defaultColor
                    currentBold = false
                } else if code == 1 {
                    currentBold = true
                } else if let mapped = colors[code] {
                    currentColor = mapped
                }
            }
            lastIndex = match.range.location + match.range.length
        }

        if lastIndex < nsText.length {
            let chunk = nsText.substring(from: lastIndex)
            segments.append(AnsiSegment(text: chunk, color: currentColor, bold: currentBold))
        }

        return segments.isEmpty ? [AnsiSegment(text: text, color: defaultColor, bold: false)] : segments
    }
}
