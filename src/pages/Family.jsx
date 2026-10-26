import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Family() {
  const [members, setMembers] = useState(null);
  const [form, setForm] = useState({ name: "", relation: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { familyMembers } = await api.listFamily();
      setMembers(familyMembers);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.addFamily(form);
      setForm({ name: "", relation: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try {
      await api.deleteFamily(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Family Members</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={add} className="card" style={{ marginBottom: 18, maxWidth: 460 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Add a family member</h3>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="E.g. Robert Jenkins" />
          </div>
          <div className="field">
            <label>Relation</label>
            <select value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="">Select…</option>
              <option>Father</option><option>Mother</option><option>Spouse</option>
              <option>Child</option><option>Grandparent</option><option>Other</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add member"}</button>
      </form>

      {!members ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      ) : members.length === 0 ? (
        <div className="card empty-state"><p>No family members added yet. Medicines you add stay under "Myself" until you add someone.</p></div>
      ) : (
        <div className="med-grid">
          {members.map((m) => (
            <div className="card med-tile" key={m.id}>
              <div className="avatar" style={{ background: "var(--pine-700)" }}>{m.name.slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="med-tile-name" style={{ cursor: "default" }}>{m.name}</div>
                <div className="dose-meta">{m.relation || "Family member"}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link to={`/medicines?familyMemberId=${m.id}`} className="btn btn-ghost btn-sm">View medicines</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="disclaimer" style={{ marginTop: 18, maxWidth: 460 }}>
        Family and caregiver visibility organizes prescriptions under your primary account while keeping individual schedules clearly segregated.
      </p>
    </div>
  );
}
