import express from "express";
import {
  getTenants,
  getTenantsWithCourseCountandUserCount,
  getCoursesByTenant,
  disableTenant,
  enableTenant,
  // getUsersByTenant,
  getUsersByTenantSearchQueryAndRoleId,
} from "../../controllers/super-admin/super.admin.controller.js";
import { isSuperAdmin } from "../../middleware/isSuperAdmin.js";
import { createTenant } from "../../controllers/super-admin/tenant.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import { deleteTenant } from "../../controllers/super-admin/tenant.controller.js";

const router = express.Router();

router
  .route("/tenants")
  .get(authCheckMiddleware, authorizeRoles("superadmin"), getTenants);
router
  .route("/tenants/course-count-and-user-count")
  .get(
    authCheckMiddleware,
    authorizeRoles("superadmin"),
    getTenantsWithCourseCountandUserCount
  );
router
  .route("/courses/tenant/:tenantId")
  .get(authCheckMiddleware, authorizeRoles("superadmin"), getCoursesByTenant);

router
  .route("/tenant/create-tenant")
  .post(authCheckMiddleware, authorizeRoles("superadmin"), createTenant);

router
  .route("/tenant/delete/:tenantId")
  .delete(authCheckMiddleware, authorizeRoles("superadmin"), deleteTenant);

router
  .route("/tenant/disable/:tenantId")
  .post(authCheckMiddleware, authorizeRoles("superadmin"), disableTenant);

router
  .route("/tenant/enable/:tenantId")
  .post(authCheckMiddleware, authorizeRoles("superadmin"), enableTenant);

// router.get("/users/tenant/:tenantId", authCheckMiddleware, authorizeRoles("superadmin"), getUsersByTenant);
router.get(
  "/users/tenant/:tenantId/search-query-and-role-id",
  authCheckMiddleware,
  authorizeRoles("superadmin"),
  getUsersByTenantSearchQueryAndRoleId
);
export default router;
