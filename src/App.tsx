import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Medicines from "./pages/Medicines";
import MedicineForm from "./pages/MedicineForm";
import MedicineDetails from "./pages/MedicineDetails";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import CalendarPage from "./pages/CalendarPage";
import History from "./pages/History";
import Inventory from "./pages/Inventory";
import Prescriptions from "./pages/Prescriptions";
import Family from "./pages/Family";
import Profile from "./pages/Profile";

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <AppShell><Dashboard /></AppShell> : <Login />} />
      <Route path="/register" element={user ? <AppShell><Dashboard /></AppShell> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/welcome" element={!loading && !user ? <Landing /> : <AppShell><Dashboard /></AppShell>} />

      <Route path="/" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/medicines" element={<ProtectedRoute><AppShell><Medicines /></AppShell></ProtectedRoute>} />
      <Route path="/medicines/new" element={<ProtectedRoute><AppShell><MedicineForm /></AppShell></ProtectedRoute>} />
      <Route path="/medicines/:id" element={<ProtectedRoute><AppShell><MedicineDetails /></AppShell></ProtectedRoute>} />
      <Route path="/medicines/:id/edit" element={<ProtectedRoute><AppShell><MedicineForm /></AppShell></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppShell><Analytics /></AppShell></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppShell><Reports /></AppShell></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><AppShell><CalendarPage /></AppShell></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AppShell><History /></AppShell></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><AppShell><Inventory /></AppShell></ProtectedRoute>} />
      <Route path="/prescriptions" element={<ProtectedRoute><AppShell><Prescriptions /></AppShell></ProtectedRoute>} />
      <Route path="/family" element={<ProtectedRoute><AppShell><Family /></AppShell></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppShell><Profile /></AppShell></ProtectedRoute>} />

      <Route path="*" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
    </Routes>
  );
}
