import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import "./App.css";

const WAREHOUSE_JWT = import.meta.env.VITE_WAREHOUSE_JWT;

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${WAREHOUSE_JWT}`,
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

  const markAsPacked = async (orderId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WAREHOUSE_JWT}`,
          },
          body: JSON.stringify({
            status: "PACKED",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to mark order as packed:", data);
        return;
      }

      console.log("Order marked as packed:", data.order);

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          String(order.id) === String(orderId)
            ? { ...order, status: "PACKED" }
            : order,
        ),
      );
    } catch (error) {
      console.error("Failed to mark order as packed:", error);
    }
  };

  useEffect(() => {
    const socket = io("http://localhost:5000", {
      auth: {
        token: WAREHOUSE_JWT,
      },
    });

    socket.on("connect", () => {
      console.log("Warehouse socket connected:", socket.id);
    });

    socket.on("order:created", (newOrder) => {
      console.log("New order received:", newOrder);

      setOrders((currentOrders) => [newOrder, ...currentOrders]);
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

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Warehouse Dashboard</h1>
          <p>Manage and process incoming orders</p>
        </div>

        <div className="order-count">
          <span>{orders.length}</span>
          <small>Total Orders</small>
        </div>
      </header>

      <main>
        <div className="section-header">
          <h2>Orders</h2>
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
            <p>New orders will appear here automatically.</p>
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
                    <span className="label">Created</span>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {order.status === "PLACED" && (
                  <button
                    className="pack-button"
                    onClick={() => markAsPacked(order.id)}
                  >
                    Mark as Packed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
