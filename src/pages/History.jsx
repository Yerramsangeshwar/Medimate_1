import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function History() {
  const [doses, setDoses] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [filters, setFilters] = useState({ medicineId: "", status: "", from: "", to: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.listMedicines().then(({ medicines }) => setMedicines(medicines)).catch(() => {});
  }, []);

  const load = async () => {
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { doses } = await api.doseHistory(params);
      setDoses(doses);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [filters]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Dose History</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field">
            <label>Medicine</label>
            <select value={filters.medicineId} onChange={(e) => setFilters({ ...filters, medicineId: e.target.value })}>
              <option value="">All</option>
              {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="TAKEN">Taken</option>
              <option value="MISSED">Missed</option>
              <option value="SKIPPED">Skipped</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div className="field">
            <label>From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!doses ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      ) : doses.length === 0 ? (
        <div className="card empty-state"><p>No doses match these filters.</p></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {doses.map((d, i) => (
            <div
              key={d.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px", borderBottom: i < doses.length - 1 ? "1px solid var(--surface-sunken)" : "none",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{d.medicineName || d.medicine?.name} {d.dosage && `(${d.dosage})`}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{d.scheduledDate} · {d.scheduledTime}</div>
              </div>
              <span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
