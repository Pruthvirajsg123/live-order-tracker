import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

import { useAuth } from "../context/AuthContext";

function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Fetch all orders from the REST API
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch orders");
      }

      console.log("Admin orders fetched:", data.orders);

      setOrders(data.orders);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics from the REST API
  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/analytics/summary",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch analytics");
      }

      console.log("Admin analytics fetched:", data.analytics);

      setAnalytics(data.analytics);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
  };

  useEffect(() => {
    if (!token) return;

    // ==============================
    // 1. FETCH INITIAL DATA IMMEDIATELY
    // ==============================
    // The dashboard should not depend on Socket.io
    // to load its initial data.
    fetchOrders();
    fetchAnalytics();

    // ==============================
    // 2. CONNECT TO SOCKET.IO
    // ==============================
    const socket = io("http://localhost:5000", {
      auth: {
        token,
      },
    });

    socket.on("connect", () => {
      console.log("Admin socket connected:", socket.id);
    });

    // ==============================
    // 3. RECEIVE NEW ORDERS LIVE
    // ==============================
    socket.on("order:created", (newOrder) => {
      console.log("New order received:", newOrder);

      setOrders((currentOrders) => {
        // Prevent duplicate orders
        const alreadyExists = currentOrders.some(
          (order) => String(order.id) === String(newOrder.id),
        );

        if (alreadyExists) {
          return currentOrders;
        }

        return [newOrder, ...currentOrders];
      });
    });

    // ==============================
    // 4. RECEIVE LIVE ANALYTICS
    // ==============================
    socket.on("analytics:update", (analyticsData) => {
      console.log("Live analytics update received:", analyticsData);

      setAnalytics(analyticsData);
    });

    // ==============================
    // 5. RECEIVE LIVE STATUS UPDATES
    // ==============================
    socket.on("order:status_updated", (statusUpdate) => {
      console.log("Order status updated:", statusUpdate);

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          String(order.id) === String(statusUpdate.orderId)
            ? {
                ...order,
                status: statusUpdate.toStatus,
              }
            : order,
        ),
      );
    });

    // ==============================
    // 6. SOCKET CONNECTION ERROR
    // ==============================
    socket.on("connect_error", (error) => {
      console.error("Admin socket connection error:", error.message);
    });

    // Cleanup when component unmounts
    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>

          <p>
            Welcome, {user?.name || "Admin"} — Monitor order operations in real
            time
          </p>
        </div>

        <div className="dashboard-actions">
          <div className="order-count">
            <span>{analytics?.totalOrders ?? orders.length}</span>

            <small>Total Orders</small>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main>
        {/* ==============================
            LIVE ANALYTICS SECTION
        ============================== */}
        {analytics && (
          <section className="analytics-section">
            <div className="section-header">
              <h2>Live Analytics</h2>
            </div>

            {/* Summary Cards */}
            <div className="analytics-grid">
              <div className="analytics-card">
                <span className="label">Total Orders</span>

                <h3>{analytics.totalOrders}</h3>
              </div>

              <div className="analytics-card">
                <span className="label">Orders per Minute</span>

                <h3>{analytics.ordersPerMinute}</h3>
              </div>

              <div className="analytics-card">
                <span className="label">Cancellation Rate</span>

                <h3>{analytics.cancellationRate}%</h3>
              </div>

              <div className="analytics-card">
                <span className="label">Current Bottleneck</span>

                <h3>
                  {analytics.bottleneck?.stage?.replaceAll("_", " ") || "None"}
                </h3>
              </div>
            </div>

            {/* Detailed Analytics */}
            <div className="analytics-details">
              {/* Orders by Status */}
              <div className="analytics-panel">
                <h3>Orders by Status</h3>

                <div className="status-analytics-list">
                  {Object.entries(analytics.ordersByStatus || {}).map(
                    ([status, count]) => (
                      <div className="analytics-row" key={status}>
                        <span>{status.replaceAll("_", " ")}</span>

                        <div className="analytics-bar-container">
                          <div
                            className="analytics-bar"
                            style={{
                              width: `${
                                analytics.totalOrders === 0
                                  ? 0
                                  : (count / analytics.totalOrders) * 100
                              }%`,
                            }}
                          />
                        </div>

                        <strong>{count}</strong>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Average Stage Time */}
              <div className="analytics-panel">
                <h3>Average Stage Time</h3>

                <div className="stage-time-list">
                  {Object.entries(analytics.averageStageTimes || {}).map(
                    ([stage, seconds]) => (
                      <div className="analytics-row" key={stage}>
                        <span>{stage.replaceAll("_", " ")}</span>

                        <strong>{Math.round(seconds)} sec</strong>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==============================
            ORDERS SECTION
        ============================== */}
        <div className="section-header">
          <h2>All Orders</h2>
        </div>

        {loading ? (
          <div className="state-message">
            <p>Loading orders...</p>
          </div>
        ) : error ? (
          <div className="state-message error">
            <h3>Failed to load orders</h3>

            <p>{error}</p>

            <button onClick={fetchOrders}>Try Again</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="state-message">
            <h3>No orders available</h3>

            <p>Orders will appear here automatically.</p>
          </div>
        ) : (
          <div className="orders-grid">
            {orders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-card-header">
                  <h3>Order #{order.id}</h3>

                  <span
                    className={`status-badge status-${order.status.toLowerCase()}`}
                  >
                    {order.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="order-details">
                  <div className="detail">
                    <span className="label">Customer</span>

                    <span>{order.customer_name}</span>
                  </div>

                  <div className="detail">
                    <span className="label">Address</span>

                    <span>{order.address}</span>
                  </div>

                  <div className="detail">
                    <span className="label">Total Amount</span>

                    <span>₹{order.total_amount}</span>
                  </div>

                  <div className="detail">
                    <span className="label">Assigned Agent</span>

                    <span>{order.assigned_agent || "Not assigned"}</span>
                  </div>

                  <div className="detail">
                    <span className="label">Created</span>

                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
