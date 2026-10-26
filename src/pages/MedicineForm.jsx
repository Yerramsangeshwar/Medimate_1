import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

const TYPES = ["tablet", "capsule", "syrup", "injection", "drops", "cream", "inhaler", "powder", "other"];
const FREQUENCIES = [
  { value: "once_daily", label: "Once daily", defaultTimes: ["09:00"] },
  { value: "twice_daily", label: "Twice daily", defaultTimes: ["09:00", "21:00"] },
  { value: "thrice_daily", label: "Three times daily", defaultTimes: ["08:00", "14:00", "20:00"] },
  { value: "custom", label: "Custom times", defaultTimes: ["09:00"] },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function MedicineForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [families, setFamilies] = useState([]);
  const [form, setForm] = useState({
    name: "", type: "tablet", dosage: "", quantity: 0,
    frequency: "once_daily", times: ["09:00"], daysOfWeek: null,
    startDate: todayStr(), endDate: "", foodInstruction: "none",
    doctorName: "", notes: "", familyMemberId: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listFamily().then(({ familyMembers }) => setFamilies(familyMembers)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.getMedicine(id).then(({ medicine }) => {
      setForm({
        name: medicine.name, type: medicine.type, dosage: medicine.dosage || "",
        quantity: medicine.quantity, frequency: medicine.frequency, times: medicine.times,
        daysOfWeek: medicine.daysOfWeek, startDate: medicine.startDate, endDate: medicine.endDate || "",
        foodInstruction: medicine.foodInstruction, doctorName: medicine.doctorName || "",
        notes: medicine.notes || "", familyMemberId: medicine.familyMemberId || "",
      });
    }).catch((err) => setError(err.message));
  }, [id, isEdit]);

  const onFrequencyChange = (value) => {
    const preset = FREQUENCIES.find((f) => f.value === value);
    setForm({ ...form, frequency: value, times: value === "custom" ? form.times : preset.defaultTimes });
  };

  const updateTime = (idx, val) => {
    const times = [...form.times];
    times[idx] = val;
    setForm({ ...form, times });
  };
  const addTime = () => setForm({ ...form, times: [...form.times, "09:00"] });
  const removeTime = (idx) => setForm({ ...form, times: form.times.filter((_, i) => i !== idx) });

  const toggleDay = (i) => {
    const current = form.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    const next = current.includes(i) ? current.filter((d) => d !== i) : [...current, i].sort();
    setForm({ ...form, daysOfWeek: next.length === 7 ? null : next });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { ...form, familyMemberId: form.familyMemberId || null, endDate: form.endDate || null };
      if (isEdit) await api.updateMedicine(id, payload);
      else await api.createMedicine(payload);
      navigate("/medicines");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const activeDays = form.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>{isEdit ? "Edit medicine" : "Add a medicine"}</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={onSubmit} className="card">
        <div className="field">
          <label>Medicine name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Paracetamol" />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Dosage</label>
            <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 500mg" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Quantity in hand</label>
            <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="field">
            <label>Before/after food</label>
            <select value={form.foodInstruction} onChange={(e) => setForm({ ...form, foodInstruction: e.target.value })}>
              <option value="none">No preference</option>
              <option value="before">Before food</option>
              <option value="after">After food</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Frequency</label>
          <select value={form.frequency} onChange={(e) => onFrequencyChange(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Dose times</label>
          {form.times.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input type="time" value={t} onChange={(e) => updateTime(i, e.target.value)} style={{ flex: 1 }} />
              {form.times.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTime(i)}>Remove</button>
              )}
            </div>
          ))}
          {form.frequency === "custom" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addTime}>+ Add another time</button>
          )}
        </div>

        <div className="field">
          <label>Repeat on days</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {WEEKDAYS.map((d, i) => (
              <button
                type="button" key={d}
                className={`btn btn-sm ${activeDays.includes(i) ? "btn-primary" : "btn-ghost"}`}
                onClick={() => toggleDay(i)}
              >{d}</button>
            ))}
          </div>
          <p className="field-hint">All days selected = every day.</p>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Start date</label>
            <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="field">
            <label>End date (optional)</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Doctor (optional)</label>
            <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
          </div>
          <div className="field">
            <label>For (optional)</label>
            <select value={form.familyMemberId} onChange={(e) => setForm({ ...form, familyMemberId: e.target.value })}>
              <option value="">Myself</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.relation})</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Notes (optional)</label>
          <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Add medicine"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
