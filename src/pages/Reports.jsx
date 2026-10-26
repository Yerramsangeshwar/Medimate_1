import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await api.clinicalReport();
        setData(res);
      } catch (err) {
        setError(err.message || "Failed to generate report.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Generating clinical adherence report…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const { patient, adherence, medicines, missedDoses, reportDate, dateRange } = data;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      {/* Top action bar (hidden during print) */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link to="/analytics" style={{ fontSize: 13, textDecoration: "none", color: "var(--pine-700)", fontWeight: 600 }}>
          ← Back to Analytics
        </Link>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Clinical Report Paper */}
      <div className="card" style={{ padding: "36px 40px", background: "#fff", border: "1px solid var(--line)" }}>
        {/* Document Header */}
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid var(--pine-900)", paddingBottom: 16, marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24, color: "var(--pine-700)" }}>℞</span>
              <h1 style={{ fontSize: 24, margin: 0, color: "var(--pine-900)" }}>MediMate Clinical Adherence Summary</h1>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>
              Patient Medication Compliance & Daily Adherence Record
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--ink-soft)" }}>
            <div><strong>Report Date:</strong> {reportDate}</div>
            <div><strong>Coverage:</strong> {dateRange.from} to {dateRange.to}</div>
          </div>
        </div>

        {/* Patient Profile Information */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14,
          background: "var(--surface-sunken)", padding: "14px 18px", borderRadius: 8, marginBottom: 24
        }}>
          <div>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase" }}>Patient Name</span>
            <div style={{ fontWeight: 700, color: "var(--pine-900)" }}>{patient.name}</div>
          </div>
          <div>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase" }}>Age / Gender</span>
            <div style={{ fontWeight: 600, color: "var(--pine-900)" }}>{patient.age || "—"} yrs · {patient.gender || "—"}</div>
          </div>
          <div>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase" }}>Blood Group</span>
            <div style={{ fontWeight: 600, color: "var(--pine-900)" }}>{patient.bloodGroup || "—"}</div>
          </div>
          <div>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase" }}>Emergency Contact</span>
            <div style={{ fontWeight: 600, color: "var(--pine-900)" }}>{patient.emergencyContact || "—"}</div>
          </div>
        </div>

        {/* Adherence Scorecard */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 28, alignItems: "center" }}>
          <div style={{ border: "2px solid var(--pine-700)", borderRadius: 12, padding: "16px 20px", textAlign: "center", background: "var(--pine-100)" }}>
            <span style={{ fontSize: 12, textTransform: "uppercase", color: "var(--pine-700)", fontWeight: 700 }}>
              30-Day Adherence Score
            </span>
            <div style={{ fontSize: 44, fontWeight: 800, color: "var(--pine-900)", lineHeight: 1.1, margin: "6px 0" }}>
              {adherence.rate}%
            </div>
            <span style={{ fontSize: 12, color: "var(--pine-700)" }}>
              {adherence.taken} of {adherence.total - adherence.pending} completed
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, textAlign: "center" }}>
            <div style={{ background: "var(--surface-sunken)", padding: "12px 8px", borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pine-900)" }}>{adherence.taken}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Doses Taken</div>
            </div>
            <div style={{ background: "var(--surface-sunken)", padding: "12px 8px", borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--coral-600)" }}>{adherence.missed}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Doses Missed</div>
            </div>
            <div style={{ background: "var(--surface-sunken)", padding: "12px 8px", borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber-600)" }}>{adherence.skipped}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Doses Skipped</div>
            </div>
          </div>
        </div>

        {/* Active Medications Table */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, color: "var(--pine-900)", marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
            Current Active Prescriptions ({medicines.length})
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", textAlign: "left", color: "var(--pine-900)" }}>
                <th style={{ padding: "8px 10px" }}>Medication</th>
                <th style={{ padding: "8px 10px" }}>Dosage</th>
                <th style={{ padding: "8px 10px" }}>Schedule / Times</th>
                <th style={{ padding: "8px 10px" }}>Food Rule</th>
                <th style={{ padding: "8px 10px" }}>Prescribed By</th>
                <th style={{ padding: "8px 10px" }}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{m.name}</td>
                  <td style={{ padding: "8px 10px" }}>{m.dosage}</td>
                  <td style={{ padding: "8px 10px" }}>{m.times.join(", ")}</td>
                  <td style={{ padding: "8px 10px" }}>{m.foodInstruction !== "none" ? `Take ${m.foodInstruction} food` : "None"}</td>
                  <td style={{ padding: "8px 10px", color: "var(--ink-soft)" }}>{m.doctorName || "Primary Care"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: m.status === "Low Stock" ? "var(--coral-600)" : "var(--pine-700)" }}>
                      {m.currentQuantity} left
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Missed Doses Log */}
        {missedDoses.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 16, color: "var(--coral-600)", marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
              Missed Doses Audit (Last 30 Days)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {missedDoses.map((md, idx) => (
                <div key={idx} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}>
                  <strong>{md.medicineName}</strong> ({md.dosage})<br />
                  <span style={{ color: "var(--coral-600)" }}>{md.scheduledDate} at {md.scheduledTime}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Sign-off & Physician Remarks */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20, marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                Physician Consultation Notes
              </span>
              <div style={{ height: 60, borderBottom: "1px dashed #aaa", marginTop: 10 }} />
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                Doctor Signature & Review Stamp
              </span>
              <div style={{ height: 60, borderBottom: "1px dashed #aaa", marginTop: 10 }} />
            </div>
          </div>
        </div>

        {/* Mandatory Clinical Disclaimer */}
        <div style={{ marginTop: 28, fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          {data.disclaimer}
        </div>
      </div>
    </div>
  );
}
