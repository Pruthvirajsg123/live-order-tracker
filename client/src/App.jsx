import WarehouseDashboard from "./pages/WarehouseDashboard";
import DeliveryDashboard from "./pages/DeliveryDashboard";

function App() {
  const dashboard = "delivery";

  if (dashboard === "warehouse") {
    return <WarehouseDashboard />;
  }

  return <DeliveryDashboard />;
}

export default App;
