import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <span className="brand-mark" style={{ marginBottom: 18 }}>℞</span>
        <h1 style={{ fontSize: 32, color: "#fff" }}>Create your account</h1>
        <p style={{ color: "#C9DAD2", maxWidth: 320 }}>
          Set up medicines once — MediMate handles the reminders and the history from there.
        </p>
      </div>
      <div className="auth-panel">
        <h2>Get started</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Full name</label>
            <input required value={form.name} onChange={update("name")} placeholder="Your name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={form.email} onChange={update("email")} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Phone (optional)</label>
            <input value={form.phone} onChange={update("phone")} placeholder="10-digit number" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={update("password")} placeholder="At least 6 characters" />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
