import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Login() {
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleQuickDemo = async () => {
    setError("");
    setBusy(true);
    try {
      await loginDemo();
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to load demo account.");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => setForm({ email: "demo@medimate.app", password: "demo1234" });

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <span className="brand-mark" style={{ marginBottom: 18 }}>℞</span>
        <h1 style={{ fontSize: 32, color: "#fff" }}>MediMate</h1>
        <p style={{ color: "#C9DAD2", maxWidth: 320 }}>
          Medicines, smart reminders, and dose history — organized in one calm, simple place.
        </p>
      </div>
      <div className="auth-panel">
        <h2>Welcome back</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Log in to see today's schedule.</p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* 1-Click Demo Login Banner */}
        <div style={{
          background: "var(--pine-100)", border: "1px solid var(--pine-500)",
          borderRadius: 12, padding: "14px 16px", marginBottom: 18, textAlign: "center"
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--pine-900)" }}>
            ⚡ Exploring MediMate?
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleQuickDemo}
            disabled={busy}
            style={{ background: "var(--pine-900)" }}
          >
            {busy ? "Loading Demo…" : "🚀 1-Click Demo Login (Preloaded Data)"}
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        </form>

        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={fillDemo}>
          Fill demo credentials
        </button>

        <p className="auth-switch">
          <Link to="/forgot-password">Forgot password?</Link> · No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
