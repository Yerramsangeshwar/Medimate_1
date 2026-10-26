import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import PrescriptionScannerModal from "../components/PrescriptionScannerModal";

export default function Prescriptions() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [form, setForm] = useState({ doctorName: "", hospitalName: "", date: "", expiryDate: "", notes: "" });
  const fileRef = useRef();

  const load = async () => {
    try {
      const { prescriptions } = await api.listPrescriptions();
      setItems(prescriptions);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const onUpload = async (e) => {
    e.preventDefault();
    setError("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please choose a PDF, JPG, or PNG file."); return; }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    fd.append("file", file);

    setBusy(true);
    try {
      await api.uploadPrescription(fd);
      setForm({ doctorName: "", hospitalName: "", date: "", expiryDate: "", notes: "" });
      if (fileRef.current) fileRef.current.value = "";
      setShowUploadForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.deletePrescription(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0 }}>Prescriptions & Medical Records</h1>
          <p style={{ color: "var(--ink-soft)", margin: "4px 0 0" }}>
            Keep prescriptions on file and auto-extract schedules using smart AI scanning.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setScannerOpen(true)}>
            📸 Scan Prescription with AI
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowUploadForm(!showUploadForm)}>
            {showUploadForm ? "Close Form" : "+ Upload Document"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Manual Document Upload Form */}
      {showUploadForm && (
        <form onSubmit={onUpload} className="card" style={{ marginBottom: 18, maxWidth: 540 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Upload Prescription File</h3>
          <div className="field-row">
            <div className="field">
              <label>Doctor Name</label>
              <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="Dr. John Doe" />
            </div>
            <div className="field">
              <label>Hospital / Clinic</label>
              <input value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} placeholder="City General Hospital" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Prescription Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="field">
              <label>Expiry / Review Date</label>
              <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Notes / Diagnosis Summary</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="E.g. 3-month refill for blood pressure" />
          </div>
          <div className="field">
            <label>File (PDF, JPG, PNG — max 10MB)</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Save Document"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowUploadForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Prescription List */}
      {!items ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading prescription documents…</p>
      ) : items.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: "center", padding: 32 }}>
          <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>📄</span>
          <p style={{ fontWeight: 600, color: "var(--pine-900)" }}>No prescription records stored yet.</p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
            Scan an image using AI to auto-create medication reminders, or upload a scanned copy for safekeeping.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary btn-sm" onClick={() => setScannerOpen(true)}>
              📸 Scan Prescription with AI
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowUploadForm(true)}>
              Upload Document
            </button>
          </div>
        </div>
      ) : (
        <div className="med-grid">
          {items.map((p) => (
            <div className="card med-tile" key={p.id}>
              <div className="dose-icon">▥</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="med-tile-name" style={{ cursor: "default" }}>
                  {p.doctorName || "Prescription Document"}
                </div>
                <div className="dose-meta">
                  {p.hospitalName ? `${p.hospitalName} · ` : ""}
                  {p.date ? `Issued: ${p.date}` : "No issue date"}
                  {p.expiryDate ? ` · Valid until: ${p.expiryDate}` : ""}
                </div>
                {p.notes && (
                  <div style={{ fontSize: 12, color: "var(--pine-700)", marginTop: 4 }}>
                    {p.notes}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {p.fileUrl && (
                  <a className="btn btn-ghost btn-sm" href={p.fileUrl} download>
                    View / Download
                  </a>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PrescriptionScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onMedicinesAdded={load}
      />
    </div>
  );
}
