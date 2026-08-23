const express = require("express");

const { getAnalyticsSummary } = require("../controllers/analyticsController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/summary",
  authenticateToken,
  authorizeRoles("admin"),
  getAnalyticsSummary,
);

module.exports = router;
