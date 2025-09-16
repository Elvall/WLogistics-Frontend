import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { connectSocket } from "./lib/socket";

// --- Utility helpers (chỉ dùng client) ---
const nowISO = () => new Date().toISOString();
const fmtTime = (iso) => new Date(iso).toLocaleString();
const STATUS_FLOW = [
  "Created",
  "Assigned",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];
const TENANTS = [
  { id: "t_wis", name: "Wisdom Logistics (HQ)", color: "#2563eb" },
  { id: "t_cafe", name: "Cafe Hòa Bình Co.", color: "#059669" },
  { id: "t_fnb", name: "F&B Express VN", color: "#d97706" },
];

// --- UI atoms (giữ nguyên) ---
const Badge = ({ children, color = "#111827" }) => (
  <span
    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
    style={{ background: `${color}12`, color }}
  >
    {children}
  </span>
);
const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-2xl bg-black/5 px-3 py-1 text-xs text-gray-700">
    {children}
  </span>
);
const StatusDot = ({ idx }) => (
  <span
    className="inline-block h-2.5 w-2.5 rounded-full mr-1"
    style={{
      background: [
        "#6b7280",
        "#0ea5e9",
        "#a855f7",
        "#2563eb",
        "#f59e0b",
        "#10b981",
      ][idx],
    }}
  />
);
const Step = ({ label, active, when }) => (
  <div className="flex items-start gap-3">
    <div
      className={`mt-1 h-3 w-3 rounded-full ${
        active ? "bg-blue-600" : "bg-gray-300"
      }`}
    />
    <div>
      <div className={`text-sm ${active ? "text-gray-900" : "text-gray-500"}`}>
        {label}
      </div>
      {when && <div className="text-xs text-gray-400">{fmtTime(when)}</div>}
    </div>
  </div>
);
function SectionCard({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-base font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>
        <div>{right}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const [tenantId, setTenantId] = useState(TENANTS[0].id);
  const [tab, setTab] = useState("customer"); // customer | admin | driver
  const tenant = TENANTS.find((t) => t.id === tenantId);

  // server state
  const [orders, setOrders] = useState([]);
  const socketRef = useRef(null);

  // load initial list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listOrders(tenantId);
        if (!cancelled) setOrders(list);
      } catch (e) {
        console.error("Load orders failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // connect socket per-tenant
  useEffect(() => {
    if (socketRef.current) socketRef.current.close();
    const s = connectSocket(tenantId);
    socketRef.current = s;

    // realtime events từ backend
    s.on("order.created", async () => {
      const list = await api.listOrders(tenantId);
      setOrders(list);
    });
    s.on("order.updated", async () => {
      const list = await api.listOrders(tenantId);
      setOrders(list);
    });
    s.on("order.deleted", async () => {
      const list = await api.listOrders(tenantId);
      setOrders(list);
    });

    return () => {
      s.off("order.created");
      s.off("order.updated");
      s.off("order.deleted");
      s.close();
    };
  }, [tenantId]);

  // helpers
  const byCode = (code) =>
    orders.find(
      (o) => (o.code || "").toUpperCase() === (code || "").toUpperCase()
    );

  const tOrders = useMemo(
    () => orders.filter((o) => o.tenantId === tenantId),
    [orders, tenantId]
  );

  // --- Customer: Track & Create order ---
  const [trackCode, setTrackCode] = useState("");
  const tracked = useMemo(() => byCode(trackCode), [trackCode, orders]);

  const [newOrder, setNewOrder] = useState({
    name: "",
    phone: "",
    from: "Kho Tân Bình, HCM",
    to: "Q.1, HCM",
    items: "Thùng sữa 24 hộp",
  });

  const createOrder = async () => {
    if (!newOrder.name || !newOrder.phone)
      return alert("Vui lòng nhập Tên & SĐT khách hàng");
    try {
      const created = await api.createOrder({
        tenantId,
        customer: { name: newOrder.name, phone: newOrder.phone },
        from: newOrder.from,
        to: newOrder.to,
        items: [{ name: newOrder.items, qty: 1 }],
        price: 45000,
      });
      setOrders((prev) => [created, ...prev]);
      setTrackCode(created.code);
      setTab("admin");
    } catch (e) {
      alert("Tạo đơn thất bại: " + e.message);
    }
  };

  // --- Admin actions ---
  const advanceStatus = async (order) => {
    try {
      const updated = await api.advanceStatus(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      alert("Advance failed: " + e.message);
    }
  };
  const assignDriver = async (order) => {
    try {
      const updated = await api.assignDriver(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      alert("Assign failed: " + e.message);
    }
  };
  const remove = async (id) => {
    try {
      await api.deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  // --- Driver view ---
  const [driverName, setDriverName] = useState("");
  const driverOrders = useMemo(
    () =>
      tOrders.filter(
        (o) =>
          o.driver &&
          o.driver.name.toLowerCase().includes(driverName.trim().toLowerCase())
      ),
    [tOrders, driverName]
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-gray-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-blue-600 text-white grid place-items-center font-bold">
              W
            </div>
            <div>
              <div className="text-lg font-bold leading-5">WLogistics</div>
              <div className="text-xs text-gray-500 -mt-0.5">
                Multi-tenant Delivery Demo
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              {TENANTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <nav className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
              {[
                { id: "customer", label: "Customer" },
                { id: "admin", label: "Admin" },
                { id: "driver", label: "Driver" },
              ].map((x) => (
                <button
                  key={x.id}
                  onClick={() => setTab(x.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    tab === x.id
                      ? "bg-white shadow"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Wisdom Logistics — Live Web Demo
            </h1>
            <p className="text-gray-600 text-sm max-w-2xl">
              A practical preview you can show customers: track orders, create
              shipments, assign drivers, and observe real-time status flow.
            </p>
            <div className="mt-2 flex gap-2">
              <Pill>Multi-tenant</Pill>
              <Pill>Role-based views</Pill>
              <Pill>Realtime Socket.IO</Pill>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Active tenant</div>
            <div className="text-sm font-semibold flex items-center justify-end gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: tenant.color }}
              />
              {tenant.name}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 pb-16">
        {/* CUSTOMER */}
        {tab === "customer" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SectionCard
              title="Track your order"
              subtitle="Nhập mã đơn WL-xxxxx để theo dõi"
            >
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="e.g., WL-10001"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                />
                <button
                  onClick={() => setTrackCode(trackCode.trim())}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Track
                </button>
              </div>
              {tracked ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">
                      {tracked.code}
                    </div>
                    <Badge color="#2563eb">{tracked.status}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    From <span className="font-medium">{tracked.from}</span> →
                    To <span className="font-medium">{tracked.to}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    ETA: {fmtTime(tracked.eta)}
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SectionCard title="Timeline">
                      <div className="space-y-3">
                        {STATUS_FLOW.map((s) => {
                          const event = (tracked.timeline || []).find(
                            (t) => t.status === s
                          );
                          return (
                            <Step
                              key={s}
                              label={s}
                              active={!!event}
                              when={event?.at}
                            />
                          );
                        })}
                      </div>
                    </SectionCard>
                    <SectionCard title="Order details">
                      <div className="text-sm">
                        <div className="mb-2">
                          <span className="text-gray-500">Customer: </span>
                          {tracked.customer?.name} — {tracked.customer?.phone}
                        </div>
                        <ul className="list-disc ml-5 space-y-1">
                          {(tracked.items || []).map((it, i) => (
                            <li key={i}>
                              {it.name} × {it.qty}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </SectionCard>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-500">
                  No order found. Try one of these:{" "}
                  {orders.slice(0, 3).map((o) => (
                    <code
                      key={o.id}
                      className="mx-1 rounded bg-gray-100 px-1.5 py-0.5"
                    >
                      {o.code}
                    </code>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Create order" subtitle="Dùng cho demo">
              <div className="space-y-2 text-sm">
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Customer name"
                  value={newOrder.name}
                  onChange={(e) =>
                    setNewOrder((v) => ({ ...v, name: e.target.value }))
                  }
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Phone"
                  value={newOrder.phone}
                  onChange={(e) =>
                    setNewOrder((v) => ({ ...v, phone: e.target.value }))
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="rounded-xl border px-3 py-2"
                    placeholder="From"
                    value={newOrder.from}
                    onChange={(e) =>
                      setNewOrder((v) => ({ ...v, from: e.target.value }))
                    }
                  />
                  <input
                    className="rounded-xl border px-3 py-2"
                    placeholder="To"
                    value={newOrder.to}
                    onChange={(e) =>
                      setNewOrder((v) => ({ ...v, to: e.target.value }))
                    }
                  />
                </div>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Item(s)"
                  value={newOrder.items}
                  onChange={(e) =>
                    setNewOrder((v) => ({ ...v, items: e.target.value }))
                  }
                />
                <button
                  onClick={createOrder}
                  className="mt-1 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Create & show in Admin
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="Why customers love it"
              subtitle="Key selling points"
            >
              <ul className="text-sm list-disc ml-5 space-y-2 text-gray-700">
                <li>Real-time tracking with clear milestones (Socket.IO)</li>
                <li>Multi-tenant separation by rooms</li>
                <li>Fast to demo; real backend API</li>
              </ul>
              <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                Tip: Tạo đơn bên trái, rồi chuyển sang <b>Admin</b> để
                Assign/Advance.
              </div>
            </SectionCard>
          </div>
        )}

        {/* ADMIN */}
        {tab === "admin" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SectionCard
                title="Orders"
                subtitle={`Tenant: ${tenant.name}`}
                right={
                  <span className="text-xs text-gray-500">
                    {tOrders.length} orders
                  </span>
                }
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2 pr-2">Code</th>
                        <th className="py-2 pr-2">Customer</th>
                        <th className="py-2 pr-2">From → To</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2 pr-2">Driver</th>
                        <th className="py-2 pr-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tOrders.map((o) => (
                        <tr key={o.id} className="border-t">
                          <td className="py-2 pr-2 font-medium">{o.code}</td>
                          <td className="py-2 pr-2">
                            {o.customer?.name}
                            <div className="text-xs text-gray-500">
                              {o.customer?.phone}
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            {o.from} → {o.to}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge color="#111827">
                              <StatusDot idx={STATUS_FLOW.indexOf(o.status)} />
                              {o.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-2">
                            {o.driver ? (
                              `${o.driver.name} (${o.driver.plate})`
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-0 text-right space-x-1">
                            {!o.driver && (
                              <button
                                onClick={() => assignDriver(o)}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Assign
                              </button>
                            )}
                            {o.status !== "Delivered" && (
                              <button
                                onClick={() => advanceStatus(o)}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Advance
                              </button>
                            )}
                            <button
                              onClick={() => remove(o.id)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
            <div className="lg:col-span-1">
              <SectionCard title="KPI snapshot" subtitle="Last 24h">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-2xl font-bold">
                      {tOrders.filter((o) => o.status === "Delivered").length}
                    </div>
                    <div className="text-xs text-gray-500">Delivered</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-2xl font-bold">{tOrders.length}</div>
                    <div className="text-xs text-gray-500">Active orders</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-2xl font-bold">
                      {
                        tOrders.filter((o) => o.status === "Out for Delivery")
                          .length
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      Out for delivery
                    </div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-2xl font-bold">
                      {Math.round(
                        (tOrders.reduce(
                          (acc, o) => acc + (o.status !== "Delivered" ? 1 : 0),
                          0
                        ) /
                          Math.max(1, tOrders.length)) *
                          100
                      )}
                      %
                    </div>
                    <div className="text-xs text-gray-500">On-going</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  KPIs from live orders (server). In prod, add SLA, on-time %,
                  etc.
                </div>

                <div className="mt-6">
                  <SectionCard
                    title="Quick create (Admin)"
                    subtitle="Bypass customer form"
                  >
                    <button
                      onClick={async () => {
                        try {
                          const created = await api.createOrder({
                            tenantId,
                            customer: {
                              name: "Walk-in Customer",
                              phone: "0900000000",
                            },
                            from: "Kho Quận 7",
                            to: "Q.1, HCM",
                            items: [{ name: "Hộp hàng lẻ", qty: 1 }],
                            price: 30000,
                          });
                          setOrders((prev) => [created, ...prev]);
                        } catch (e) {
                          alert("Create failed: " + e.message);
                        }
                      }}
                      className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Add order
                    </button>
                  </SectionCard>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* DRIVER */}
        {tab === "driver" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SectionCard
              title="Driver login (mock)"
              subtitle="Gõ tên tài xế để xem queue"
            >
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Tên tài xế (vd: An, Bình, Cường...)"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
                <button
                  onClick={() => setDriverName(driverName.trim())}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Show
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Tip: Assign a driver from <b>Admin</b> first.
              </div>
            </SectionCard>

            <div className="md:col-span-2">
              <SectionCard title="My queue">
                {driverOrders.length === 0 ? (
                  <div className="text-sm text-gray-500">No jobs yet.</div>
                ) : (
                  <div className="space-y-3">
                    {driverOrders.map((o) => (
                      <div key={o.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{o.code}</div>
                          <Badge color="#0ea5e9">{o.status}</Badge>
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          Pickup: <b>{o.from}</b> → Dropoff: <b>{o.to}</b>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">
                              Progress
                            </div>
                            <div className="h-2 w-full rounded bg-gray-200">
                              <div
                                className="h-2 rounded bg-emerald-500"
                                style={{
                                  width: `${
                                    (STATUS_FLOW.indexOf(o.status) /
                                      (STATUS_FLOW.length - 1)) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            ETA: {fmtTime(o.eta)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-gray-500 flex flex-wrap items-center gap-2 justify-between">
          <div>
            © {new Date().getFullYear()} Wisdom Logistics Demo — Realtime by
            Socket.IO.
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">
              Made for quick customer previews.
            </span>
            <span className="inline-flex items-center gap-1">
              Status flow:
              {STATUS_FLOW.map((s, i) => (
                <span key={s} className="ml-2">
                  <StatusDot idx={i} />
                  {s}
                </span>
              ))}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
