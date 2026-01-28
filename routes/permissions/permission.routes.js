import express from "express";
import {
  createPermission,
  getAllPermissions,
  updatePermission,
} from "../../controllers/permissions/permission.controller.js";
import { isSuperAdmin } from "../../middleware/isSuperAdmin.js";

const router = express.Router();

router
  .route("/")
  .post(isSuperAdmin, createPermission)
  .get(isSuperAdmin, getAllPermissions);

router.route("/:id").put(isSuperAdmin, updatePermission);
export default router;
