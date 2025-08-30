import express, { Request, Response } from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL || "http://localhost:5173"],
    credentials: false,
  },
});

// Mongo Models
interface CatchDoc extends mongoose.Document {
  username: string;
  fish: string;
  weight: number;
  createdAt: Date;
}

const catchSchema = new mongoose.Schema<CatchDoc>(
  {
    username: { type: String, required: true, index: true },
    fish: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CatchModel = mongoose.model<CatchDoc>("Catch", catchSchema);

// Fish pool
const fishes = [
  "광어",
  "우럭",
  "도미",
  "참치",
  "연어",
  "고등어",
  "전어",
  "메기",
  "잉어",
  "송어",
];

function randomFish(): { fish: string; weight: number } {
  const fish = fishes[Math.floor(Math.random() * fishes.length)];
  const weight = Number((Math.random() * 10 + 0.3).toFixed(2));
  return { fish, weight };
}

io.on("connection", (socket) => {
  socket.on("chat:join", ({ username }) => {
    io.emit("chat:message", { system: true, username: "system", content: `${username} 님이 입장했습니다.` });
  });

  socket.on("chat:message", async (msg: { username: string; content: string }) => {
    const trimmed = msg.content.trim();
    if (trimmed === "낚시하기") {
      const { fish, weight } = randomFish();
      await CatchModel.create({ username: msg.username, fish, weight });
      io.emit("chat:message", {
        system: true,
        username: "system",
        content: `${msg.username} 님이 ${fish} (${weight}kg)를 낚았습니다!`,
      });
    } else {
      io.emit("chat:message", msg);
    }
  });
});

// Leaderboard API
app.get("/api/leaderboard", async (_req: Request, res: Response) => {
  const rows = await CatchModel.aggregate([
    { $group: { _id: "$username", total: { $sum: 1 } } },
    { $project: { _id: 0, username: "$_id", total: 1 } },
    { $sort: { total: -1 } },
    { $limit: 20 },
  ]);
  res.json(rows);
});

// 정적 파일 서빙 (Render 단일 서비스 배포 대비)
const staticDir = path.join(__dirname, "../static");
app.use(express.static(staticDir));

// SPA 폴백: API와 소켓 경로 제외
app.get(/^(?!\/api|\/socket\.io).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fishing_game";
const PORT = Number(process.env.PORT || 4000);

async function bootstrap() {
  await mongoose.connect(MONGO_URI);
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});


