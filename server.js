import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());
app.use(cors({ origin: true }));

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });

const STATUS_FLOW = [
  "Created",
  "Assigned",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];
const TENANTS = ["t_wis", "t_cafe", "t_fnb"];
let ORDERS = [];

// seed demo orders
for (let i = 0; i < 4; i++) {
  ORDERS.push({
    id: uuidv4(),
    code: `WL-${10000 + i}`,
    tenantId: TENANTS[i % TENANTS.length],
    customer: { name: ["Lan", "Minh", "Huy", "Trang"][i], phone: "0900000000" },
    from: "Kho Tân Bình, HCM",
    to: ["Q.1", "Thủ Đức", "Hà Đông", "Cầu Giấy"][i],
    items: [{ name: "Thùng hàng demo", qty: 1 }],
    status: STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 2)],
    timeline: [{ status: "Created", at: new Date().toISOString() }],
    driver: null,
    price: 30000,
    createdAt: new Date().toISOString(),
    eta: new Date(Date.now() + 4 * 3600_000).toISOString(),
  });
}

io.on("connection", (socket) => {
  socket.on("join", ({ tenantId }) => {
    if (TENANTS.includes(tenantId)) socket.join(tenantId);
  });
});

function broadcast(tenantId, event, payload) {
  io.to(tenantId).emit(event, payload);
}

app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/api/orders", (req, res) => {
  const { tenantId } = req.query;
  const list = tenantId
    ? ORDERS.filter((o) => o.tenantId === tenantId)
    : ORDERS;
  res.json(list);
});

app.post("/api/orders", (req, res) => {
  const b = req.body || {};
  const order = {
    id: uuidv4(),
    code: b.code || `WL-${Math.floor(10000 + Math.random() * 90000)}`,
    tenantId: b.tenantId,
    customer: b.customer,
    from: b.from,
    to: b.to,
    items: b.items || [],
    status: "Created",
    timeline: [
      { status: "Created", at: new Date().toISOString(), note: "API created" },
    ],
    driver: null,
    price: b.price || 0,
    createdAt: new Date().toISOString(),
    eta: new Date(Date.now() + 4 * 3600_000).toISOString(),
  };
  ORDERS.unshift(order);
  broadcast(order.tenantId, "order.created", { id: order.id });
  res.json(order);
});

app.patch("/api/orders/:id/status", (req, res) => {
  const o = ORDERS.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: "Not found" });
  const idx = STATUS_FLOW.indexOf(o.status);
  if (idx < STATUS_FLOW.length - 1) {
    o.status = STATUS_FLOW[idx + 1];
    o.timeline.push({ status: o.status, at: new Date().toISOString() });
  }
  broadcast(o.tenantId, "order.updated", { id: o.id });
  res.json(o);
});

app.patch("/api/orders/:id/assign", (req, res) => {
  const o = ORDERS.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: "Not found" });
  if (!o.driver) o.driver = { id: uuidv4(), name: "An", plate: "59A-1234" };
  o.status = "Assigned";
  o.timeline.push({
    status: "Assigned",
    at: new Date().toISOString(),
    note: "Driver assigned",
  });
  broadcast(o.tenantId, "order.updated", { id: o.id });
  res.json(o);
});

app.delete("/api/orders/:id", (req, res) => {
  const idx = ORDERS.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const [o] = ORDERS.splice(idx, 1);
  broadcast(o.tenantId, "order.deleted", { id: o.id });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => console.log("WLogistics backend on :" + PORT));
