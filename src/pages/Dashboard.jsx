import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import DoseCard from "../components/DoseCard";
import CaregiverModal from "../components/CaregiverModal";
import PrescriptionScannerModal from "../components/PrescriptionScannerModal";
import { speakReminder, playReminderChime } from "../utils/audioReminder";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [caregiverOpen, setCaregiverOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.dashboard();
      setData(res);
      // Check if 100% complete
      if (res.todayStats?.total > 0 && res.todayStats?.taken === res.todayStats?.total) {
        setShowCelebration(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onAction = async (doseId, status) => {
    await api.updateDose(doseId, status);
    if (status === "TAKEN") {
      playReminderChime();
    }
    load();
  };

  const onSnooze = async (doseId, minutes = 15) => {
    await api.snoozeDose(doseId, minutes);
    load();
  };

  const handleAnnounceAll = () => {
    if (!data?.todayDoses?.length) {
      speakReminder("You have no medications scheduled for today.");
      return;
    }
    const pendingDoses = data.todayDoses.filter((d) => d.status === "PENDING" || d.status === "SNOOZED");
    if (pendingDoses.length === 0) {
      speakReminder("All your scheduled medications for today are already complete! Great job.");
      return;
    }
    const medNames = pendingDoses.map((d) => `${d.medicineName} at ${d.scheduledTime}`).join(", ");
    speakReminder(`You have ${pendingDoses.length} doses pending today: ${medNames}.`);
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p style={{ color: "var(--ink-soft)" }}>Loading your dashboard…</p>;

  const { todayStats, activeMedicines, lowStock, adherence30d, streakDays, todayDoses } = data;
  const firstName = (user?.name || "").split(" ")[0];

  // Find next pending dose
  const nextDose = todayDoses.find((d) => d.status === "PENDING" || d.status === "SNOOZED");

  return (
    <div>
      {/* Top Welcome Bar & Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 2 }}>{greeting()}, {firstName || "there"} 👋</h1>
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>
            Here is your daily medication overview & adherence record.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleAnnounceAll} title="Listen to today's schedule">
            🔊 Announce Schedule
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScannerOpen(true)}>
            📸 Scan Prescription
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setCaregiverOpen(true)}>
            🛡️ Caregiver Alert
          </button>
        </div>
      </div>

      {/* Progress ring + stat cards */}
      <div className="dash-top">
        <div className="card ring-card">
          <svg viewBox="0 0 120 120" width="112" height="112">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-sunken)" strokeWidth="12" />
            <circle
              cx="60" cy="60" r="50" fill="none" stroke="var(--amber-500)" strokeWidth="12"
              strokeDasharray={`${(todayStats.progressPct / 100) * 314} 314`}
              strokeLinecap="round" transform="rotate(-90 60 60)"
            />
            <text x="60" y="56" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--pine-900)" fontFamily="Fraunces, serif">
              {todayStats.progressPct}%
            </text>
            <text x="60" y="76" textAnchor="middle" fontSize="10" fill="var(--ink-soft)">today</text>
          </svg>
          <div>
            <p style={{ fontWeight: 700, color: "var(--pine-900)", marginBottom: 2 }}>
              {todayStats.taken} / {todayStats.total} doses complete
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {todayStats.pending} pending · {todayStats.missed} missed · {todayStats.snoozed || 0} snoozed
            </p>
            {streakDays > 0 && (
              <span style={{ fontSize: 11.5, color: "var(--amber-600)", fontWeight: 700, marginTop: 4, display: "inline-block" }}>
                🔥 {streakDays}-day perfect adherence streak!
              </span>
            )}
          </div>
        </div>

        <div className="stat-grid">
          <StatCard label="Active medicines" value={activeMedicines} icon="⬡" />
          <StatCard label="Today's reminders" value={todayStats.total} icon="◷" />
          <StatCard label="30-day adherence" value={adherence30d !== null ? `${adherence30d}%` : "—"} icon="◆" link="/analytics" />
          <StatCard label="Running low" value={lowStock.length} icon="▤" warn={lowStock.length > 0} link="/inventory" />
        </div>
      </div>

      {/* Next Dose Banner */}
      {nextDose && (
        <div className="card" style={{
          marginTop: 18, background: "var(--pine-100)", border: "1px solid var(--pine-500)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12
        }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--pine-700)" }}>
              ⏰ Next Upcoming Medication
            </span>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--pine-900)", marginTop: 2 }}>
              {nextDose.medicineName} ({nextDose.dosage}) at {nextDose.scheduledTime}
            </div>
            {nextDose.foodInstruction && nextDose.foodInstruction !== "none" && (
              <span style={{ fontSize: 12, color: "var(--pine-700)" }}>
                Instructions: Take {nextDose.foodInstruction} food
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onAction(nextDose.id, "TAKEN")}>
              ✓ Mark Taken
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onSnooze(nextDose.id, 15)} style={{ background: "#fff" }}>
              ⏱️ Snooze 15m
            </button>
          </div>
        </div>
      )}

      {/* Celebration Banner */}
      {showCelebration && todayStats.total > 0 && todayStats.taken === todayStats.total && (
        <div className="alert alert-info" style={{ marginTop: 18, background: "var(--pine-100)", color: "var(--pine-900)", borderColor: "var(--pine-500)" }}>
          🎉 <strong>Outstanding job!</strong> You have taken all scheduled medications for today. Your adherence streak is protected.
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="alert alert-info" style={{ marginTop: 18 }}>
          ⚠️ {lowStock.map((m) => m.name).join(", ")} running low.{" "}
          <Link to="/inventory">Review & refill inventory →</Link>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 12 }}>
        <h2 style={{ fontSize: 19, margin: 0 }}>Today's medicines</h2>
        <Link to="/medicines/new" className="btn btn-ghost btn-sm">
          + Add Medicine
        </Link>
      </div>

      {todayDoses.length === 0 ? (
        <div className="card empty-state">
          <p>No medicines scheduled for today yet.</p>
          <Link to="/medicines/new" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>Add a medicine</Link>
        </div>
      ) : (
        <div className="dose-list">
          {todayDoses.map((d) => (
            <DoseCard
              key={d.id}
              dose={d}
              onAction={onAction}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      )}

      <div className="disclaimer" style={{ marginTop: 26 }}>
        MediMate is a medication-management and reminder tool. It doesn't diagnose conditions or
        replace advice from your doctor or pharmacist.
      </div>

      <CaregiverModal
        isOpen={caregiverOpen}
        onClose={() => setCaregiverOpen(false)}
        userProfile={{ name: user?.name, emergencyContact: data.emergencyContact }}
      />

      <PrescriptionScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onMedicinesAdded={load}
      />
    </div>
  );
}

function StatCard({ label, value, icon, warn, link }) {
  const content = (
    <div className="card stat-card" style={warn ? { borderColor: "var(--amber-500)" } : undefined}>
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );

  if (link) {
    return <Link to={link} style={{ textDecoration: "none", color: "inherit" }}>{content}</Link>;
  }
  return content;
}
