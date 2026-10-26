import { speakReminder } from "../utils/audioReminder";

const TYPE_ICON = {
  tablet: "⬤", capsule: "⬬", syrup: "◇", injection: "✚", drops: "◈",
  cream: "▢", inhaler: "⟟", powder: "░", other: "•",
};

const STATUS_LABEL = {
  TAKEN: "Taken", MISSED: "Missed", SKIPPED: "Skipped", PENDING: "Pending", SNOOZED: "Snoozed",
};

export default function DoseCard({ dose, onAction, onSnooze }) {
  const canAct = dose.status === "PENDING" || dose.status === "SNOOZED";

  const handleSpeak = () => {
    const medName = dose.medicine?.name || dose.medicineName || "Medication";
    const dosage = dose.medicine?.dosage || dose.dosage || "";
    const food = dose.medicine?.foodInstruction || dose.foodInstruction || "none";
    const foodText = food === "after" ? "after food" : food === "before" ? "before food" : "with water";
    const time = dose.scheduledTime;
    speakReminder(`Reminder for ${time}: Please take ${medName} ${dosage}, ${foodText}.`);
  };

  return (
    <div className="card dose-card" style={{ transition: "all 0.15s ease" }}>
      <div className="dose-icon">{TYPE_ICON[dose.medicine?.type || dose.medicineType] || "•"}</div>
      <div className="dose-info">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="dose-name">{dose.medicine?.name || dose.medicineName}</span>
          {(dose.foodInstruction || dose.medicine?.foodInstruction) && (dose.foodInstruction || dose.medicine?.foodInstruction) !== "none" && (
            <span style={{
              fontSize: 11, background: "var(--surface-sunken)", color: "var(--pine-700)",
              padding: "2px 8px", borderRadius: 12, fontWeight: 600
            }}>
              🍽️ {dose.foodInstruction || dose.medicine?.foodInstruction} food
            </span>
          )}
        </div>
        <div className="dose-meta" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          {(dose.medicine?.dosage || dose.dosage) && <span>{dose.medicine?.dosage || dose.dosage} · </span>}
          <span>🕒 {dose.scheduledTime}</span>
          <button
            type="button"
            onClick={handleSpeak}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 13, color: "var(--amber-600)", padding: "0 4px"
            }}
            title="Read out dose reminder"
          >
            🔊
          </button>
        </div>
      </div>
      <div className="dose-actions">
        <span className={`badge badge-${dose.status.toLowerCase()}`}>{STATUS_LABEL[dose.status]}</span>
        {canAct && onAction && (
          <div className="dose-buttons">
            <button className="btn btn-sm btn-primary" onClick={() => onAction(dose.id, "TAKEN")}>
              ✓ Taken
            </button>
            {onSnooze && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onSnooze(dose.id, 15)}
                title="Snooze 15 minutes"
                style={{ fontSize: 12, padding: "6px 9px" }}
              >
                ⏱️ 15m
              </button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={() => onAction(dose.id, "SKIPPED")}>
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
