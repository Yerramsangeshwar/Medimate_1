import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const TYPE_ICON = {
  tablet: "⬤", capsule: "⬬", syrup: "◇", injection: "✚", drops: "◈",
  cream: "▢", inhaler: "⟟", powder: "░", other: "•",
};

export default function Medicines() {
  const [medicines, setMedicines] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = async (filterId) => {
    try {
      const param = filterId === "all" ? undefined : filterId;
      const { medicines } = await api.listMedicines(param);
      setMedicines(medicines);

      const famRes = await api.listFamily();
      setFamilyMembers(famRes.familyMembers || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(selectedFilter); }, [selectedFilter]);

  const remove = async (id) => {
    try {
      await api.deleteMedicine(id);
      setDeletingId(null);
      load(selectedFilter);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0 }}>Medications Schedule</h1>
          <p style={{ color: "var(--ink-soft)", margin: "4px 0 0" }}>
            Active prescriptions, dosages, and recurring schedules.
          </p>
        </div>
        <Link to="/medicines/new" className="btn btn-primary btn-sm">+ Add Medicine</Link>
      </div>

      {/* Filter by Family Member */}
      {familyMembers.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          <button
            className={`btn btn-sm ${selectedFilter === "all" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setSelectedFilter("all")}
          >
            All Medicines
          </button>
          <button
            className={`btn btn-sm ${selectedFilter === "self" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setSelectedFilter("self")}
          >
            Myself
          </button>
          {familyMembers.map((fm) => (
            <button
              key={fm.id}
              className={`btn btn-sm ${selectedFilter === fm.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSelectedFilter(fm.id)}
            >
              {fm.name} ({fm.relation || "Family"})
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!medicines ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading medicines…</p>
      ) : medicines.length === 0 ? (
        <div className="card empty-state">
          <p>No medicines found for this selection.</p>
          <Link to="/medicines/new" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>Add your first medicine</Link>
        </div>
      ) : (
        <div className="med-grid">
          {medicines.map((m) => (
            <div className="card med-tile" key={m.id}>
              <div className="dose-icon">{TYPE_ICON[m.type] || "•"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link to={`/medicines/${m.id}`} className="med-tile-name">{m.name}</Link>
                  {m.dosage && <span className="badge badge-amber">{m.dosage}</span>}
                </div>
                <div className="dose-meta" style={{ marginTop: 3 }}>
                  ⏰ Times: {m.times.join(", ")} · {m.frequency.replace("_", " ")}
                  {m.foodInstruction !== "none" ? ` · Take ${m.foodInstruction} food` : ""}
                </div>
                {!m.active && <span className="badge badge-skipped" style={{ marginTop: 6, display: "inline-block" }}>Inactive</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Link to={`/medicines/${m.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                {deletingId === m.id ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}>Confirm</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeletingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={() => setDeletingId(m.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
