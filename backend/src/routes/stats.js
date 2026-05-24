const express = require('express');
const router = express.Router();
const { client: botClient } = require('../bot/client');
const dbService = require('../services/dbService');

// Helper: Build real-time stats object from live bot client
const buildStats = async () => {
  const isLive = botClient.user && botClient.user.id !== 'mock_bot_id';

  let guildsCount = 0;
  let membersCount = 0;

  if (isLive) {
    guildsCount = botClient.guilds.cache.size;
    membersCount = botClient.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
  } else {
    guildsCount = 425;
    membersCount = 189420;
  }

  const { ticketsCount, activeTicketsCount, warningsCount } = await dbService.getGlobalCounts();

  return {
    servers: guildsCount,
    members: membersCount,
    ticketsOpened: ticketsCount,
    activeTickets: activeTicketsCount,
    warningsIssued: warningsCount,
    uptimeSeconds: Math.floor(process.uptime()),
    ping: (isLive && botClient.ws) ? botClient.ws.ping : 42,
    status: isLive ? 'Online' : 'Mock',
    botTag: isLive ? botClient.user.tag : 'RAGE OPTIMIZER [MOCK]#0000',
    botId: isLive ? botClient.user.id : 'mock_bot_id',
    botAvatar: isLive ? botClient.user.displayAvatarURL({ size: 128 }) : null,
    isLive
  };
};

// GET /api/stats/global - Public statistics endpoint
router.get('/global', async (req, res) => {
  try {
    const stats = await buildStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Stats API Error]', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

// GET /api/stats/live - SSE endpoint for real-time stat streaming
router.get('/live', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendStats = async () => {
    try {
      const stats = await buildStats();
      res.write(`data: ${JSON.stringify(stats)}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: 'stat error' })}\n\n`);
    }
  };

  // Send initial data immediately
  await sendStats();

  // Stream every 10 seconds
  const interval = setInterval(sendStats, 10000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

module.exports = router;
