import express from "express";
import {
  createSubcategory,
  getSubcategories,
  getSubcategoriesByCategory,
} from "../../controllers/course/subcategory.controller.js";

const router = express.Router();

router.post("/", createSubcategory);
router.get("/", getSubcategories);

router.get("/:categoryId", getSubcategoriesByCategory);

export default router;
