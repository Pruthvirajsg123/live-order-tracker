const { calculateAnalytics } = require("../controllers/analyticsController");
const { getIO } = require("./socket");

const startAnalyticsUpdates = () => {
  setInterval(async () => {
    try {
      const analytics = await calculateAnalytics();

      const io = getIO();

      console.log("Emitting analytics:update to admin:", analytics);

      io.to("admin").emit("analytics:update", analytics);
    } catch (error) {
      console.error("Failed to update analytics:", error);
    }
  }, 3000);
};

module.exports = {
  startAnalyticsUpdates,
};
