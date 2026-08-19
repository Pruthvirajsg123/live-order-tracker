import { io } from "socket.io-client";
import { useEffect, useState } from "react";
const WAREHOUSE_JWT = import.meta.env.VITE_WAREHOUSE_JWT;

function App() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${WAREHOUSE_JWT}`,
        },
      });

      const data = await response.json();

      setOrders(data.orders);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
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

      // Update the order immediately in the UI
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: "PACKED" } : order,
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
    <div>
      <h1>Warehouse Dashboard</h1>

      <h2>Orders</h2>

      {orders.length === 0 ? (
        <p>No orders available</p>
      ) : (
        orders.map((order) => (
          <div key={order.id}>
            <h3>Order #{order.id}</h3>
            <p>Customer: {order.customer_name}</p>
            <p>Status: {order.status}</p>

            {order.status === "PLACED" && (
              <button onClick={() => markAsPacked(order.id)}>
                Mark as Packed
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default App;
