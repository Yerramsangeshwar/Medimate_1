import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AiAssistantModal from "./AiAssistantModal";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "◆", end: true },
  { to: "/medicines", label: "Medicines", icon: "⬡" },
  { to: "/analytics", label: "Analytics", icon: "📈" },
  { to: "/reports", label: "Doctor Report", icon: "📄" },
  { to: "/calendar", label: "Calendar", icon: "▦" },
  { to: "/history", label: "History", icon: "◷" },
  { to: "/inventory", label: "Inventory", icon: "▤" },
  { to: "/prescriptions", label: "Prescriptions", icon: "▥" },
  { to: "/family", label: "Family", icon: "◎" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seniorMode, setSeniorMode] = useState(() => localStorage.getItem("medimate_senior") === "true");
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (seniorMode) {
      document.body.classList.add("senior-mode");
      localStorage.setItem("medimate_senior", "true");
    } else {
      document.body.classList.remove("senior-mode");
      localStorage.setItem("medimate_senior", "false");
    }
  }, [seniorMode]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">℞</span>
          <span className="brand-name">MediMate</span>
        </div>

        {/* Accessibility & AI Assistant Fast Bar */}
        <div style={{ padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setAiOpen(true)}
            style={{
              background: "rgba(214, 146, 74, 0.15)",
              color: "#F6E4CB",
              borderColor: "rgba(214, 146, 74, 0.4)",
              justifyContent: "flex-start",
              fontSize: 12.5,
              padding: "7px 10px"
            }}
          >
            ✨ AI Schedule Guide
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSeniorMode(!seniorMode)}
            style={{
              background: seniorMode ? "var(--amber-500)" : "transparent",
              color: seniorMode ? "#2A1B05" : "#C9DAD2",
              borderColor: "rgba(234, 243, 239, 0.2)",
              justifyContent: "flex-start",
              fontSize: 12,
              padding: "6px 10px"
            }}
            title="Toggle high-contrast large-type senior citizen view"
          >
            👓 {seniorMode ? "Senior Mode (Active)" : "Senior Mode"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/profile" className={({ isActive }) => "sidebar-user" + (isActive ? " active" : "")}>
            <span className="avatar">{(user?.name || "?").slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-user-name">{user?.name}</span>
          </NavLink>
          <button className="btn btn-ghost btn-sm btn-block" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <nav className="bottom-nav">
        {NAV_ITEMS.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => "bottom-link" + (isActive ? " active" : "")}
          >
            <span className="bottom-icon">{item.icon}</span>
            <span className="bottom-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <AiAssistantModal isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
