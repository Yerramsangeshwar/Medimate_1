import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "", phone: user?.phone || "", age: user?.age || "",
    gender: user?.gender || "", bloodGroup: user?.bloodGroup || "", emergencyContact: user?.emergencyContact || "",
  });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");

  const saveProfile = async (e) => {
    e.preventDefault();
    setError(""); setMsg("");
    try {
      await api.updateProfile(form);
      await refreshUser();
      setMsg("Profile updated.");
    } catch (err) {
      setError(err.message);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError(""); setPwMsg("");
    try {
      await api.changePassword(pwForm);
      setPwMsg("Password changed.");
      setPwForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setPwError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Profile & Settings</h1>

      <form onSubmit={saveProfile} className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Personal details</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-info">{msg}</div>}

        <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field-row">
          <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Age</label><input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Gender</label>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Prefer not to say</option>
              <option>Female</option><option>Male</option><option>Other</option>
            </select>
          </div>
          <div className="field"><label>Blood group</label><input value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} placeholder="e.g. O+" /></div>
        </div>
        <div className="field"><label>Emergency contact</label><input value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></div>

        <button className="btn btn-primary">Save changes</button>
      </form>

      <form onSubmit={savePassword} className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Change password</h3>
        {pwError && <div className="alert alert-error">{pwError}</div>}
        {pwMsg && <div className="alert alert-info">{pwMsg}</div>}
        <div className="field"><label>Current password</label><input type="password" required value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} /></div>
        <div className="field"><label>New password</label><input type="password" required minLength={6} value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
        <button className="btn btn-primary">Update password</button>
      </form>
    </div>
  );
}
