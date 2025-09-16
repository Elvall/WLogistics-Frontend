// src/lib/api.js
const BASE = window.__ENV__?.API_BASE_URL || "";

async function j(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

// ---- Orders API (khớp server Express đã đưa) ----
export const api = {
  health: () => j("GET", "/api/health"),
  listOrders: (tenantId) =>
    j(
      "GET",
      `/api/orders${
        tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""
      }`
    ),
  createOrder: (payload) => j("POST", "/api/orders", payload),
  advanceStatus: (id) => j("PATCH", `/api/orders/${id}/status`),
  assignDriver: (id) => j("PATCH", `/api/orders/${id}/assign`),
  deleteOrder: (id) => j("DELETE", `/api/orders/${id}`),
};
