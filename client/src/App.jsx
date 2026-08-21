import WarehouseDashboard from "./pages/WarehouseDashboard";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  const dashboard = "admin";

  if (dashboard === "warehouse") {
    return <WarehouseDashboard />;
  }

  if (dashboard === "delivery") {
    return <DeliveryDashboard />;
  }

  return <AdminDashboard />;
}

export default App;
