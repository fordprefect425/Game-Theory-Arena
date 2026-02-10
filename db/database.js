const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ── Ensure data directory exists ──────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'game.db');
const db = new Database(DB_PATH);

// ── Enable WAL mode for better concurrency ───────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Initialize schema ────────────────────────────────────────────────
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// ═══════════════════════════════════════════════════════════════════════
// USER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

const stmts = {
    insertUser: db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)'),
    findByUsername: db.prepare('SELECT id, username, created_at FROM users WHERE username = ?'),
    findByUsernameAuth: db.prepare('SELECT * FROM users WHERE username = ?'),
    findById: db.prepare('SELECT id, username, created_at FROM users WHERE id = ?'),

    insertMatch: db.prepare(`INSERT INTO matches (game_type, player1_id, player2_id, p1_score, p2_score, winner_id)
                                 VALUES (?, ?, ?, ?, ?, ?)`),

    playerStats: db.prepare(`
    SELECT
      COUNT(*)                                                                       AS games_played,
      COALESCE(SUM(CASE WHEN winner_id = $uid THEN 1 ELSE 0 END), 0)                AS wins,
      COALESCE(SUM(CASE WHEN winner_id IS NOT NULL AND winner_id != $uid THEN 1 ELSE 0 END), 0) AS losses,
      COALESCE(SUM(CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END), 0)               AS draws,
      COALESCE(SUM(CASE WHEN player1_id = $uid THEN p1_score ELSE p2_score END), 0) AS total_score
    FROM matches
    WHERE player1_id = $uid OR player2_id = $uid
  `),

    // Friends
    insertFriend: db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)'),
    acceptFriend: db.prepare("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?"),
    getFriends: db.prepare(`
    SELECT u.id, u.username, f.status, f.created_at,
           CASE WHEN f.user_id = $uid THEN 'outgoing' ELSE 'incoming' END AS direction
    FROM friends f
    JOIN users u ON u.id = CASE WHEN f.user_id = $uid THEN f.friend_id ELSE f.user_id END
    WHERE f.user_id = $uid OR f.friend_id = $uid
  `),
    checkFriendship: db.prepare(`
    SELECT * FROM friends
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `),
};

// ── User helpers ──────────────────────────────────────────────────────
function createUser(id, username, passwordHash) {
    stmts.insertUser.run(id, username, passwordHash);
    return { id, username };
}

function findUserByUsername(username) {
    return stmts.findByUsername.get(username) || null;
}

function findUserByUsernameAuth(username) {
    return stmts.findByUsernameAuth.get(username) || null;
}

function findUserById(id) {
    return stmts.findById.get(id) || null;
}

// ── Match helpers ─────────────────────────────────────────────────────
function recordMatch(gameType, p1Id, p2Id, p1Score, p2Score, winnerId) {
    return stmts.insertMatch.run(gameType, p1Id, p2Id, p1Score, p2Score, winnerId);
}

function getPlayerStats(userId) {
    const row = stmts.playerStats.get({ uid: userId });
    return row || { games_played: 0, wins: 0, losses: 0, draws: 0, total_score: 0 };
}

// ── Friend helpers ────────────────────────────────────────────────────
function addFriend(userId, friendId) {
    stmts.insertFriend.run(userId, friendId, 'pending');
}

function acceptFriend(requesterId, accepterId) {
    // The original request was: requester → accepter (status: pending)
    // We update that row AND create the reverse row as accepted
    stmts.acceptFriend.run(requesterId, accepterId);
    stmts.insertFriend.run(accepterId, requesterId, 'accepted');
}

function getFriends(userId) {
    return stmts.getFriends.all({ uid: userId });
}

function checkFriendship(userA, userB) {
    return stmts.checkFriendship.get(userA, userB, userB, userA) || null;
}

function getFriendIds(userId) {
    const friends = getFriends(userId);
    return friends.filter((f) => f.status === 'accepted').map((f) => f.id);
}

// ── Leaderboard ───────────────────────────────────────────────────────
function getLeaderboard(userId) {
    const friendIds = getFriendIds(userId);
    const allIds = [userId, ...friendIds];

    const rows = allIds.map((id) => {
        const user = findUserById(id);
        const stats = getPlayerStats(id);
        return {
            id,
            username: user ? user.username : 'Unknown',
            ...stats,
        };
    });

    // Sort by wins desc, then total_score desc
    rows.sort((a, b) => b.wins - a.wins || b.total_score - a.total_score);

    return rows.map((row, i) => ({ rank: i + 1, ...row }));
}

module.exports = {
    createUser,
    findUserByUsername,
    findUserByUsernameAuth,
    findUserById,
    recordMatch,
    getPlayerStats,
    addFriend,
    acceptFriend,
    getFriends,
    checkFriendship,
    getLeaderboard,
};
