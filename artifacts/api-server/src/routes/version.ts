import { Router } from "express";
import packageJson from "../../package.json" with { type: "json" };

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    version: packageJson.version,
  });
});

export default router;
