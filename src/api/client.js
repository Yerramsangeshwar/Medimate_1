const BASE = "/api";

function getToken() {
  return localStorage.getItem("medimate_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  loginDemo: () => request("/auth/demo", { method: "POST" }),
  me: () => request("/auth/me"),
  updateProfile: (payload) => request("/auth/me", { method: "PUT", body: payload }),
  changePassword: (payload) => request("/auth/me/password", { method: "PUT", body: payload }),
  forgotPassword: (payload) => request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: payload }),

  // Dashboard
  dashboard: () => request("/dashboard"),
  disclaimer: () => request("/disclaimer"),

  // Medicines
  listMedicines: (familyMemberId) => request(`/medicines${familyMemberId ? `?familyMemberId=${familyMemberId}` : ""}`),
  getMedicine: (id) => request(`/medicines/${id}`),
  createMedicine: (payload) => request("/medicines", { method: "POST", body: payload }),
  updateMedicine: (id, payload) => request(`/medicines/${id}`, { method: "PUT", body: payload }),
  deleteMedicine: (id) => request(`/medicines/${id}`, { method: "DELETE" }),

  // Doses
  todayDoses: () => request("/doses/today"),
  doseHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/doses${qs ? `?${qs}` : ""}`);
  },
  updateDose: (id, status) => request(`/doses/${id}`, { method: "PUT", body: { status } }),
  snoozeDose: (id, minutes) => request(`/doses/${id}/snooze`, { method: "POST", body: { minutes } }),
  calendar: (year, month) => request(`/doses/calendar/${year}/${month}`),

  // Family
  listFamily: () => request("/family"),
  addFamily: (payload) => request("/family", { method: "POST", body: payload }),
  deleteFamily: (id) => request(`/family/${id}`, { method: "DELETE" }),

  // Inventory
  listInventory: () => request("/inventory"),
  updateInventory: (medicineId, payload) => request(`/inventory/${medicineId}`, { method: "PUT", body: payload }),
  refillInventory: (medicineId, count = 30) => request(`/inventory/${medicineId}/refill`, { method: "POST", body: { count } }),

  // Prescriptions
  listPrescriptions: () => request("/prescriptions"),
  uploadPrescription: (formData) => request("/prescriptions", { method: "POST", body: formData, isForm: true }),
  deletePrescription: (id) => request(`/prescriptions/${id}`, { method: "DELETE" }),

  // Analytics & Trends
  analytics: (days = 30) => request(`/analytics?days=${days}`),

  // Doctor Clinical Report
  clinicalReport: () => request("/reports/clinical"),

  // AI & Safety Tools
  aiScanPrescription: (payload) => request("/ai/scan-prescription", { method: "POST", body: payload }),
  aiAssistant: (question) => request("/ai/assistant", { method: "POST", body: { question } }),
  aiInteractionsCheck: () => request("/ai/interactions-check", { method: "POST" }),

  // Caregiver Alerts
  caregiverAlert: (payload) => request("/caregiver/alert", { method: "POST", body: payload }),
  caregiverLogs: () => request("/caregiver/logs"),
};

export function setToken(token) {
  if (token) localStorage.setItem("medimate_token", token);
  else localStorage.removeItem("medimate_token");
}

export function hasToken() {
  return !!getToken();
}
