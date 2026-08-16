const VALID_TRANSITIONS = {
  PLACED: ["PACKED", "CANCELLED"],
  PACKED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const TRANSITION_ROLES = {
  "PLACED->PACKED": ["warehouse"],
  "PACKED->OUT_FOR_DELIVERY": ["delivery"],
  "OUT_FOR_DELIVERY->DELIVERED": ["delivery"],

  "PLACED->CANCELLED": ["admin"],
  "PACKED->CANCELLED": ["admin"],
};

const isValidTransition = (currentStatus, nextStatus) => {
  return VALID_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
};

const pool = require("../db");

const createOrder = async (req, res) => {
  try {
    const { customer_name, address, items, total_amount } = req.body;

    if (!customer_name || !address || !items || total_amount === undefined) {
      return res.status(400).json({
        status: "error",
        message: "customer_name, address, items and total_amount are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO orders
        (customer_name, address, items, total_amount, status)
      VALUES
        ($1, $2, $3, $4, 'PLACED')
      RETURNING *
      `,
      [customer_name, address, JSON.stringify(items), total_amount],
    );

    const order = result.rows[0];

    await pool.query(
      `
      INSERT INTO order_status_logs
        (order_id, from_status, to_status, changed_by)
      VALUES
        ($1, NULL, 'PLACED', $2)
      `,
      [order.id, req.user.userId],
    );

    return res.status(201).json({
      status: "ok",
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to create order",
    });
  }
};

const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        o.id,
        o.customer_name,
        o.address,
        o.items,
        o.total_amount,
        o.status,
        o.assigned_agent_id,
        o.created_at,
        o.updated_at,
        u.name AS assigned_agent
      FROM orders o
      LEFT JOIN users u
        ON o.assigned_agent_id = u.id
      ORDER BY o.created_at DESC
      `,
    );

    return res.json({
      status: "ok",
      orders: result.rows,
    });
  } catch (error) {
    console.error("Get orders error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch orders",
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        o.id,
        o.customer_name,
        o.address,
        o.items,
        o.total_amount,
        o.status,
        o.assigned_agent_id,
        o.created_at,
        o.updated_at,
        u.name AS assigned_agent
      FROM orders o
      LEFT JOIN users u
        ON o.assigned_agent_id = u.id
      WHERE o.id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    return res.json({
      status: "ok",
      order: result.rows[0],
    });
  } catch (error) {
    console.error("Get order error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch order",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status: nextStatus } = req.body;

    if (!nextStatus) {
      return res.status(400).json({
        status: "error",
        message: "status is required",
      });
    }

    await client.query("BEGIN");

    // Lock the order row while we validate and update it.
    const orderResult = await client.query(
      `
      SELECT id, status
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    const order = orderResult.rows[0];
    const currentStatus = order.status;

    // Check whether the state transition itself is valid.
    if (!isValidTransition(currentStatus, nextStatus)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        status: "error",
        message: `Invalid status transition: ${currentStatus} -> ${nextStatus}`,
      });
    }

    // Check whether the user's role is allowed
    // to perform this specific transition.
    const transitionKey = `${currentStatus}->${nextStatus}`;
    const allowedRoles = TRANSITION_ROLES[transitionKey] || [];

    if (!allowedRoles.includes(req.user.role)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        status: "error",
        message: "You do not have permission to perform this status transition",
      });
    }

    // Update the order.
    const updatedOrderResult = await client.query(
      `
      UPDATE orders
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [nextStatus, id],
    );

    // Record the status change in the audit log.
    await client.query(
      `
      INSERT INTO order_status_logs
        (order_id, from_status, to_status, changed_by)
      VALUES
        ($1, $2, $3, $4)
      `,
      [id, currentStatus, nextStatus, req.user.userId],
    );

    // Both operations succeeded.
    await client.query("COMMIT");

    console.log(
      `Order ${id}: ${currentStatus} -> ${nextStatus} by user ${req.user.userId}`,
    );

    return res.json({
      status: "ok",
      order: updatedOrderResult.rows[0],
    });
  } catch (error) {
    // If anything failed, undo every query in this transaction.
    await client.query("ROLLBACK");

    console.error("Update order status error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to update order status",
    });
  } finally {
    // Always return the client to the connection pool.
    client.release();
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
};
