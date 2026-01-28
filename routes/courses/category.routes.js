import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../../controllers/course/category.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

router.post("/", authCheckMiddleware, authorizeRoles("tenant"), createCategory);
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.put("/:id", authCheckMiddleware, authorizeRoles("tenant"), updateCategory);

export default router;
