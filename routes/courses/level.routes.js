import express from "express";
import {
  createLevel,
  getLevels,
  updateLevel,
  deleteLevel,
} from "../../controllers/course/level.controller.js";

const router = express.Router();

router.post("/", createLevel);
router.get("/", getLevels);
router.put("/:id", updateLevel);
router.delete("/:id", deleteLevel);

export default router;
