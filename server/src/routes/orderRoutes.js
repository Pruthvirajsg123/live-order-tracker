const express = require("express");

const {
  createOrder,
  getOrders,
  getOrderById,
  getOrderStatusHistory,
  updateOrderStatus,
} = require("../controllers/orderController");

const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticateToken, createOrder);

router.get("/", authenticateToken, getOrders);

router.get("/:id/history", authenticateToken, getOrderStatusHistory);

router.get("/:id", authenticateToken, getOrderById);

router.patch("/:id/status", authenticateToken, updateOrderStatus);

module.exports = router;
