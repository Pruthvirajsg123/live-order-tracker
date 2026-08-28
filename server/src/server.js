require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const pool = require("./db");

const { initializeSocket } = require("./socket/socket");
const { startAnalyticsUpdates } = require("./socket/analyticsUpdater");

const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/analytics", analyticsRoutes);

// Create HTTP server using Express
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Create Socket.io server — ONLY ONCE
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

initializeSocket(io);

// Socket.io JWT authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;

    next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);

    next(new Error("Invalid or expired token"));
  }
});

// Handle authenticated Socket.io connections
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  console.log("Authenticated user:", socket.user);

  // Join the room based on the user's role
  socket.join(socket.user.role);

  // Join a personal room for this specific user
  socket.join(`user:${socket.user.userId}`);

  console.log(`Socket joined room: ${socket.user.role}`);
  console.log(`Socket joined personal room: user:${socket.user.userId}`);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start periodic analytics updates AFTER Socket.io is initialized
startAnalyticsUpdates();

// Health checks
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Live Order Tracker API is running",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

// Start HTTP + Socket.io server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
