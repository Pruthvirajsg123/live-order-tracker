const express = require("express");

const app = express();

const PORT = 5000;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Live Order Tracker API is running",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
