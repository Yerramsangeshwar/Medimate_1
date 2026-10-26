import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function AiAssistantModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("chat");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatLog, setChatLog] = useState([
    {
      sender: "ai",
      text: "Hello! I am your MediMate Assistant. I can summarize your daily medication schedule, explain prescribed food instructions, or check for general dietary precautions. How can I help you today?",
    },
  ]);
  const [advisories, setAdvisories] = useState([]);
  const [loadingAdvisories, setLoadingAdvisories] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === "interactions" && advisories.length === 0) {
      loadAdvisories();
    }
  }, [isOpen, activeTab]);

  const loadAdvisories = async () => {
    setLoadingAdvisories(true);
    try {
      const res = await api.aiInteractionsCheck();
      setAdvisories(res.advisories || []);
    } catch {
      setAdvisories([]);
    } finally {
      setLoadingAdvisories(false);
    }
  };

  const handleSend = async (textToSend) => {
    const q = (textToSend || question).trim();
    if (!q || busy) return;

    setChatLog((prev) => [...prev, { sender: "user", text: q }]);
    setQuestion("");
    setBusy(true);

    try {
      const res = await api.aiAssistant(q);
      setChatLog((prev) => [
        ...prev,
        {
          sender: "ai",
          text: res.answer,
          disclaimer: res.disclaimer,
        },
      ]);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "I am having trouble answering right now. " + (err.message || ""),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const quickPrompts = [
    "What are my medicines today?",
    "Which medicines require food?",
    "What if I take a dose late?",
    "Summarize my evening routine",
  ];

  return (
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(18, 49, 43, 0.6)", zIndex: 999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div className="card" style={{
        width: "100%", maxWidth: 580, maxHeight: "90vh",
        display: "flex", flexDirection: "column", padding: 0, overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", background: "var(--pine-900)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: "50%", background: "var(--amber-500)",
              color: "#2A1B05", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 16
            }}>✨</span>
            <div>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 17 }}>MediMate Schedule Guide</h3>
              <span style={{ fontSize: 11.5, color: "#C9DAD2" }}>Informational medication & routine guide</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", borderRadius: "50%", width: 32, height: 32, padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--surface-sunken)" }}>
          <button
            onClick={() => setActiveTab("chat")}
            style={{
              flex: 1, padding: "10px", border: "none", background: activeTab === "chat" ? "#fff" : "transparent",
              fontWeight: 700, fontSize: 13, color: activeTab === "chat" ? "var(--pine-900)" : "var(--ink-soft)",
              borderBottom: activeTab === "chat" ? "2px solid var(--amber-500)" : "none", cursor: "pointer"
            }}
          >
            💬 Schedule Assistant
          </button>
          <button
            onClick={() => setActiveTab("interactions")}
            style={{
              flex: 1, padding: "10px", border: "none", background: activeTab === "interactions" ? "#fff" : "transparent",
              fontWeight: 700, fontSize: 13, color: activeTab === "interactions" ? "var(--pine-900)" : "var(--ink-soft)",
              borderBottom: activeTab === "interactions" ? "2px solid var(--amber-500)" : "none", cursor: "pointer"
            }}
          >
            🔍 Food & Interaction Precautions
          </button>
        </div>

        {/* Content body */}
        {activeTab === "chat" ? (
          <div style={{ display: "flex", flexDirection: "column", height: 420 }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {chatLog.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: msg.sender === "user" ? "var(--pine-700)" : "var(--surface-sunken)",
                    color: msg.sender === "user" ? "#fff" : "var(--ink)",
                    padding: "10px 14px",
                    borderRadius: 14,
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {msg.text}
                  {msg.disclaimer && (
                    <div style={{ marginTop: 8, fontSize: 11, opacity: 0.8, borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 4 }}>
                      ⚠️ {msg.disclaimer}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div style={{ alignSelf: "flex-start", padding: "8px 12px", background: "var(--surface-sunken)", borderRadius: 12, fontSize: 13, color: "var(--ink-soft)" }}>
                  Analyzing your medication schedule…
                </div>
              )}
            </div>

            {/* Quick questions */}
            <div style={{ padding: "6px 12px", background: "#FAFBF9", borderTop: "1px solid var(--line)", display: "flex", gap: 6, overflowX: "auto" }}>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  disabled={busy}
                  style={{
                    padding: "4px 10px", fontSize: 11.5, borderRadius: 20, border: "1px solid var(--line)",
                    background: "#fff", color: "var(--pine-700)", cursor: "pointer", whiteSpace: "nowrap"
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input bar */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)", background: "#fff" }}
            >
              <input
                type="text"
                placeholder="Ask about your medicine schedule, food instructions..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={busy}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
              />
              <button className="btn btn-primary btn-sm" disabled={busy || !question.trim()}>
                Send
              </button>
            </form>
          </div>
        ) : (
          <div style={{ padding: 16, height: 420, overflowY: "auto" }}>
            <h4 style={{ fontSize: 15, marginBottom: 8 }}>General Dietary & Administration Precautions</h4>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
              These informational advisories reflect standard pharmacological references for your active medications.
            </p>

            {loadingAdvisories ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Reviewing your medication list…</p>
            ) : advisories.length === 0 ? (
              <div className="alert alert-info">No specific high-priority dietary advisories found. Always follow your doctor's exact instructions.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {advisories.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: item.severity === "warning" ? "var(--coral-100)" : "var(--amber-100)",
                      border: `1px solid ${item.severity === "warning" ? "var(--coral-600)" : "var(--amber-500)"}`
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: item.severity === "warning" ? "var(--coral-600)" : "var(--amber-600)" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="disclaimer" style={{ marginTop: 18 }}>
              ⚠️ MediMate does not diagnose conditions, modify dosages, or replace personal consultation with your prescribing physician or licensed pharmacist.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
