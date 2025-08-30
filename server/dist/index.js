"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [process.env.CLIENT_URL || "http://localhost:5173"],
        credentials: false,
    },
});
const catchSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true, index: true },
    fish: { type: String, required: true },
    weight: { type: Number, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
const CatchModel = mongoose_1.default.model("Catch", catchSchema);
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
function randomFish() {
    const fish = fishes[Math.floor(Math.random() * fishes.length)];
    const weight = Number((Math.random() * 10 + 0.3).toFixed(2));
    return { fish, weight };
}
io.on("connection", (socket) => {
    socket.on("chat:join", ({ username }) => {
        io.emit("chat:message", { system: true, username: "system", content: `${username} 님이 입장했습니다.` });
    });
    socket.on("chat:message", async (msg) => {
        const trimmed = msg.content.trim();
        if (trimmed === "낚시하기") {
            const { fish, weight } = randomFish();
            await CatchModel.create({ username: msg.username, fish, weight });
            io.emit("chat:message", {
                system: true,
                username: "system",
                content: `${msg.username} 님이 ${fish} (${weight}kg)를 낚았습니다!`,
            });
        }
        else {
            io.emit("chat:message", msg);
        }
    });
});
// Leaderboard API
app.get("/api/leaderboard", async (_req, res) => {
    const rows = await CatchModel.aggregate([
        { $group: { _id: "$username", total: { $sum: 1 } } },
        { $project: { _id: 0, username: "$_id", total: 1 } },
        { $sort: { total: -1 } },
        { $limit: 20 },
    ]);
    res.json(rows);
});
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fishing_game";
const PORT = Number(process.env.PORT || 4000);
async function bootstrap() {
    await mongoose_1.default.connect(MONGO_URI);
    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
