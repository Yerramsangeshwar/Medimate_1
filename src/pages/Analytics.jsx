import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { api } from "../api/client";

const STATUS_COLORS = {
  taken: "#1D4B42",   // Pine
  missed: "#B23B30",  // Coral
  skipped: "#D6924A", // Amber
};

export default function Analytics() {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async (days) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.analytics(days);
      setData(res);
    } catch (err) {
      setError(err.message || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(rangeDays);
  }, [rangeDays, loadData]);

  if (loading && !data) {
    return <p style={{ color: "var(--ink-soft)" }}>Loading adherence analytics…</p>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  const {
    overallRate,
    counts,
    dailyTrend,
    timeOfDayData,
    perMedicine,
    currentStreak,
    bestStreak,
  } = data || {};

  const pieData = [
    { name: "Taken", value: counts?.taken || 0, color: STATUS_COLORS.taken },
    { name: "Missed", value: counts?.missed || 0, color: STATUS_COLORS.missed },
    { name: "Skipped", value: counts?.skipped || 0, color: STATUS_COLORS.skipped },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>📈 Adherence Analytics & Trends</h1>
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>
            Visual patterns, compliance breakdown, and schedule habits.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Range picker */}
          <div style={{ display: "flex", background: "var(--surface-sunken)", borderRadius: 20, padding: 3, border: "1px solid var(--line)" }}>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                style={{
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: 16,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  background: rangeDays === days ? "var(--pine-700)" : "transparent",
                  color: rangeDays === days ? "#fff" : "var(--ink-soft)",
                  transition: "all 0.15s ease"
                }}
              >
                {days} Days
              </button>
            ))}
          </div>

          <Link to="/reports" className="btn btn-primary btn-sm">
            📄 Doctor Adherence Report →
          </Link>
        </div>
      </div>

      {/* Top Stat Scorecards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="card stat-card" style={{ borderColor: overallRate >= 80 ? "var(--pine-500)" : "var(--amber-500)" }}>
          <span className="stat-icon" style={{ background: "var(--pine-100)", color: "var(--pine-700)", fontSize: 18 }}>★</span>
          <div>
            <div className="stat-value">{overallRate}%</div>
            <div className="stat-label">Overall Adherence Rate</div>
          </div>
        </div>

        <div className="card stat-card">
          <span className="stat-icon" style={{ background: "var(--amber-100)", color: "var(--amber-600)", fontSize: 18 }}>🔥</span>
          <div>
            <div className="stat-value">{currentStreak} {currentStreak === 1 ? "day" : "days"}</div>
            <div className="stat-label">Current Streak (Best: {bestStreak}d)</div>
          </div>
        </div>

        <div className="card stat-card">
          <span className="stat-icon" style={{ background: "var(--surface-sunken)", color: "var(--pine-900)", fontSize: 18 }}>✓</span>
          <div>
            <div className="stat-value">{counts?.taken || 0}</div>
            <div className="stat-label">Doses Taken on Schedule</div>
          </div>
        </div>

        <div className="card stat-card" style={{ borderColor: counts?.missed > 0 ? "var(--coral-100)" : undefined }}>
          <span className="stat-icon" style={{ background: "var(--coral-100)", color: "var(--coral-600)", fontSize: 18 }}>✕</span>
          <div>
            <div className="stat-value">{counts?.missed || 0}</div>
            <div className="stat-label">Missed Doses ({(counts?.skipped || 0)} skipped)</div>
          </div>
        </div>
      </div>

      {/* Main Trend Chart */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 17, margin: 0 }}>Daily Adherence Timeline</h3>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Percentage of scheduled doses taken each day</span>
          </div>
        </div>

        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="adhGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4B42" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1D4B42" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="shortDate" stroke="#889890" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#889890" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                formatter={(val) => [`${val}%`, "Adherence Rate"]}
                labelFormatter={(lbl) => `Date: ${lbl}`}
                contentStyle={{ background: "#fff", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="adherenceRate" stroke="#1D4B42" strokeWidth={2.5} fillOpacity={1} fill="url(#adhGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row: Time of Day Breakdown + Status Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        {/* Time of day */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Dose Timing Performance</h3>
          <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "block", marginBottom: 14 }}>
            Compliance rate across times of day
          </span>

          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={timeOfDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="slot" stroke="#889890" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#889890" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  formatter={(val, name, props) => [`${val}% (${props.payload.taken}/${props.payload.total} taken)`, "Compliance"]}
                  contentStyle={{ background: "#fff", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12 }}
                />
                <Bar dataKey="rate" fill="#D6924A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Donut */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Dose Outcome Ratio</h3>
          <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "block", marginBottom: 14 }}>
            Breakdown across {rangeDays} days
          </span>

          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} doses`, name]}
                  contentStyle={{ background: "#fff", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Per-Medicine Adherence Table */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 17, marginBottom: 6 }}>Medication-Specific Compliance</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
          Comparison of individual prescriptions over the selected period.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--ink-soft)" }}>
                <th style={{ padding: "8px 10px" }}>Medicine</th>
                <th style={{ padding: "8px 10px" }}>Dosage</th>
                <th style={{ padding: "8px 10px" }}>Doses Taken</th>
                <th style={{ padding: "8px 10px" }}>Missed</th>
                <th style={{ padding: "8px 10px" }}>Compliance Rate</th>
              </tr>
            </thead>
            <tbody>
              {perMedicine?.map((m, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--surface-sunken)" }}>
                  <td style={{ padding: "10px", fontWeight: 700, color: "var(--pine-900)" }}>{m.name}</td>
                  <td style={{ padding: "10px", color: "var(--ink-soft)" }}>{m.dosage}</td>
                  <td style={{ padding: "10px", color: "var(--pine-700)", fontWeight: 600 }}>{m.taken}</td>
                  <td style={{ padding: "10px", color: m.missed > 0 ? "var(--coral-600)" : "var(--ink-soft)" }}>{m.missed}</td>
                  <td style={{ padding: "10px" }}>
                    <span className={`badge ${m.rate >= 80 ? "badge-pine" : m.rate >= 50 ? "badge-amber" : "badge-coral"}`}>
                      {m.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
