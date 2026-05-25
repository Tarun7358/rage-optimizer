const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../services/dbService');
const backupService = require('../services/backupService');
const restoreQueue = require('../services/restoreQueue');
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
    const liveGuild = botClient.guilds.cache.get(guildId);
    
    let captured = null;
    if (liveGuild) {
      captured = await backupService.captureGuild(liveGuild);
    } else {
      // Mock fallback data for offline simulator
      captured = {
        serverSettings: { name: 'Rage Esports Tournament [MOCK]', verificationLevel: 1 },
        roles: [
          { id: '1', name: 'Administrator', color: 16711740, hoist: true, position: 1, permissions: '8', isEveryone: false },
          { id: '2', name: 'Staff Support', color: 3447003, hoist: true, position: 2, permissions: '0', isEveryone: false }
        ],
        categories: [
          { id: '10', name: 'Welcome Lobby', type: 4, position: 0, permissionOverwrites: [] }
        ],
        channels: [
          { id: '11', name: 'rules', type: 0, parentId: '10', position: 0, permissionOverwrites: [] },
          { id: '12', name: 'announcements', type: 0, parentId: '10', position: 1, permissionOverwrites: [] },
          { id: '13', name: 'matchmaking-lobby', type: 2, parentId: '10', position: 2, permissionOverwrites: [] }
        ],
        emojis: []
      };
    }

    const backupData = {
      backupId,
      ownerId: liveGuild ? liveGuild.ownerId : 'mock_owner_id',
      creatorId: req.user.userId,
      creatorName: req.user.username,
      backupName: name || `Backup - ${new Date().toLocaleDateString()}`,
      backupData: captured
    };

    const newBackup = await dbService.addBackup(guildId, backupData);

    // Log security activity
    await dbService.addSecurityLog(guildId, {
      action: 'BACKUP_CREATE',
      executorId: req.user.userId,
      executorName: req.user.username,
      severity: 'info',
      details: `Created server configuration backup: ${newBackup.backupName} (${backupId})`
    });

    res.json({ success: true, backup: newBackup });

  } catch (error) {
    console.error('[Security Backup Error]', error);
    res.status(500).json({ error: 'Failed to create backup snapshot' });
  }
});

// DELETE /api/security/:guildId/backups/:backupId - Delete a backup
router.delete('/:guildId/backups/:backupId', authMiddleware, async (req, res) => {
  const { guildId, backupId } = req.params;

  try {
    const backup = await dbService.getBackupById(guildId, backupId);
    if (!backup) {
      return res.status(404).json({ error: 'Backup snapshot not found.' });
    }

    await dbService.deleteBackup(guildId, backupId);

    // Log action
    await dbService.addSecurityLog(guildId, {
      action: 'BACKUP_DELETE',
      executorId: req.user.userId,
      executorName: req.user.username,
      severity: 'info',
      details: `Deleted backup snapshot: ${backup.backupName || backup.name} (${backupId})`
    });

    res.json({ success: true, message: 'Backup successfully deleted.' });
  } catch (error) {
    console.error('[Security Backup Delete Error]', error);
    res.status(500).json({ error: 'Failed to delete backup snapshot' });
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
      // Validate Permissions: Must be owner or admin
      const member = await liveGuild.members.fetch(req.user.userId).catch(() => null);
      if (!member && !req.user.isAdmin) {
        return res.status(403).json({ error: 'You are not a member of this server.' });
      }

      const isOwner = liveGuild.ownerId === req.user.userId;
      const isAdmin = member ? member.permissions.has('Administrator') : false;

      if (!isOwner && !isAdmin && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Access Denied: Only Guild Owners or server Administrators can perform restores.' });
      }

      // Check active restorations
      if (restoreQueue.isActive(guildId)) {
        return res.status(400).json({ error: 'A restoration is already running for this server.' });
      }

      // Check cooldowns
      const remainingCooldown = restoreQueue.getCooldown(guildId);
      if (remainingCooldown > 0) {
        return res.status(400).json({ error: `Restoration is on cooldown. Please wait ${Math.ceil(remainingCooldown / 60000)} minutes.` });
      }

      // Trigger restoration queue
      await restoreQueue.startRestore(liveGuild, backup.backupData || backup, {
        id: req.user.userId,
        username: req.user.username
      });

    } else {
      // Mock simulation mode
      const isFirebaseMock = require('../config/firebase').isFirebaseMock;
      if (isFirebaseMock) {
        await dbService.addRestoreLog(guildId, {
          action: 'RESTORE_APPLY',
          executorId: req.user.userId,
          executorName: req.user.username,
          status: 'success',
          details: `[MOCK MODE] Simulation loading of backup: ${backup.backupName || backup.name} (${backupId}).`
        });
      } else {
        return res.status(404).json({ error: 'Rage Optimizer Bot is not in this server.' });
      }
    }

    res.json({ success: true, message: 'Server restoration has been queued successfully. Recreating structure...' });

  } catch (error) {
    console.error('[Restore API Error]', error);
    res.status(500).json({ error: error.message || 'Failed to restore backup snapshot' });
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

// GET /api/security/:guildId/restore-logs - Get restore progress / history logs
router.get('/:guildId/restore-logs', authMiddleware, async (req, res) => {
  const { guildId } = req.params;
  try {
    const logs = await dbService.getRestoreLogs(guildId);
    
    // Check if there is an active progress to inject at the top
    const active = restoreQueue.getProgress(guildId);
    
    res.json({
      history: logs,
      active
    });
  } catch (error) {
    console.error('[Restore Logs GET Error]', error);
    res.status(500).json({ error: 'Failed to retrieve restore logs' });
  }
});

module.exports = router;
