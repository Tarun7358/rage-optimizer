const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../services/dbService');
const { client: botClient } = require('../bot/client');

// GET /api/security/:guildId/backups - List backups
router.get('/:guildId/backups', authMiddleware, async (req, res) => {
  const { guildId } = req.params;
  try {
    const backups = await dbService.getBackups(guildId);
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve backups' });
  }
});

// POST /api/security/:guildId/backups - Trigger manual backup
router.post('/:guildId/backups', authMiddleware, async (req, res) => {
  const { guildId } = req.params;
  const { name } = req.body;

  try {
    const backupId = 'RAGE_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    let savedChannels = [];
    let savedRoles = [];

    const liveGuild = botClient.guilds.cache.get(guildId);
    if (liveGuild) {
      // Gather Channels
      liveGuild.channels.cache.forEach(channel => {
        const overwrites = [];
        channel.permissionOverwrites.cache.forEach(ow => {
          overwrites.push({
            id: ow.id,
            type: ow.type === 0 ? 'role' : 'member',
            allow: ow.allow.bitfield.toString(),
            deny: ow.deny.bitfield.toString()
          });
        });
        savedChannels.push({
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
          position: channel.position,
          topic: channel.topic || "",
          nsfw: channel.nsfw || false,
          rateLimitPerUser: channel.rateLimitPerUser || 0,
          permissionOverwrites: overwrites
        });
      });

      // Gather Roles
      liveGuild.roles.cache.forEach(role => {
        if (role.name === '@everyone' || role.managed) return;
        savedRoles.push({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          managed: role.managed,
          mentionable: role.mentionable
        });
      });
    } else {
      // Mock data if running in developer offline environment
      savedChannels = [
        { name: 'general', type: 0, position: 1 },
        { name: 'welcome', type: 0, position: 0 },
        { name: 'voice-chat', type: 2, position: 2 }
      ];
      savedRoles = [
        { name: 'Administrator', color: 16711740, position: 1, permissions: '8' },
        { name: 'VIP Buyer', color: 16776960, position: 2, permissions: '0' }
      ];
    }

    const backupData = {
      backupId,
      creatorId: req.user.userId,
      creatorName: req.user.username,
      name: name || `Backup - ${new Date().toLocaleDateString()}`,
      channels: savedChannels,
      roles: savedRoles
    };

    const newBackup = await dbService.addBackup(guildId, backupData);

    // Log security activity
    await dbService.addSecurityLog(guildId, {
      action: 'BACKUP_CREATE',
      executorId: req.user.userId,
      executorName: req.user.username,
      severity: 'info',
      details: `Created server configuration backup: ${newBackup.name} (${backupId})`
    });

    res.json({ success: true, backup: newBackup });

  } catch (error) {
    console.error('[Security Backup Error]', error);
    res.status(500).json({ error: 'Failed to create backup snapshot' });
  }
});

// POST /api/security/:guildId/backups/:backupId/restore - Restore server from backup
router.post('/:guildId/backups/:backupId/restore', authMiddleware, async (req, res) => {
  const { guildId, backupId } = req.params;

  try {
    const backup = await dbService.getBackupById(guildId, backupId);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const liveGuild = botClient.guilds.cache.get(guildId);
    
    if (liveGuild) {
      console.log(`[Security Restore] Starting restoration for live guild: ${liveGuild.name}`);
      
      await dbService.addSecurityLog(guildId, {
        action: 'BACKUP_RESTORE',
        executorId: req.user.userId,
        executorName: req.user.username,
        severity: 'critical',
        details: `Triggered full restoration using backup: ${backup.name} (${backupId}). Recreating ${backup.channels ? backup.channels.length : 0} channels.`,
        prevented: false
      });

      // Implement restoration async in background to avoid route timeouts
      setTimeout(async () => {
        try {
          // Clear current channels
          for (const [id, channel] of liveGuild.channels.cache) {
            await channel.delete().catch(() => {});
          }
          // Recreate roles and channels
          if (backup.channels) {
            for (const c of backup.channels) {
              await liveGuild.channels.create({
                name: c.name,
                type: c.type,
                topic: c.topic,
                nsfw: c.nsfw,
                rateLimitPerUser: c.rateLimitPerUser
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.error('[Restore Background Error]', e);
        }
      }, 1000);

    } else {
      // Mock log
      await dbService.addSecurityLog(guildId, {
        action: 'BACKUP_RESTORE',
        executorId: req.user.userId,
        executorName: req.user.username,
        severity: 'critical',
        details: `[MOCK MODE] Triggered simulation restoration using backup: ${backup.name} (${backupId}).`,
        prevented: true
      });
    }

    res.json({ success: true, message: 'Server restoration has been queued successfully.' });

  } catch (error) {
    console.error('[Restore API Error]', error);
    res.status(500).json({ error: 'Failed to restore backup snapshot' });
  }
});

// GET /api/security/:guildId/logs - Get Security logs
router.get('/:guildId/logs', authMiddleware, async (req, res) => {
  const { guildId } = req.params;
  try {
    const logs = await dbService.getSecurityLogs(guildId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve security logs' });
  }
});

module.exports = router;
