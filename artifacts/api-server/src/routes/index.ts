import { Router } from "express";
import healthRoutes from "./health.js";
import connectionRoutes from "./connection.js";
import sessionsRoutes from "./sessions.js";
import filesRoutes from "./files.js";
import processesRoutes from "./processes.js";
import commandsRoutes from "./commands.js";

const router = Router();
router.use(healthRoutes);
router.use(connectionRoutes);
router.use(sessionsRoutes);
router.use(filesRoutes);
router.use(processesRoutes);
router.use(commandsRoutes);

export default router;
