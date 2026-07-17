import { Router } from "express";
import packageJson from "../../package.json" with { type: "json" };

const router = Router();

// MOBILE_MIN_VERSION lets an operator declare the oldest mobile app build
// (semver, matching artifacts/mobile/app.json's "version") this server will
// support without degraded/rejected behavior. Left unset, no client is
// flagged as outdated -- this is an opt-in operational control, not a hard
// server-side gate.
router.get("/", (_req, res) => {
  const mobileMinVersion = process.env.MOBILE_MIN_VERSION;
  res.json({
    version: packageJson.version,
    ...(mobileMinVersion ? { mobileMinVersion } : {}),
  });
});

export default router;
