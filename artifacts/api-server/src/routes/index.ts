import { Router } from "express";
import connectionRoutes from "./connection.js";
import sessionsRoutes from "./sessions.js";
import filesRoutes from "./files.js";
import processesRoutes from "./processes.js";
import commandsRoutes from "./commands.js";
import pushRoutes from "./push.js";

const router = Router();
router.use(connectionRoutes);
router.use(sessionsRoutes);
router.use(filesRoutes);
router.use(processesRoutes);
router.use(commandsRoutes);
router.use(pushRoutes);

export default router;
