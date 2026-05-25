const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../services/dbService');
const getBotClient = () => require('../bot/client').client;

// Middleware to verify if user has Administrator permissions in the target guild
const checkGuildAdmin = async (req, res, next) => {
  const { guildId } = req.params;
  const userId = req.user.userId;
  const isAdminUser = req.user.isAdmin; // Global bot developer admin bypass

  if (isAdminUser) return next();

  const liveGuild = getBotClient().guilds.cache.get(guildId);
  if (!liveGuild) {
    // If mock mode is active and it's a mock guild, allow
    const { isFirebaseMock } = require('../config/firebase');
    if (isFirebaseMock && guildId && guildId.startsWith('mock_')) {
      return next();
    }
    return res.status(404).json({ error: 'Server not found or bot is not present in this server.' });
  }

  try {
    const member = await liveGuild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.status(403).json({ error: 'Access Denied: You are not a member of this server.' });
    }

    const isOwner = liveGuild.ownerId === userId;
    const isServerAdmin = member.permissions.has('Administrator');

    if (!isOwner && !isServerAdmin) {
      return res.status(403).json({ error: 'Access Denied: You must be the Server Owner or have Administrator permission.' });
    }

    next();
  } catch (err) {
    console.error('[checkGuildAdmin Error]', err);
    res.status(500).json({ error: 'Internal validation error.' });
  }
};

// GET /api/guilds/:guildId/settings - Fetch settings + discord metadata (channels/roles)
router.get('/:guildId/settings', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId } = req.params;

  try {
    const settings = await dbService.getGuildSettings(guildId);

    // Try to retrieve channels and roles from Discord Client cache
    let channels = [];
    let roles = [];
    let name = "Rage Guild";

    const liveGuild = getBotClient().guilds.cache.get(guildId);
    if (liveGuild) {
      name = liveGuild.name;
      
      liveGuild.channels.cache.forEach(chan => {
        channels.push({
          id: chan.id,
          name: chan.name,
          type: chan.type
        });
      });

      liveGuild.roles.cache.forEach(role => {
        if (role.name !== '@everyone') {
          roles.push({
            id: role.id,
            name: role.name,
            color: role.color
          });
        }
      });
    } else {
      // Mock defaults in case guild isn't loaded (e.g. testing offline)
      name = guildId === 'mock_guild_id_1' ? "Rage Esports Tournament" : "Rage Optimizer Free Fire Hub";
      channels = [
        { id: 'channel_general', name: 'general', type: 0 },
        { id: 'channel_welcome', name: 'welcome', type: 0 },
        { id: 'channel_tickets', name: 'support-tickets', type: 0 },
        { id: 'channel_logs', name: 'rage-logs', type: 0 }
      ];
      roles = [
        { id: 'role_admin', name: 'Administrator', color: 16711740 },
        { id: 'role_staff', name: 'Staff Support', color: 3447003 },
        { id: 'role_member', name: 'Member', color: 0 }
      ];
    }

    res.json({
      guildName: name,
      settings,
      discordMetadata: {
        channels,
        roles
      }
    });

  } catch (error) {
    console.error('[Guild API Error]', error);
    res.status(500).json({ error: 'Failed to fetch guild settings' });
  }
});

// PUT /api/guilds/:guildId/settings - Update guild settings
router.put('/:guildId/settings', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const updateData = req.body;

  try {
    const settings = await dbService.updateGuildSettings(guildId, updateData);

    // Notify connected sockets of settings change in real-time
    const io = req.app.get('socketio');
    if (io) {
      io.to(guildId).emit('settingsUpdate', settings);
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('[Guild Update API Error]', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/guilds/:guildId/warnings - Fetch warnings list
router.get('/:guildId/warnings', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const warnings = await dbService.getWarnings(guildId);
    res.json(warnings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch warnings logs' });
  }
});

// POST /api/guilds/:guildId/warnings - Manual warning addition
router.post('/:guildId/warnings', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, userName, reason } = req.body;
  
  try {
    const warnData = {
      userId,
      userName,
      warnedBy: req.user.userId,
      warnedByName: req.user.username,
      reason: reason || 'Issued from Dashboard Website'
    };
    
    const newWarn = await dbService.addWarning(guildId, warnData);
    res.json({ success: true, warning: newWarn });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create warning record' });
  }
});

// DELETE /api/guilds/:guildId/warnings/:warnId - Delete/pardon warning
router.delete('/:guildId/warnings/:warnId', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId, warnId } = req.params;
  try {
    await dbService.deleteWarning(guildId, warnId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete warning record' });
  }
});

module.exports = router;
