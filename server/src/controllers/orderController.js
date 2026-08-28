const { getIO } = require("../socket/socket");

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

const getStatusUpdateRooms = (currentStatus, nextStatus) => {
  const transitionKey = `${currentStatus}->${nextStatus}`;

  const rooms = {
    "PLACED->PACKED": ["warehouse", "admin"],
    "PACKED->OUT_FOR_DELIVERY": ["delivery", "admin"],
    "OUT_FOR_DELIVERY->DELIVERED": ["delivery", "admin"],
    "PLACED->CANCELLED": ["admin"],
    "PACKED->CANCELLED": ["admin"],
  };

  return rooms[transitionKey] || [];
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

    // Notify only warehouse clients about a newly created order.
    // Notify only warehouse clients about a newly created order.
    console.log("Emitting order:created to warehouse:", order.id);

    const io = getIO();

    io.to("warehouse").emit("order:created", order);
    io.to("admin").emit("order:created", order);

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
    let query = `
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
    `;

    const values = [];

    // Delivery agents only see orders assigned to them.
    if (req.user.role === "delivery") {
      query += `
        WHERE o.assigned_agent_id = $1
      `;

      values.push(req.user.userId);
    }

    query += `
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(query, values);

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

const getOrderStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // First check that the order exists.
    const orderResult = await pool.query(
      `
      SELECT id
      FROM orders
      WHERE id = $1
      `,
      [id],
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    // Fetch the complete status history along with
    // information about the user who made each change.
    const historyResult = await pool.query(
      `
      SELECT
        osl.id,
        osl.order_id,
        osl.from_status,
        osl.to_status,
        osl.changed_at,
        u.id AS changed_by_id,
        u.name AS changed_by_name,
        u.role AS changed_by_role
      FROM order_status_logs osl
      JOIN users u
        ON osl.changed_by = u.id
      WHERE osl.order_id = $1
      ORDER BY osl.changed_at ASC
      `,
      [id],
    );

    return res.json({
      status: "ok",
      history: historyResult.rows,
    });
  } catch (error) {
    console.error("Get order status history error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch order status history",
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
      SELECT id, status, assigned_agent_id
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

    // Keep the existing assigned agent unless
    // this is the first transition to PACKED.
    let assignedAgentId = order.assigned_agent_id || null;

    // Automatically assign a delivery agent when
    // the order moves from PLACED to PACKED.
    if (currentStatus === "PLACED" && nextStatus === "PACKED") {
      const deliveryAgentResult = await client.query(`
        SELECT
          u.id,
          COUNT(o.id) FILTER (
            WHERE o.status IN ('PACKED', 'OUT_FOR_DELIVERY')
          ) AS active_orders
        FROM users u
        LEFT JOIN orders o
          ON o.assigned_agent_id = u.id
        WHERE u.role = 'delivery'
        GROUP BY u.id
        ORDER BY active_orders ASC, u.id ASC
        LIMIT 1
      `);

      if (deliveryAgentResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(500).json({
          status: "error",
          message: "No delivery agent available",
        });
      }

      assignedAgentId = deliveryAgentResult.rows[0].id;

      console.log(`Order ${id} assigned to delivery agent ${assignedAgentId}`);
    }

    // Update the order status and assigned delivery agent.
    const updatedOrderResult = await client.query(
      `
      UPDATE orders
      SET status = $1,
          assigned_agent_id = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [nextStatus, assignedAgentId, id],
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

    // Both database operations succeeded.
    await client.query("COMMIT");

    const statusUpdate = {
      orderId: id,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      changedBy: req.user.userId,
      timestamp: new Date().toISOString(),
    };

    const rooms = getStatusUpdateRooms(currentStatus, nextStatus);

    const io = getIO();

    rooms.forEach((room) => {
      console.log(`Emitting order:status_updated to ${room}:`, statusUpdate);

      io.to(room).emit("order:status_updated", statusUpdate);
    });

    // When an order is packed, it has just been assigned to a delivery agent.
    // Send the complete order directly to that agent so it appears instantly
    // in their dashboard without requiring a refresh.
    if (currentStatus === "PLACED" && nextStatus === "PACKED") {
      const assignedOrder = updatedOrderResult.rows[0];

      console.log(
        `Emitting order:assigned to user:${assignedAgentId}:`,
        assignedOrder.id,
      );

      io.to(`user:${assignedAgentId}`).emit("order:assigned", assignedOrder);
    }

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
  getOrderStatusHistory,
  updateOrderStatus,
};
