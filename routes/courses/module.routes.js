import express from "express";
import * as ModuleController from "../../controllers/course/module.controller.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { instructorMiddleware } from "../../middleware/instructor.middleware.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

router.route("/").get(ModuleController.getModules);

router.get(
  "/get-modules-associated-with-the-course/:course_id",
  authCheckMiddleware,
  authorizeRoles("instructor", "tenant"),
  ModuleController.getModulesAssociatedWithTheCourse
);

router.post(
  "/create-module-and-assign-to-course/:course_id",
  ModuleController.addModuleToCourse
);

router.put(
  "/update/display-order/:module_id",
  ModuleController.updateDisplayOrder
);
export default router;
