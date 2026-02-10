const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const PrisonersDilemma = require('./game/PrisonersDilemma');
const db = require('./db/database');

const app = express();
const server = http.createServer(app);

// ── Session middleware ────────────────────────────────────────────────
const sessionMiddleware = session({
    secret: 'game-theory-arena-secret-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
});

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// ── Socket.IO with session sharing ───────────────────────────────────
const io = new Server(server);

io.engine.use(sessionMiddleware);

// ═══════════════════════════════════════════════════════════════════════
// REST API — AUTH
// ═══════════════════════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const trimmed = username.trim();
        if (trimmed.length < 2 || trimmed.length > 20) {
            return res.status(400).json({ error: 'Username must be 2-20 characters' });
        }
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }
        const existing = db.findUserByUsername(trimmed);
        if (existing) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const hash = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const user = db.createUser(id, trimmed, hash);

        req.session.userId = id;
        req.session.username = trimmed;
        res.status(201).json({ id, username: trimmed });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = db.findUserByUsernameAuth(username.trim());
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ id: user.id, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
});

// ── Auth guard middleware ─────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    next();
}

// ═══════════════════════════════════════════════════════════════════════
// REST API — PROFILE & STATS
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/me', requireAuth, (req, res) => {
    const user = db.findUserById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const stats = db.getPlayerStats(req.session.userId);
    res.json({ ...user, stats });
});

// ═══════════════════════════════════════════════════════════════════════
// REST API — FRIENDS
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/friends', requireAuth, (req, res) => {
    const friends = db.getFriends(req.session.userId);
    res.json(friends);
});

app.post('/api/friends/add', requireAuth, (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const target = db.findUserByUsername(username.trim());
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.session.userId) {
        return res.status(400).json({ error: "You can't add yourself" });
    }

    const existing = db.checkFriendship(req.session.userId, target.id);
    if (existing) {
        return res.status(409).json({ error: 'Friend request already exists' });
    }

    db.addFriend(req.session.userId, target.id);
    res.status(201).json({ ok: true, message: `Friend request sent to ${target.username}` });
});

app.post('/api/friends/accept', requireAuth, (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    db.acceptFriend(userId, req.session.userId);
    res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════
// REST API — LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/leaderboard', requireAuth, (req, res) => {
    const lb = db.getLeaderboard(req.session.userId);
    res.json(lb);
});

// ═══════════════════════════════════════════════════════════════════════
// SOCKET.IO — GAME
// ═══════════════════════════════════════════════════════════════════════

let waitingPlayer = null;
const rooms = {};
const playerRoom = {};

