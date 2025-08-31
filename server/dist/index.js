"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const google_auth_library_1 = require("google-auth-library");
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
    userId: { type: String, index: true },
    displayName: { type: String },
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
// Google auth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID) : null;
async function verifyGoogleIdToken(idToken) {
    try {
        if (!idToken || !googleClient)
            return null;
        const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub)
            return null;
        const userId = payload.sub;
        const displayName = payload.name || payload.email || "사용자";
        return { userId, displayName };
    }
    catch {
        return null;
    }
}
io.on("connection", (socket) => {
    socket.on("chat:join", async ({ username, idToken }) => {
        const info = await verifyGoogleIdToken(idToken);
        const effectiveName = info?.displayName || username;
        socket.data.userId = info?.userId;
        socket.data.displayName = effectiveName;
        io.emit("chat:message", { system: true, username: "system", content: `${effectiveName} 님이 입장했습니다.` });
    });
    socket.on("chat:message", async (msg) => {
        const trimmed = msg.content.trim();
        if (trimmed === "낚시하기") {
            const { fish, weight } = randomFish();
            await CatchModel.create({
                username: msg.username,
                fish,
                weight,
                userId: socket.data.userId,
                displayName: socket.data.displayName,
            });
            io.emit("chat:message", {
                system: true,
                username: "system",
                content: `${socket.data.displayName || msg.username} 님이 ${fish} (${weight}kg)를 낚았습니다!`,
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
        {
            $group: {
                _id: { $ifNull: ["$userId", "$username"] },
                username: { $first: { $ifNull: ["$displayName", "$username"] } },
                total: { $sum: 1 },
            },
        },
        { $project: { _id: 0, username: "$username", total: 1 } },
        { $sort: { total: -1 } },
        { $limit: 20 },
    ]);
    res.json(rows);
});
// Static files (serve built client from dist/static)
const staticDir = path_1.default.join(__dirname, "static");
app.use(express_1.default.static(staticDir));
// SPA fallback (exclude API and socket paths)
app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path_1.default.join(staticDir, "index.html"));
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
