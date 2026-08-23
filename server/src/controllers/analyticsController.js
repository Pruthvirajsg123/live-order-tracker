const pool = require("../db");

const calculateAnalytics = async () => {
  // 1. Count orders by their current status.
  const statusResult = await pool.query(`
    SELECT
      status,
      COUNT(*)::int AS count
    FROM orders
    GROUP BY status
  `);

  const ordersByStatus = {
    PLACED: 0,
    PACKED: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };

  statusResult.rows.forEach((row) => {
    ordersByStatus[row.status] = row.count;
  });

  // 2. Calculate total orders and cancellation rate.
  const totalsResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_orders
    FROM orders
  `);

  const totalOrders = totalsResult.rows[0].total_orders;
  const cancelledOrders = totalsResult.rows[0].cancelled_orders;

  const cancellationRate =
    totalOrders === 0
      ? 0
      : Number(((cancelledOrders / totalOrders) * 100).toFixed(2));

  // 3. Calculate orders created per minute.
  const ordersPerMinuteResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total_orders,
      EXTRACT(
        EPOCH FROM (MAX(created_at) - MIN(created_at))
      ) / 60 AS minutes_span
    FROM orders
  `);

  const { total_orders, minutes_span } = ordersPerMinuteResult.rows[0];

  let ordersPerMinute = 0;

  if (Number(total_orders) > 1 && Number(minutes_span) > 0) {
    ordersPerMinute = Number(
      (Number(total_orders) / Number(minutes_span)).toFixed(2),
    );
  }

  // 4. Calculate average time spent in each stage.
  const stageTimesResult = await pool.query(`
    WITH stage_entries AS (
      SELECT
        order_id,
        from_status AS stage,
        changed_at AS entered_at,
        LEAD(changed_at) OVER (
          PARTITION BY order_id
          ORDER BY changed_at
        ) AS next_changed_at
      FROM order_status_logs
      WHERE from_status IS NOT NULL
    ),
    placed_times AS (
      SELECT
        o.id AS order_id,
        'PLACED' AS stage,
        o.created_at AS entered_at,
        MIN(osl.changed_at) AS exited_at
      FROM orders o
      JOIN order_status_logs osl
        ON osl.order_id = o.id
      WHERE osl.from_status = 'PLACED'
      GROUP BY o.id, o.created_at
    ),
    all_stage_times AS (
      SELECT
        stage,
        EXTRACT(
          EPOCH FROM (next_changed_at - entered_at)
        ) AS duration_seconds
      FROM stage_entries
      WHERE next_changed_at IS NOT NULL

      UNION ALL

      SELECT
        stage,
        EXTRACT(
          EPOCH FROM (exited_at - entered_at)
        ) AS duration_seconds
      FROM placed_times
      WHERE exited_at IS NOT NULL
    )
    SELECT
      stage,
      ROUND(AVG(duration_seconds), 2) AS average_seconds
    FROM all_stage_times
    WHERE duration_seconds >= 0
    GROUP BY stage
  `);

  const averageStageTimes = {
    PLACED: 0,
    PACKED: 0,
    OUT_FOR_DELIVERY: 0,
  };

  stageTimesResult.rows.forEach((row) => {
    averageStageTimes[row.stage] = Number(row.average_seconds);
  });

  // 5. Find the bottleneck.
  let bottleneck = null;
  let highestAverageTime = 0;

  Object.entries(averageStageTimes).forEach(([stage, seconds]) => {
    if (seconds > highestAverageTime) {
      highestAverageTime = seconds;
      bottleneck = {
        stage,
        averageSeconds: seconds,
      };
    }
  });

  return {
    totalOrders,
    ordersByStatus,
    ordersPerMinute,
    cancellationRate,
    averageStageTimes,
    bottleneck,
  };
};

const getAnalyticsSummary = async (req, res) => {
  try {
    const analytics = await calculateAnalytics();

    return res.json({
      status: "ok",
      analytics,
    });
  } catch (error) {
    console.error("Get analytics summary error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch analytics summary",
    });
  }
};

module.exports = {
  calculateAnalytics,
  getAnalyticsSummary,
};
