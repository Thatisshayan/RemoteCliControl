import { Router } from "express";
import { getTunnelUrl } from "../lib/tunnel.js";

const router = Router();

router.get("/", (_req, res) => {
  const url = getTunnelUrl();
  res.json({
    tunnelUrl: url,
    active: url !== null,
  });
});

export default router;
