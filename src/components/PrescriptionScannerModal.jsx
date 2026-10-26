import { useState } from "react";
import { api } from "../api/client";

export default function PrescriptionScannerModal({ isOpen, onClose, onMedicinesAdded }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewUrl(ev.target?.result || "");
      reader.readAsDataURL(f);
      setExtractedData(null);
      setError("");
    }
  };

  const handleScan = async (sampleType) => {
    setScanning(true);
    setError("");
    setSuccessMsg("");
    try {
      let payload = {};
      if (sampleType) {
        payload = { sampleType };
      } else if (previewUrl) {
        payload = { imageBase64: previewUrl, mimeType: file?.type || "image/jpeg" };
      } else {
        setError("Please choose an image file or pick one of the sample prescription presets below.");
        setScanning(false);
        return;
      }

      const res = await api.aiScanPrescription(payload);
      setExtractedData(res);
    } catch (err) {
      setError(err.message || "Failed to scan prescription.");
    } finally {
      setScanning(false);
    }
  };

  const handleImportAll = async () => {
    if (!extractedData?.medications?.length) return;
    setSaving(true);
    setError("");

    try {
      const today = new Date().toISOString().slice(0, 10);
      let count = 0;

      for (const med of extractedData.medications) {
        const payload = {
          name: med.name || "Prescription Medicine",
          type: med.type || "tablet",
          dosage: med.dosage || "As prescribed",
          quantity: med.quantity || 30,
          frequency: med.frequency || "once_daily",
          times: Array.isArray(med.times) && med.times.length > 0 ? med.times : ["09:00"],
          startDate: today,
          foodInstruction: med.foodInstruction || "none",
          doctorName: extractedData.doctorName || "",
          notes: med.notes || (extractedData.hospitalName ? `Prescribed at ${extractedData.hospitalName}` : ""),
        };
        await api.createMedicine(payload);
        count++;
      }

      setSuccessMsg(`Successfully imported ${count} medication(s) to your active schedule!`);
      setTimeout(() => {
        if (onMedicinesAdded) onMedicinesAdded();
        onClose();
      }, 1200);
    } catch (err) {
      setError("Import failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(18, 49, 43, 0.6)", zIndex: 999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div className="card" style={{
        width: "100%", maxWidth: 650, maxHeight: "90vh",
        display: "flex", flexDirection: "column", padding: 0, overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", background: "var(--pine-900)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>📸 Smart Prescription Scanner</h3>
            <span style={{ fontSize: 12, color: "#C9DAD2" }}>AI-assisted medication extraction & schedule import</span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", borderRadius: "50%", width: 32, height: 32, padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Modal content */}
        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div className="alert alert-error">{error}</div>}
          {successMsg && <div className="alert alert-info" style={{ background: "var(--pine-100)", color: "var(--pine-900)" }}>✅ {successMsg}</div>}

          {!extractedData ? (
            <>
              {/* File upload input */}
              <div style={{
                border: "2px dashed var(--line)", borderRadius: 12, padding: "24px 16px",
                textAlign: "center", background: "var(--surface-sunken)"
              }}>
                <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>📄</span>
                <p style={{ fontWeight: 600, color: "var(--pine-900)", marginBottom: 4 }}>
                  Upload a photo of your doctor's prescription or medication label
                </p>
                <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
                  Supports JPG, PNG, or WebP. MediMate will extract doses, frequencies, and timing for your review.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  id="rx-scan-file-input"
                />
                <label htmlFor="rx-scan-file-input" className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
                  {file ? `Selected: ${file.name}` : "Choose Image File"}
                </label>
              </div>

              {previewUrl && (
                <div style={{ textAlign: "center" }}>
                  <img src={previewUrl} alt="Prescription preview" style={{ maxHeight: 180, borderRadius: 8, border: "1px solid var(--line)" }} />
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary" onClick={() => handleScan()} disabled={scanning}>
                      {scanning ? "Scanning prescription with AI…" : "🔍 Scan Uploaded Prescription"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sample Prescriptions Demo */}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Or test with sample prescription templates:
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleScan("cardio")}
                    disabled={scanning}
                  >
                    🩺 Cardiology Rx (Lisinopril + Atorvastatin)
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleScan("pediatric")}
                    disabled={scanning}
                  >
                    👶 Pediatric Rx (Amoxicillin & Drops)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <div style={{ background: "var(--pine-100)", padding: "12px 16px", borderRadius: 10, marginBottom: 16 }}>
                <p style={{ fontWeight: 700, color: "var(--pine-900)", margin: 0 }}>
                  Doctor: {extractedData.doctorName || "Prescribing Physician"}
                </p>
                <p style={{ fontSize: 12.5, color: "var(--pine-700)", margin: "2px 0 0" }}>
                  Facility: {extractedData.hospitalName || "Medical Clinic"} · Date: {extractedData.date || "Recent"}
                </p>
              </div>

              <h4 style={{ fontSize: 15, marginBottom: 10 }}>Extracted Medications ({extractedData.medications?.length || 0})</h4>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
                Please verify each item against your physical prescription bottle or paper before adding.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto" }}>
                {extractedData.medications?.map((m, idx) => (
                  <div key={idx} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--pine-900)" }}>{m.name}</span>
                      <span className="badge badge-amber">{m.dosage || "Dose"}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                      Form: {m.type} · Times: {m.times?.join(", ") || "Standard"} · Instruction: {m.foodInstruction !== "none" ? `Take ${m.foodInstruction} food` : "No food restriction"}
                    </div>
                    {m.notes && <div style={{ fontSize: 11.5, color: "var(--pine-700)", marginTop: 4, fontStyle: "italic" }}>Note: {m.notes}</div>}
                  </div>
                ))}
              </div>

              <div className="disclaimer" style={{ marginTop: 14 }}>
                ⚠️ {extractedData.disclaimer || "MediMate does not alter prescriptions. Always confirm details with your pharmacist."}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setExtractedData(null)} disabled={saving}>
                  Scan Another
                </button>
                <button className="btn btn-primary" onClick={handleImportAll} disabled={saving}>
                  {saving ? "Adding to Schedule…" : "✓ Confirm & Add to My Medicines"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
