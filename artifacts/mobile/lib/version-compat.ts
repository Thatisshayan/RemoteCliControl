// Compares the running mobile app version against the server's declared
// minimum supported mobile version (GET /version's optional
// `mobileMinVersion`, set via the server's MOBILE_MIN_VERSION env var).
// Purely informational -- this never blocks the app, it only produces a
// message Settings can show so an operator/user understands why something
// might be behaving oddly on an old build.

export type VersionCompatStatus = "compatible" | "outdated" | "unknown";

export interface VersionCompatResult {
  status: VersionCompatStatus;
  message: string | null;
}

/**
 * Compares two semver-ish "x.y.z" version strings.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * Non-numeric or missing segments are treated as 0, so this stays lenient
 * about non-strict-semver input rather than throwing.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const partsB = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Determines whether the currently running mobile app version satisfies the
 * server's declared minimum. Returns "unknown" whenever either version is
 * missing/blank so callers don't need to special-case that.
 */
export function getVersionCompatibility(
  appVersion: string | null | undefined,
  mobileMinVersion: string | null | undefined,
): VersionCompatResult {
  if (!appVersion || !mobileMinVersion) {
    return { status: "unknown", message: null };
  }

  if (compareVersions(appVersion, mobileMinVersion) < 0) {
    return {
      status: "outdated",
      message: `This app version (${appVersion}) is older than the server's minimum supported version (${mobileMinVersion}). Update the app to avoid unexpected behavior.`,
    };
  }

  return { status: "compatible", message: null };
}
