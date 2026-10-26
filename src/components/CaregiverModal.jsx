import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function CaregiverModal({ isOpen, onClose, userProfile }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedType, setSelectedType] = useState("DAILY_COMPLETE");
  const [customMsg, setCustomMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      setStatusMsg("");
      setErrorMsg("");
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.caregiverLogs();
      setLogs(res.logs || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setStatusMsg("");
    setErrorMsg("");
    try {
      const res = await api.caregiverAlert({
        type: selectedType,
        customMessage: customMsg,
      });
      setStatusMsg(res.message);
      setCustomMsg("");
      loadLogs();
    } catch (err) {
      setErrorMsg(err.message || "Could not dispatch alert.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(18, 49, 43, 0.6)", zIndex: 999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div className="card" style={{
        width: "100%", maxWidth: 540, maxHeight: "90vh",
        display: "flex", flexDirection: "column", padding: 0, overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", background: "var(--pine-900)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>🛡️ Caregiver & Emergency Alerts</h3>
            <span style={{ fontSize: 12, color: "#C9DAD2" }}>Keep family, caregivers, or emergency contacts in the loop</span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", borderRadius: "50%", width: 32, height: 32, padding: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Emergency Contact Card */}
          <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase" }}>Registered Emergency Contact</span>
            <div style={{ fontWeight: 700, color: "var(--pine-900)", fontSize: 16, marginTop: 4 }}>
              {userProfile?.emergencyContact || "No contact configured yet"}
            </div>
            {!userProfile?.emergencyContact && (
              <p style={{ fontSize: 12, color: "var(--coral-600)", margin: "4px 0 0" }}>
                Add your caregiver or relative's phone in your Profile tab to enable automated SMS simulation.
              </p>
            )}
          </div>

          {statusMsg && <div className="alert alert-info">✅ {statusMsg}</div>}
          {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

          {/* Trigger Alert Form */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--pine-900)", marginBottom: 8 }}>
              Select Alert Notification Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className={`btn btn-sm ${selectedType === "DAILY_COMPLETE" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedType("DAILY_COMPLETE")}
              >
                ✓ All Meds Taken
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedType === "MISSED_DOSE" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedType("MISSED_DOSE")}
              >
                ⚠️ Missed Dose Alert
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedType === "REFILL_ALERT" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedType("REFILL_ALERT")}
              >
                💊 Low Stock Refill
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedType === "CUSTOM" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedType("CUSTOM")}
              >
                📝 Custom Note
              </button>
            </div>

            {selectedType === "CUSTOM" && (
              <textarea
                placeholder="Type your message to your caregiver..."
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", marginBottom: 12, height: 70 }}
              />
            )}

            <button
              className="btn btn-primary btn-block"
              onClick={handleSend}
              disabled={sending || !userProfile?.emergencyContact}
            >
              {sending ? "Dispatching Alert…" : "📲 Dispatch Alert to Emergency Contact"}
            </button>
          </div>

          {/* Recent logs */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: "var(--pine-900)" }}>Recent Caregiver Notifications</h4>
            {loading ? (
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>Loading logs…</p>
            ) : logs.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>No caregiver alerts dispatched yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
                {logs.map((l) => (
                  <div key={l.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", background: "#fff", fontSize: 12.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-soft)", fontSize: 11, marginBottom: 2 }}>
                      <span>Sent to: {l.emergencyContact}</span>
                      <span>{l.createdAt?.slice(0, 16)}</span>
                    </div>
                    <div style={{ color: "var(--pine-900)", fontWeight: 500 }}>{l.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
