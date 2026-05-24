require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { admin } = require('./config/firebase');
const { startBot } = require('./bot/client');

const app = express();
const server = http.createServer(app);

// CORS Config
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};
app.use(cors(corsOptions));
app.use(express.json());

// SSE-specific headers to support EventSource from frontend
app.use('/api/stats/live', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// Socket.io Setup
const io = new Server(server, {
  cors: corsOptions
});
const socketService = require('./services/socketService');
socketService.init(io);

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Join Guild room for targeted updates
  socket.on('joinGuild', (guildId) => {
    if (guildId) {
      socket.join(guildId);
      console.log(`[Socket] Client ${socket.id} joined room: ${guildId}`);
    }
  });

  socket.on('leaveGuild', (guildId) => {
    if (guildId) {
      socket.leave(guildId);
      console.log(`[Socket] Client ${socket.id} left room: ${guildId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Share socket instance across routers
app.set('socketio', io);

// Serve local storage mock files
const path = require('path');
app.use('/api/storage/mock', express.static(path.join(__dirname, '../storage_mock')));

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/guilds', require('./routes/guilds'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/security', require('./routes/security'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/storage', require('./routes/storage'));

// Root Status check
app.get('/', (req, res) => {
  res.json({
    name: 'RAGE OPTIMIZER Backend API',
    status: 'Online',
    version: '1.0.0',
    timestamp: new Date()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Discord Bot
startBot();

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Server] API and Socket.IO server running on port ${PORT}`);
});
