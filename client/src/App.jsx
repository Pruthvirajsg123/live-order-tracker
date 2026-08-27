import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import WarehouseDashboard from "./pages/WarehouseDashboard";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function ProtectedRoute({ children, allowedRole }) {
  const { user, isAuthenticated } = useAuth();

  // User is not logged in.
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // User is logged in but trying to access another role's dashboard.
  if (user.role !== allowedRole) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
}

function RoleRedirect() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/${user.role}`} replace />;
}

function App() {
  return (
    <Routes>
      {/* Authentication pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Warehouse dashboard */}
      <Route
        path="/warehouse"
        element={
          <ProtectedRoute allowedRole="warehouse">
            <WarehouseDashboard />
          </ProtectedRoute>
        }
      />

      {/* Delivery dashboard */}
      <Route
        path="/delivery"
        element={
          <ProtectedRoute allowedRole="delivery">
            <DeliveryDashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Default route */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Unknown routes */}
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}

export default App;
