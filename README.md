# 🎲 Game Theory Arena

A real-time multiplayer **Prisoner's Dilemma** game with user accounts, friends, and leaderboards.

## Features

- ⚔️ **Real-time Multiplayer** — Play 5-round Prisoner's Dilemma matches via WebSockets
- 🔐 **User Accounts** — Register, login, persistent sessions
- 👤 **Profiles** — Track games, wins, losses, draws, score, win rate
- 🏆 **Leaderboards** — Global and friends-only rankings
- 👫 **Friends System** — Add friends, accept requests, compare stats
- 🎨 **Premium UI** — Glassmorphism design with smooth animations

## Quick Start

```bash
npm install
npm start
```

Open **http://localhost:3000** in two browser tabs, register two users, and play!

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Database:** SQLite (better-sqlite3)
- **Auth:** bcrypt + express-session
- **Frontend:** Vanilla HTML/CSS/JS
