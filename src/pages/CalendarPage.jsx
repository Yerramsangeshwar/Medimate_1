import { useEffect, useState } from "react";
import { api } from "../api/client";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COLOR_MAP = { green: "#2C6B5D", yellow: "#D6924A", red: "#B23B30", gray: "#D9E2DC", blue: "#3B82F6" };

function pad(n) { return String(n).padStart(2, "0"); }

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [days, setDays] = useState({});
  const [selected, setSelected] = useState(null);
  const [dayDoses, setDayDoses] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await api.calendar(year, month);
      let map = {};
      if (Array.isArray(res.days)) {
        res.days.forEach((d) => { map[d.date || d.scheduledDate] = d; });
      } else if (res.days && typeof res.days === "object") {
        map = res.days;
      }
      setDays(map);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [year, month]);

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y); setSelected(null);
  };

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const openDay = async (day) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    setSelected(dateStr);
    try {
      const { doses } = await api.doseHistory({ from: dateStr, to: dateStr });
      setDayDoses(doses || []);
    } catch (e) {
      setDayDoses([]);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Monthly Adherence Calendar</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(-1)}>←</button>
          <strong style={{ fontFamily: "Fraunces, serif", fontSize: 17 }}>{MONTH_NAMES[month - 1]} {year}</strong>
          <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(1)}>→</button>
        </div>

        <div className="cal-grid cal-head">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const info = days[dateStr];
            const color = info ? COLOR_MAP[info.color] : "transparent";
            return (
              <button
                key={i}
                className={`cal-cell ${selected === dateStr ? "cal-cell-selected" : ""}`}
                onClick={() => openDay(day)}
              >
                <span>{day}</span>
                <span className="cal-dot" style={{ background: color }} />
              </button>
            );
          })}
        </div>

        <div className="cal-legend">
          <LegendItem color={COLOR_MAP.green} label="All taken" />
          <LegendItem color={COLOR_MAP.yellow} label="Partial" />
          <LegendItem color={COLOR_MAP.red} label="Missed" />
          <LegendItem color={COLOR_MAP.gray} label="Future / None" />
        </div>
      </div>

      {selected && (
        <div className="card" style={{ maxWidth: 460, marginTop: 14 }}>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Doses on {selected}</h3>
          {dayDoses.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No doses recorded for this date.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayDoses.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}>
                  <div>
                    <strong>{d.medicineName || d.medicine?.name}</strong> {d.dosage && `(${d.dosage})`} · ⏰ {d.scheduledTime}
                  </div>
                  <span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
