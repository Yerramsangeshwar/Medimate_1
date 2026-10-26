import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function Inventory() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [addAmount, setAddAmount] = useState("");
  const [refillNotice, setRefillNotice] = useState("");

  const load = async () => {
    try {
      const { inventory } = await api.listInventory();
      setItems(inventory);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const refill = async (medicineId, customCount) => {
    const delta = customCount !== undefined ? customCount : Number(addAmount);
    if (!delta || delta <= 0) return;

    try {
      await api.refillInventory(medicineId, delta);
      setEditing(null);
      setAddAmount("");
      setRefillNotice(`Successfully refilled +${delta} units!`);
      setTimeout(() => setRefillNotice(""), 3000);
      load();
    } catch (err) {
      setError(err.message || "Failed to update inventory.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0 }}>Medication Stock & Inventory</h1>
          <p style={{ color: "var(--ink-soft)", margin: "4px 0 0" }}>
            Stock automatically decrements as doses are marked Taken, and alerts when running low.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {refillNotice && <div className="alert alert-info" style={{ background: "var(--pine-100)", color: "var(--pine-900)" }}>✅ {refillNotice}</div>}

      {!items ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading inventory…</p>
      ) : items.length === 0 ? (
        <div className="card empty-state"><p>No medicines to track yet.</p></div>
      ) : (
        <div className="med-grid">
          {items.map((inv) => {
            const low = inv.currentQuantity <= inv.minimumQuantity;
            return (
              <div
                className="card med-tile"
                key={inv.id}
                style={{
                  borderLeft: low ? "4px solid var(--amber-500)" : "1px solid var(--line)",
                  background: low ? "#FFFBF6" : "#fff",
                }}
              >
                <div className="dose-icon" style={{ background: low ? "var(--amber-100)" : "var(--surface-sunken)", color: low ? "var(--amber-600)" : "var(--pine-700)" }}>
                  ▤
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="med-tile-name" style={{ cursor: "default" }}>{inv.medicineName}</span>
                    {inv.dosage && <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>({inv.dosage})</span>}
                  </div>
                  <div className="dose-meta" style={{ marginTop: 2 }}>
                    <strong>{inv.currentQuantity}</strong> units in stock · threshold: {inv.minimumQuantity} units
                  </div>
                  {low && (
                    <span className="badge badge-amber" style={{ marginTop: 6, display: "inline-block" }}>
                      ⚠️ Running Low
                    </span>
                  )}
                  {inv.expiryDate && (
                    <span style={{ fontSize: 11.5, color: "var(--ink-soft)", marginLeft: 8 }}>
                      Expires: {inv.expiryDate}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {editing === inv.medicineId ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="number" min="1" placeholder="Units" value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        style={{ width: 80, padding: "7px 10px", border: "1.5px solid var(--line)", borderRadius: 8 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => refill(inv.medicineId)}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => refill(inv.medicineId, 30)}
                        title="Add standard 30-day bottle/box refill"
                      >
                        +30 Refill
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(inv.medicineId)}>
                        Custom Qty
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
