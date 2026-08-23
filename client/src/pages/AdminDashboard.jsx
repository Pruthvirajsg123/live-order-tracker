import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import "../App.css";

const ADMIN_JWT = import.meta.env.VITE_ADMIN_JWT;

function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${ADMIN_JWT}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch orders");
      }

      setOrders(data.orders);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const socket = io("http://localhost:5000", {
      auth: {
        token: ADMIN_JWT,
      },
    });

    socket.on("connect", () => {
      console.log("Admin socket connected:", socket.id);

      fetchOrders();
    });

    socket.on("order:created", (newOrder) => {
      console.log("New order received:", newOrder);

      setOrders((currentOrders) => [newOrder, ...currentOrders]);
    });

    socket.on("analytics:update", (analyticsData) => {
      console.log("Live analytics update received:", analyticsData);
    });

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

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Monitor order operations in real time</p>
        </div>

        <div className="order-count">
          <span>{orders.length}</span>
          <small>Total Orders</small>
        </div>
      </header>

      <main>
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
                    {order.status}
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
