import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";
//Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

//initialize Socket.io server
const io = new Server(server, {
  cors: {
    origin: "*",
    // methods:["GET","POST","PUT"]
  },
});

//store online users
export const userSocketMap = {}; //{userId:socketId}

//Socket.io connection event
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User Connected", userId);

  if (userId) userSocketMap[userId] = socket.id;

  //emit online users to all connected users
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("User Disconnected", userId);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

//Middleware setup
app.use(express.json({ limit: "4mb" }));

// Configure CORS to allow the frontend origin. Set CLIENT_ORIGIN in Vercel to your frontend URL.
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  process.env.VITE_FRONTEND_URL ||
  "http://localhost:5173";
console.log("Configured client origin for CORS:", CLIENT_ORIGIN);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) return callback(null, true);
      // Allow configured origin or allow all in development
      if (CLIENT_ORIGIN === "*" || origin === CLIENT_ORIGIN)
        return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "token"],
    credentials: true,
  })
);

// Handle preflight requests quickly
app.options("*", (req, res) => res.sendStatus(200));

//Routes setup
app.use("/api/status", (req, res) => res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

//Connect to MongoDB
await connectDB();

export { io };

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log("Server is running on PORT:" + PORT));
}
//export server for vercel deployment
export default server;
