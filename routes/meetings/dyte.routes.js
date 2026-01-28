import express from "express";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { joinBatchClass } from "../../controllers/meetings/dyte.controller.js";

const router = express.Router();

router.get("/batch/:batchId/join", authCheckMiddleware, joinBatchClass);

export default router;
