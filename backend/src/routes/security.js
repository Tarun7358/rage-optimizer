const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../services/dbService');
const backupService = require('../services/backupService');
const restoreQueue = require('../services/restoreQueue');
const { client: botClient } = require('../bot/client');

// Middleware to verify if user has Administrator permissions in the target guild
const checkGuildAdmin = async (req, res, next) => {
  const { guildId } = req.params;
  const userId = req.user.userId;
  const isAdminUser = req.user.isAdmin; // Global bot developer admin bypass

  if (isAdminUser) return next();

  const liveGuild = botClient.guilds.cache.get(guildId);
  if (!liveGuild) {
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

// GET /api/security/:guildId/backups - List backups
router.get('/:guildId/backups', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const backups = await dbService.getBackups(guildId);
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve backups' });
  }
});

// POST /api/security/:guildId/backups - Trigger manual backup
router.post('/:guildId/backups', authMiddleware, checkGuildAdmin, async (req, res) => {
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
router.delete('/:guildId/backups/:backupId', authMiddleware, checkGuildAdmin, async (req, res) => {
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
router.post('/:guildId/backups/:backupId/restore', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId, backupId } = req.params;

  try {
    const backup = await dbService.getBackupById(guildId, backupId);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const liveGuild = botClient.guilds.cache.get(guildId);
    
    if (liveGuild) {
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
router.get('/:guildId/logs', authMiddleware, checkGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  try {
    const logs = await dbService.getSecurityLogs(guildId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve security logs' });
  }
});

// GET /api/security/:guildId/restore-logs - Get restore progress / history logs
router.get('/:guildId/restore-logs', authMiddleware, checkGuildAdmin, async (req, res) => {
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

// POST /api/security/clone - Clone server structures
router.post('/clone', authMiddleware, async (req, res) => {
  const { sourceGuildId, targetGuildId, backupId, templateId } = req.body;
  
  if (!targetGuildId) {
    return res.status(400).json({ error: 'Target Guild ID is required.' });
  }

  try {
    const liveTarget = botClient.guilds.cache.get(targetGuildId);
    
    // Check target permission
    if (liveTarget) {
      const member = await liveTarget.members.fetch(req.user.userId).catch(() => null);
      if (!member && !req.user.isAdmin) {
        return res.status(403).json({ error: 'You are not a member of the target server.' });
      }
      
      const isOwner = liveTarget.ownerId === req.user.userId;
      const isAdmin = member ? member.permissions.has('Administrator') : false;
      if (!isOwner && !isAdmin && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Access Denied: You must be the target server Owner or Administrator.' });
      }

      if (restoreQueue.isActive(targetGuildId)) {
        return res.status(400).json({ error: 'Target server is already running a clone or restore operation.' });
      }
    }

    let backupData = null;
    let label = 'Configuration Clone';

    // 1. Source: Live Server
    if (sourceGuildId) {
      const liveSource = botClient.guilds.cache.get(sourceGuildId);
      if (!liveSource) {
        // If mock
        const isFirebaseMock = require('../config/firebase').isFirebaseMock;
        if (isFirebaseMock && sourceGuildId.startsWith('mock_')) {
          backupData = {
            serverSettings: { name: 'Mock Source Clone' },
            roles: [{ name: 'Cloned Admin', permissions: '8', color: 16711680 }],
            categories: [{ name: 'Cloned Category' }],
            channels: [{ name: 'cloned-text', type: 0 }, { name: 'cloned-voice', type: 2 }],
            emojis: []
          };
        } else {
          return res.status(404).json({ error: 'Source server bot is not active or server not found.' });
        }
      } else {
        // Check source permissions
        const srcMember = await liveSource.members.fetch(req.user.userId).catch(() => null);
        if (!srcMember && !req.user.isAdmin) {
          return res.status(403).json({ error: 'You are not a member of the source server.' });
        }
        const isSrcOwner = liveSource.ownerId === req.user.userId;
        const isSrcAdmin = srcMember ? srcMember.permissions.has('Administrator') : false;
        if (!isSrcOwner && !isSrcAdmin && !req.user.isAdmin) {
          return res.status(403).json({ error: 'Access Denied: You must have admin access to the source server to extract layout.' });
        }

        backupData = await backupService.captureGuild(liveSource);
        label = `Cloned from Server: ${liveSource.name}`;
      }
    }
    // 2. Source: Backup Snapshot
    else if (backupId) {
      const backup = await dbService.getBackupById(req.body.sourceGuildId || targetGuildId, backupId);
      if (!backup) {
        return res.status(404).json({ error: 'Source backup snapshot not found.' });
      }
      backupData = backup.backupData || backup;
      label = `Cloned from Backup: ${backup.backupName || backup.name}`;
    }
    // 3. Source: Template Marketplace
    else if (templateId) {
      const template = await dbService.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Source template layout not found.' });
      }
      backupData = template.backupData;
      label = `Cloned from Template: ${template.name}`;
      
      // Update template install count
      await dbService.updateTemplate(templateId, {
        installCount: (template.installCount || 0) + 1,
        downloadCount: (template.downloadCount || 0) + 1
      });
    } else {
      return res.status(400).json({ error: 'Please specify a source (Server, Backup, or Template) to clone.' });
    }

    if (liveTarget) {
      // Trigger restoration queue
      await restoreQueue.startRestore(liveTarget, backupData, {
        id: req.user.userId,
        username: req.user.username
      });
    } else {
      // Mock simulation mode
      const isFirebaseMock = require('../config/firebase').isFirebaseMock;
      if (isFirebaseMock) {
        await dbService.addRestoreLog(targetGuildId, {
          action: 'RESTORE_APPLY',
          executorId: req.user.userId,
          executorName: req.user.username,
          status: 'success',
          details: `[MOCK MODE] Simulation cloning of layout: ${label} into ${targetGuildId}.`
        });
      } else {
        return res.status(404).json({ error: 'Rage Optimizer Bot is not active on target server.' });
      }
    }

    res.json({ success: true, message: 'Server cloning process has been queued successfully. Recreating structure...' });

  } catch (error) {
    console.error('[Cloner API Error]', error);
    res.status(500).json({ error: error.message || 'Failed to initialize server cloning.' });
  }
});

module.exports = router;
