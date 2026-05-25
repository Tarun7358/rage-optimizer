const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../services/dbService');
const restoreQueue = require('../services/restoreQueue');
const { client: botClient } = require('../bot/client');

// GET /api/templates - List & search public templates
router.get('/', authMiddleware, async (req, res) => {
  const { search, category } = req.query;
  try {
    const templates = await dbService.getTemplates({
      isPublic: true,
      search,
      category
    });
    res.json(templates);
  } catch (error) {
    console.error('[Templates GET API Error]', error);
    res.status(500).json({ error: 'Failed to retrieve templates' });
  }
});

// GET /api/templates/my-templates - Get user's private/public templates
router.get('/my-templates', authMiddleware, async (req, res) => {
  try {
    const templates = await dbService.getTemplates({
      creatorId: req.user.userId
    });
    res.json(templates);
  } catch (error) {
    console.error('[My Templates GET Error]', error);
    res.status(500).json({ error: 'Failed to retrieve user templates' });
  }
});

// GET /api/templates/:templateId - Get template by ID
router.get('/:templateId', authMiddleware, async (req, res) => {
  const { templateId } = req.params;
  try {
    const template = await dbService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('[Template Detail Error]', error);
    res.status(500).json({ error: 'Failed to fetch template details' });
  }
});

// POST /api/templates - Save a backup as a template
router.post('/', authMiddleware, async (req, res) => {
  const { backupId, guildId, templateId, name, description, isPublic, category, tags } = req.body;

  if (!backupId || !guildId || !templateId || !name) {
    return res.status(400).json({ error: 'Missing required template parameters.' });
  }

  // Validate ID format (rage-xxxx-vxx)
  const slugRegex = /^[a-z0-9-_]+$/;
  if (!slugRegex.test(templateId)) {
    return res.status(400).json({ error: 'Template ID can only contain lowercase letters, numbers, dashes (-), and underscores (_).' });
  }

  try {
    // Check if templateId is already taken
    const existing = await dbService.getTemplateById(templateId);
    if (existing) {
      return res.status(400).json({ error: 'Template ID already exists. Please choose a unique name.' });
    }

    const backup = await dbService.getBackupById(guildId, backupId);
    if (!backup) {
      return res.status(404).json({ error: 'Source backup snapshot not found.' });
    }

    // Save as template
    const template = await dbService.addTemplate({
      templateId,
      name,
      description,
      creatorId: req.user.userId,
      creatorName: req.user.username,
      isPublic: !!isPublic,
      category: category || 'Gaming',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      backupData: backup.backupData || {
        channels: backup.channels || [],
        roles: backup.roles || [],
        categories: backup.categories || [],
        emojis: backup.emojis || [],
        serverSettings: backup.serverSettings || {}
      }
    });

    res.json({ success: true, template });
  } catch (error) {
    console.error('[Template Create API Error]', error);
    res.status(500).json({ error: 'Failed to create template from backup.' });
  }
});

// DELETE /api/templates/:templateId - Delete template
router.delete('/:templateId', authMiddleware, async (req, res) => {
  const { templateId } = req.params;
  try {
    const template = await dbService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Only creator or admin can delete
    if (template.creatorId !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized. You do not own this template.' });
    }

    await dbService.deleteTemplate(templateId);
    res.json({ success: true, message: 'Template successfully deleted.' });
  } catch (error) {
    console.error('[Template Delete Error]', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST /api/templates/:templateId/install - Track installation counts
router.post('/:templateId/install', authMiddleware, async (req, res) => {
  const { templateId } = req.params;
  try {
    const template = await dbService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const currentInstalls = template.installCount || 0;
    const currentDownloads = template.downloadCount || 0;

    await dbService.updateTemplate(templateId, {
      installCount: currentInstalls + 1,
      downloadCount: currentDownloads + 1
    });

    res.json({ success: true, installCount: currentInstalls + 1 });
  } catch (error) {
    console.error('[Template Install Count Error]', error);
    res.status(500).json({ error: 'Failed to update template metrics' });
  }
});

// POST /api/templates/:templateId/load/:guildId - Load template to guild
router.post('/:templateId/load/:guildId', authMiddleware, async (req, res) => {
  const { templateId, guildId } = req.params;

  try {
    const template = await dbService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const liveGuild = botClient.guilds.cache.get(guildId);
    if (!liveGuild) {
      // If mock, simulate
      const isFirebaseMock = require('../config/firebase').isFirebaseMock;
      if (isFirebaseMock) {
        await dbService.addRestoreLog(guildId, {
          action: 'RESTORE_APPLY',
          executorId: req.user.userId,
          executorName: req.user.username,
          status: 'success',
          details: `[MOCK MODE] Simulation loading of template: ${template.name} (${templateId}).`
        });
        return res.json({ success: true, message: '[MOCK MODE] Template loading simulated successfully!' });
      }
      return res.status(404).json({ error: 'Rage Optimizer Bot is not in this server.' });
    }

    // Verify User Permissions - Must be guild owner or admin
    const member = await liveGuild.members.fetch(req.user.userId).catch(() => null);
    if (!member && !req.user.isAdmin) {
      return res.status(403).json({ error: 'You must be in the guild to load a template.' });
    }
    
    const isOwner = liveGuild.ownerId === req.user.userId;
    const isAdmin = member ? member.permissions.has('Administrator') : false;

    if (!isOwner && !isAdmin && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access Denied: Only the Guild Owner or server Administrators can apply templates.' });
    }

    // Trigger restoration queue
    await restoreQueue.startRestore(liveGuild, template.backupData, {
      id: req.user.userId,
      username: req.user.username
    });

    // Update install counts
    await dbService.updateTemplate(templateId, {
      installCount: (template.installCount || 0) + 1,
      downloadCount: (template.downloadCount || 0) + 1
    });

    res.json({ success: true, message: 'Server layout restoration queue started. Recreating structure now...' });

  } catch (error) {
    console.error('[Template Load Error]', error);
    res.status(500).json({ error: error.message || 'Failed to apply template configuration.' });
  }
});

module.exports = router;
