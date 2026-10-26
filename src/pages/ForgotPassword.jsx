import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import "../styles/auth.css";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await api.forgotPassword({ email });
      setMessage(res.message);
      if (res.resetToken) setResetToken(res.resetToken); // MVP: no email service wired up yet
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await api.resetPassword({ resetToken, newPassword });
      setMessage(res.message);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <span className="brand-mark" style={{ marginBottom: 18 }}>℞</span>
        <h1 style={{ fontSize: 30, color: "#fff" }}>Reset your password</h1>
      </div>
      <div className="auth-panel">
        {error && <div className="alert alert-error">{error}</div>}
        {message && step !== 1 && <div className="alert alert-info">{message}</div>}

        {step === 1 && (
          <form onSubmit={requestReset}>
            <div className="field">
              <label>Account email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={doReset}>
            <p className="field-hint" style={{ marginBottom: 14 }}>
              No email service is wired up in this MVP, so the reset token is shown directly below for the demo flow.
            </p>
            <div className="field">
              <label>Reset token</label>
              <input required value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
            </div>
            <div className="field">
              <label>New password</label>
              <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
          </form>
        )}

        {step === 3 && (
          <Link to="/login" className="btn btn-primary btn-block">Go to login</Link>
        )}

        <p className="auth-switch"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}
