# RAGE OPTIMIZER 🔥

> The ultimate Discord bot and web dashboard for gaming communities, esports servers, and optimization shops.

![Bot Status](https://img.shields.io/badge/Bot-Online-brightgreen)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-Admin_SDK-FFCA28)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)

## Features

- 🤖 **Discord Bot** — 9 slash commands (ban, kick, timeout, warn, warns, purge, backup, ticketpanel, poll)
- 🛡️ **Anti-Nuke Security** — Prevent mass channel/role deletion by compromised accounts
- 🎫 **Ticket System** — Multi-category (Optimization, Sensi, Shop, Support, Scam) with HTML transcripts
- 📊 **Interactive Polls** — Button-based voting with real-time progress bars
- 🌐 **Web Dashboard** — React frontend with real-time Socket.IO and SSE data streaming
- 🔐 **Discord OAuth2** — Login with Discord, guild management
- 📦 **Server Backups** — Snapshot and restore channel/role configurations
- 🔴 **Live Stats** — Real-time bot ping, uptime, member counts via SSE

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot | Discord.js v14 |
| Backend | Node.js + Express + Socket.IO |
| Database | Firebase Firestore + RTDB |
| Storage | Supabase Storage |
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth | Discord OAuth2 + JWT + Firebase Auth |

## Getting Started

### Prerequisites
- Node.js 18+
- A Discord Application with Bot token ([discord.com/developers](https://discord.com/developers))
- Firebase project with service account
- Supabase project

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in your credentials in .env
node src/index.js
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Fill in your credentials in .env
npm run dev
```

### Supabase Schema

Run `backend/supabase_schema.sql` in your Supabase SQL Editor to create all required tables.

### Bot Invite Link

Replace `YOUR_CLIENT_ID` with your Discord Application Client ID:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

## Environment Variables

Copy `.env.example` to `.env` in both `backend/` and `frontend/` directories and fill in your credentials.

> ⚠️ **Never commit `.env` files or Firebase service account JSON files to git.**

## Project Structure

```
rage-optimizer/
├── backend/
│   ├── src/
│   │   ├── bot/
│   │   │   ├── commands/      # Slash commands (moderation, security, tickets, utility)
│   │   │   ├── events/        # Discord event handlers
│   │   │   └── client.js      # Bot initialization
│   │   ├── config/            # Firebase & Supabase config
│   │   ├── middleware/        # Auth middleware
│   │   ├── routes/            # Express API routes
│   │   ├── services/          # DB, storage, socket services
│   │   └── index.js           # Entry point
│   ├── supabase_schema.sql    # Database schema
│   ├── test_bot_commands.js   # Command test suite
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/        # Navbar, Sidebar, EmbedBuilder
    │   ├── context/           # AuthContext (Discord OAuth)
    │   ├── pages/             # Home, Dashboard, Servers, ModDash, etc.
    │   └── config/            # Firebase client config
    └── .env.example
```

## License

ISC © RAGE OPTIMIZER