io.on('connection', (socket) => {
    // Read session
    const sess = socket.request.session || {};
    const userId = sess.userId || null;
    const userName = sess.username || null;

    console.log(`⚡ Connected: ${socket.id} (user: ${userName || 'guest'})`);

    // ── Join matchmaking queue ────────────────────────────────────────
    socket.on('join-queue', () => {
        if (!userId) {
            socket.emit('error-msg', 'Please log in first');
            return;
        }

        const name = userName;

        if (waitingPlayer && waitingPlayer.socketId !== socket.id && waitingPlayer.userId !== userId) {
            const roomId = `room_${Date.now()}`;
            const p1 = waitingPlayer;
            const p2 = { socketId: socket.id, userId, name };
            waitingPlayer = null;

            const game = new PrisonersDilemma(p1.userId, p2.userId);

            rooms[roomId] = {
                game,
                players: {
                    [p1.userId]: { socket: io.sockets.sockets.get(p1.socketId), name: p1.name, socketId: p1.socketId },
                    [p2.userId]: { socket, name: p2.name, socketId: p2.socketId },
                },
            };
            playerRoom[p1.socketId] = roomId;
            playerRoom[p2.socketId] = roomId;

            const p1Socket = io.sockets.sockets.get(p1.socketId);
            if (p1Socket) {
                p1Socket.emit('match-found', {
                    round: 1,
                    totalRounds: game.getTotalRounds(),
                    opponent: p2.name,
                });
            }
            socket.emit('match-found', {
                round: 1,
                totalRounds: game.getTotalRounds(),
                opponent: p1.name,
            });

            console.log(`🎮 Match: ${p1.name} vs ${p2.name}  (${roomId})`);
        } else {
            waitingPlayer = { socketId: socket.id, userId, name: userName };
            socket.emit('queue-joined');
            console.log(`🕐 Queued: ${userName}`);
        }
    });

    // ── Player makes a choice ────────────────────────────────────────
    socket.on('make-choice', (choice) => {
        if (!userId) return;
        const roomId = playerRoom[socket.id];
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const result = room.game.submitChoice(userId, choice);

        if (!result) {
            socket.emit('choice-received');
            return;
        }

        // Broadcast round result
        for (const [pid, pData] of Object.entries(room.players)) {
            const opponentId = pid === room.game.player1Id
                ? room.game.player2Id
                : room.game.player1Id;

            if (pData.socket && pData.socket.connected) {
                pData.socket.emit('round-result', {
                    round: result.round,
                    myChoice: result.choices[pid],
                    opponentChoice: result.choices[opponentId],
                    myPayoff: result.payoffs[pid],
                    opponentPayoff: result.payoffs[opponentId],
                    myScore: result.scores[pid],
                    opponentScore: result.scores[opponentId],
                });
            }
        }

        // Match finished → record to DB
        if (room.game.isFinished()) {
            const winner = room.game.getWinner();
            const scores = room.game.getScores();
            const winnerId = winner === 'draw' ? null : winner;

            try {
                db.recordMatch(
                    'prisoners_dilemma',
                    room.game.player1Id,
                    room.game.player2Id,
                    scores[room.game.player1Id],
                    scores[room.game.player2Id],
                    winnerId
                );
            } catch (err) {
                console.error('Failed to record match:', err);
            }

            for (const [pid, pData] of Object.entries(room.players)) {
                if (pData.socket && pData.socket.connected) {
                    let outcome;
                    if (winner === 'draw') outcome = 'draw';
                    else if (winner === pid) outcome = 'win';
                    else outcome = 'loss';

                    pData.socket.emit('match-result', {
                        outcome,
                        finalScores: scores,
                        history: room.game.getHistory(),
                    });
                }
            }
        }
    });

    // ── Rematch ──────────────────────────────────────────────────────
    socket.on('rematch', () => {
        if (!userId) return;
        const roomId = playerRoom[socket.id];
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        if (!room.rematchRequests) room.rematchRequests = new Set();
        room.rematchRequests.add(userId);

        const opponentId = Object.keys(room.players).find((id) => id !== userId);
        if (opponentId && room.players[opponentId].socket?.connected) {
            room.players[opponentId].socket.emit('rematch-requested');
        }

        if (room.rematchRequests.size === 2) {
            const pIds = Object.keys(room.players);
            room.game = new PrisonersDilemma(pIds[0], pIds[1]);
            room.rematchRequests = new Set();

            for (const [pid, pData] of Object.entries(room.players)) {
                const oppId = pIds.find((id) => id !== pid);
                if (pData.socket && pData.socket.connected) {
                    pData.socket.emit('match-found', {
                        round: 1,
                        totalRounds: room.game.getTotalRounds(),
                        opponent: room.players[oppId].name,
                    });
                }
            }
            console.log(`🔄 Rematch started in ${roomId}`);
        }
    });

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log(`💔 Disconnected: ${socket.id} (user: ${userName || 'guest'})`);

        if (waitingPlayer && waitingPlayer.socketId === socket.id) {
            waitingPlayer = null;
        }

        const roomId = playerRoom[socket.id];
        if (roomId && rooms[roomId]) {
            const room = rooms[roomId];
            for (const [pid, pData] of Object.entries(room.players)) {
                if (pData.socketId !== socket.id && pData.socket?.connected) {
                    pData.socket.emit('opponent-disconnected');
                }
                delete playerRoom[pData.socketId];
            }
            delete rooms[roomId];
        }
    });
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🎲 Game Theory Arena running at http://localhost:${PORT}\n`);
});
