import express from "express";
import cors from "cors";
import { authMiddleware } from "./lib/auth.js";
import rateLimit from "express-rate-limit";
import routes from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const connectionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.use("/api", generalLimiter, authMiddleware, routes);

app.use("/api/connection/test", connectionLimiter);

export default app;
