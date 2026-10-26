import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

export default function MedicineDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medicine, setMedicine] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = async () => {
    try {
      const detail = await api.getMedicine(id);
      setMedicine(detail.medicine);
      setInventory(detail.inventory);
      const { doses } = await api.doseHistory({ medicineId: id });
      setHistory(doses.slice(0, 10));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [id]);

  const remove = async () => {
    try {
      await api.deleteMedicine(id);
      navigate("/medicines");
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!medicine) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>{medicine.name}</h1>
          <p style={{ color: "var(--ink-soft)" }}>{medicine.dosage} · {medicine.type}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link to={`/medicines/${id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
          {confirmingDelete ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--coral-600)" }}>Confirm?</span>
              <button className="btn btn-danger btn-sm" onClick={remove}>Yes, Delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmingDelete(true)}>Delete</button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Schedule</h3>
        <DetailRow label="Frequency" value={medicine.frequency.replace("_", " ")} />
        <DetailRow label="Times" value={medicine.times.join(", ")} />
        <DetailRow label="Starts" value={medicine.startDate} />
        <DetailRow label="Ends" value={medicine.endDate || "Ongoing"} />
        <DetailRow label="Food instruction" value={medicine.foodInstruction === "none" ? "No preference" : medicine.foodInstruction} />
        {medicine.doctorName && <DetailRow label="Doctor" value={medicine.doctorName} />}
        {medicine.notes && <DetailRow label="Notes" value={medicine.notes} />}
      </div>

      {inventory && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Stock</h3>
          <DetailRow label="In hand" value={`${inventory.currentQuantity} units`} />
          <DetailRow label="Low-stock alert below" value={`${inventory.minimumQuantity} units`} />
          <Link to="/inventory" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>Manage stock →</Link>
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Recent doses</h3>
        {history.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No dose history yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span>{d.scheduledDate} · {d.scheduledTime}</span>
                <span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--surface-sunken)", fontSize: 13.5 }}>
      <span style={{ color: "var(--ink-soft)" }}>{label}</span>
      <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{value}</span>
    </div>
  );
}
