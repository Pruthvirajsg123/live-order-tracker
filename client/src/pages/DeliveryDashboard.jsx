import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import "../App.css";
import { useAuth } from "../context/AuthContext";

function DeliveryDashboard() {
  const { token, user, logout } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      setOrders(data.orders);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to update order status:", data);
        return;
      }

      console.log("Order status updated:", data.order);

      // Update immediately for the user who performed the action.
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          String(order.id) === String(orderId)
            ? {
                ...order,
                status: nextStatus,
              }
            : order,
        ),
      );
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  useEffect(() => {
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: {
        token,
      },
    });

    socket.on("connect", () => {
      console.log("Delivery socket connected:", socket.id);

      // Fetch the current assigned orders when connecting/reconnecting.
      fetchOrders();
    });

    // NEW: Receive an order when it is assigned specifically
    // to this delivery agent.
    socket.on("order:assigned", (assignedOrder) => {
      console.log("New order assigned:", assignedOrder);

      setOrders((currentOrders) => {
        const alreadyExists = currentOrders.some(
          (order) => String(order.id) === String(assignedOrder.id),
        );

        // Prevent duplicates if the order is already in the dashboard.
        if (alreadyExists) {
          return currentOrders;
        }

        return [assignedOrder, ...currentOrders];
      });
    });

    // Receive live status updates for orders already assigned
    // to this delivery user.
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
  }, [token]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Delivery Dashboard</h1>
          <p>
            Welcome, {user?.name || "Delivery User"} — Manage and complete
            deliveries
          </p>
        </div>

        <div className="dashboard-actions">
          <div className="order-count">
            <span>{orders.length}</span>
            <small>Assigned Orders</small>
          </div>

          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main>
        <div className="section-header">
          <h2>Assigned Orders</h2>
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
            <h3>No assigned orders</h3>
            <p>Orders assigned to you will appear here automatically.</p>
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
                    <span className="label">Created</span>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {order.status === "PACKED" && (
                  <button
                    className="delivery-button"
                    onClick={() =>
                      updateOrderStatus(order.id, "OUT_FOR_DELIVERY")
                    }
                  >
                    Start Delivery
                  </button>
                )}

                {order.status === "OUT_FOR_DELIVERY" && (
                  <button
                    className="delivery-button"
                    onClick={() => updateOrderStatus(order.id, "DELIVERED")}
                  >
                    Mark Delivered
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

export default DeliveryDashboard;
