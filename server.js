// // server.js
// import express from "express";
// import http from "http";
// import cors from "cors";
// import { Server } from "socket.io";

// const app = express();
// app.use(express.json());

// // CORS cho REST
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "https://w-logistics-frontend.vercel.app/",
//     ],
//     methods: ["GET", "POST", "PATCH", "DELETE"],
//   })
// );

// app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// // HTTP + Socket.IO
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:5173",
//       "https://w-logistics-frontend.vercel.app/",
//     ],
//     methods: ["GET", "POST"],
//   },
// });

// io.on("connection", (socket) => {
//   socket.on("join", ({ tenantId }) => tenantId && socket.join(tenantId));
//   // ví dụ phát event:
//   // io.to(tenantId).emit("order.updated", payload);
// });

// const PORT = process.env.PORT || 8080;
// server.listen(PORT, "0.0.0.0", () => console.log("BE on", PORT));
