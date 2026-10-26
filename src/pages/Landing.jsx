import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Landing() {
  const { loginDemo } = useAuth();
  const navigate = useNavigate();

  const handleDemo = async () => {
    try {
      await loginDemo();
      navigate("/");
    } catch (e) {
      navigate("/login");
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <span className="brand-mark" style={{ marginBottom: 18 }}>℞</span>
        <h1 style={{ fontSize: 36, color: "#fff" }}>MediMate</h1>
        <p style={{ color: "#C9DAD2", maxWidth: 360, fontSize: 16 }}>
          One calm, reliable place to organize medicines, track daily doses, scan prescriptions, and keep your family's care on schedule.
        </p>
      </div>
      <div className="auth-panel">
        <h2>Never miss a dose again</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
          MediMate is a medication-management tool designed for clear routines, automatic stock reminders, and doctor-ready adherence analytics.
        </p>
        <button
          onClick={handleDemo}
          className="btn btn-primary btn-block"
          style={{ marginBottom: 10, background: "var(--pine-900)" }}
        >
          🚀 1-Click Demo Login (Preloaded Data)
        </button>
        <Link to="/login" className="btn btn-ghost btn-block" style={{ marginBottom: 10 }}>Log in</Link>
        <Link to="/register" className="btn btn-ghost btn-block">Create an account</Link>
      </div>
    </div>
  );
}
