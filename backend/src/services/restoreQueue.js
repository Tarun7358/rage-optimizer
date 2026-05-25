const { ChannelType } = require('discord.js');
const dbService = require('./dbService');
const socketService = require('./socketService');

// In-memory active restorations and cooldowns
const activeRestorations = new Map();
const cooldowns = new Map();

// Helper to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const restoreQueue = {
  /**
   * Check if a guild is currently being restored
   */
  isActive: (guildId) => {
    return activeRestorations.has(guildId);
  },

  /**
   * Check if a guild is on restore cooldown
   */
  getCooldown: (guildId) => {
    if (!cooldowns.has(guildId)) return 0;
    const expiry = cooldowns.get(guildId);
    const remaining = expiry - Date.now();
    return remaining > 0 ? remaining : 0;
  },

  /**
   * Set a restore cooldown for a guild (default 5 minutes)
   */
  setCooldown: (guildId, durationMs = 300000) => {
    cooldowns.set(guildId, Date.now() + durationMs);
  },

  /**
   * Get progress for an active restoration
   */
  getProgress: (guildId) => {
    return activeRestorations.get(guildId) || null;
  },

  /**
   * Run restore in background
   */
  startRestore: async (guild, backupData, executor) => {
    const guildId = guild.id;
    if (activeRestorations.has(guildId)) {
      throw new Error('A restoration is already in progress for this server.');
    }

    const remainingCooldown = restoreQueue.getCooldown(guildId);
    if (remainingCooldown > 0) {
      throw new Error(`Restoration is on cooldown. Please wait ${Math.ceil(remainingCooldown / 60000)} minutes.`);
    }

    // Set cooldown immediately to prevent double submission
    restoreQueue.setCooldown(guildId);

    // Initial progress state
    const progress = {
      guildId,
      status: 'processing',
      currentStep: 0,
      totalSteps: 1,
      currentAction: 'Preparing restoration queue...',
      logs: [],
      error: null,
      createdAt: new Date().toISOString()
    };

    activeRestorations.set(guildId, progress);
    restoreQueue.updateProgress(guildId, progress);

    // Run async in background
    restoreQueue.processRestore(guild, backupData, executor, progress).catch(err => {
      console.error(`[Restore Queue Error] Guild ${guildId}:`, err);
    });

    return true;
  },

  /**
   * Update progress status and broadcast
   */
  updateProgress: async (guildId, progress) => {
    activeRestorations.set(guildId, progress);
    
    // Broadcast via socket
    socketService.emitToGuild(guildId, 'restoreProgress', progress);

    // Realtime Database Sync
    const { rtdb, isFirebaseMock } = require('../config/firebase');
    if (!isFirebaseMock && rtdb) {
      try {
        await rtdb.ref(`guilds/${guildId}/restoreProgress`).set(progress);
      } catch (err) {}
    }
  },

  /**
   * Core restoration processor
   */
  processRestore: async (guild, backup, executor, progress) => {
    const guildId = guild.id;
    const logs = [];
    const addLog = (msg) => {
      const time = new Date().toLocaleTimeString();
      const entry = `[${time}] ${msg}`;
      logs.push(entry);
      progress.logs = logs;
      console.log(`[Restore Queue][${guild.name}] ${msg}`);
    };

    const isMockGuild = guildId.startsWith('mock_') || !guild.members?.me;

    // Safe execution wrapper for API calls with Retries
    const runTask = async (fn, description) => {
      if (isMockGuild) {
        await delay(500); // Simulate API latency for simulation visual effect
        return;
      }
      let attempts = 0;
      while (attempts < 3) {
        try {
          await delay(300); // Base anti-spam delay between requests
          return await fn();
        } catch (error) {
          attempts++;
          if (error.status === 429 || error.code === 50035 || error.message.includes('rate limit')) {
            const retryAfter = error.retryAfter ? (error.retryAfter * 1000) : 5000;
            addLog(`⚠️ Rate limit hit during: ${description}. Retrying in ${retryAfter / 1000}s (Attempt ${attempts}/3)`);
            await delay(retryAfter);
          } else {
            addLog(`❌ Failed to execute: ${description}. Error: ${error.message}`);
            throw error;
          }
        }
      }
      throw new Error(`Failed to complete: ${description} after 3 attempts.`);
    };

    try {
      const backupContent = backup.backupData || backup;
      const backupRoles = backupContent.roles || [];
      const backupCategories = backupContent.categories || [];
      const backupChannels = backupContent.channels || [];
      const backupEmojis = backupContent.emojis || [];
      const backupSettings = backupContent.serverSettings || {};

      // Estimate total steps
      const rolesToDeleteCount = isMockGuild ? 3 : guild.roles.cache.filter(r => !r.managed && r.name !== '@everyone' && r.comparePositionTo(guild.members.me.roles.highest) < 0).size;
      const channelsToDeleteCount = guild.channels.cache.size;
      
      progress.totalSteps = 2 + rolesToDeleteCount + channelsToDeleteCount + backupRoles.length + backupCategories.length + backupChannels.length + backupEmojis.length + 1;
      
      addLog('🚀 Starting Server Configuration Restoration.');
      addLog(`Guild ID: ${guildId} • Executor: ${executor.username}`);

      // --- STEP 1: CLEANING EXISTING CHANNELS ---
      progress.currentAction = 'Cleaning existing channels...';
      restoreQueue.updateProgress(guildId, progress);
      addLog(`Deleting ${channelsToDeleteCount} existing channels...`);

      for (const [id, channel] of guild.channels.cache) {
        await runTask(async () => {
          await channel.delete();
        }, `Deleting channel: #${channel.name}`);
        progress.currentStep++;
        restoreQueue.updateProgress(guildId, progress);
      }
      addLog('✅ All old channels deleted.');

      // --- STEP 2: CLEANING EXISTING ROLES ---
      progress.currentAction = 'Cleaning existing roles...';
      restoreQueue.updateProgress(guildId, progress);
      addLog(`Deleting configurable roles...`);

      for (const [id, role] of guild.roles.cache) {
        // Skip @everyone, bot integration roles, and roles higher than bot's highest role
        if (role.name === '@everyone' || role.managed) continue;
        if (!isMockGuild && role.comparePositionTo(guild.members.me.roles.highest) >= 0) continue;
        
        await runTask(async () => {
          await role.delete();
        }, `Deleting role: ${role.name}`);
        progress.currentStep++;
        restoreQueue.updateProgress(guildId, progress);
      }
      addLog('✅ Configurable roles cleaned.');

      // --- STEP 3: CREATING NEW ROLES ---
      progress.currentAction = 'Recreating role structure...';
      restoreQueue.updateProgress(guildId, progress);
      addLog(`Creating ${backupRoles.length} roles...`);

      const roleMap = new Map();
      const everyoneRole = guild.roles.everyone || { id: '@everyone' };
      roleMap.set('@everyone', everyoneRole.id);

      const sortedRoles = [...backupRoles].sort((a, b) => a.position - b.position);

      for (const roleData of sortedRoles) {
        if (roleData.name === '@everyone' || roleData.isEveryone) {
          await runTask(async () => {
            if (!isMockGuild) {
              await everyoneRole.setPermissions(BigInt(roleData.permissions));
            }
          }, 'Updating @everyone permissions');
          roleMap.set(roleData.id || '@everyone', everyoneRole.id);
          progress.currentStep++;
          restoreQueue.updateProgress(guildId, progress);
          continue;
        }

        await runTask(async () => {
          let newRoleId = 'mock_role_' + Math.random().toString(36).substring(2, 8);
          if (!isMockGuild) {
            const newRole = await guild.roles.create({
              name: roleData.name,
              color: roleData.color,
              hoist: roleData.hoist,
              mentionable: roleData.mentionable,
              permissions: BigInt(roleData.permissions)
            });
            newRoleId = newRole.id;
          }
          roleMap.set(roleData.id || roleData.name, newRoleId);
          addLog(`Created role: ${roleData.name}`);
        }, `Creating role: ${roleData.name}`);
        progress.currentStep++;
        restoreQueue.updateProgress(guildId, progress);
      }

      // --- STEP 4: CREATING CATEGORIES ---
      progress.currentAction = 'Recreating categories...';
      restoreQueue.updateProgress(guildId, progress);
      addLog(`Creating ${backupCategories.length} category headers...`);

      const categoryMap = new Map();

      for (const catData of backupCategories) {
        await runTask(async () => {
          let newCatId = 'mock_cat_' + Math.random().toString(36).substring(2, 8);
          if (!isMockGuild) {
            const permissionOverwrites = [];
            if (catData.permissionOverwrites) {
              for (const ow of catData.permissionOverwrites) {
                const mappedId = roleMap.get(ow.id) || ow.id;
                permissionOverwrites.push({
                  id: mappedId,
                  type: ow.type,
                  allow: BigInt(ow.allow),
                  deny: BigInt(ow.deny)
                });
              }
            }

            const newCat = await guild.channels.create({
              name: catData.name,
              type: ChannelType.GuildCategory,
              position: catData.position,
              permissionOverwrites
            });
            newCatId = newCat.id;
          }

          categoryMap.set(catData.id || catData.name, newCatId);
          addLog(`Created category: ${catData.name}`);
        }, `Creating category: ${catData.name}`);
        progress.currentStep++;
        restoreQueue.updateProgress(guildId, progress);
      }

      // --- STEP 5: CREATING CHANNELS ---
      progress.currentAction = 'Recreating channels...';
      restoreQueue.updateProgress(guildId, progress);
      addLog(`Creating ${backupChannels.length} text, voice & forum channels...`);

      for (const chanData of backupChannels) {
        await runTask(async () => {
          if (!isMockGuild) {
            const parentId = chanData.parentId ? (categoryMap.get(chanData.parentId) || null) : null;
            const permissionOverwrites = [];
            if (chanData.permissionOverwrites) {
              for (const ow of chanData.permissionOverwrites) {
                const mappedId = roleMap.get(ow.id) || ow.id;
                permissionOverwrites.push({
                  id: mappedId,
                  type: ow.type,
                  allow: BigInt(ow.allow),
                  deny: BigInt(ow.deny)
                });
              }
            }

            let chanType = ChannelType.GuildText;
            if (chanData.type === 2 || chanData.type === ChannelType.GuildVoice) chanType = ChannelType.GuildVoice;
            if (chanData.type === 4 || chanData.type === ChannelType.GuildCategory) chanType = ChannelType.GuildCategory;
            if (chanData.type === 15 || chanData.type === ChannelType.GuildForum) chanType = ChannelType.GuildForum;

            await guild.channels.create({
              name: chanData.name,
              type: chanType,
              topic: chanData.topic || '',
              nsfw: chanData.nsfw || false,
              rateLimitPerUser: chanData.rateLimitPerUser || 0,
              parent: parentId,
              position: chanData.position,
              permissionOverwrites
            });
          }
          addLog(`Created channel: #${chanData.name}`);
        }, `Creating channel: #${chanData.name}`);
        progress.currentStep++;
        restoreQueue.updateProgress(guildId, progress);
      }

      // --- STEP 6: RESTORING EMOJIS ---
      progress.currentAction = 'Restoring emojis...';
      restoreQueue.updateProgress(guildId, progress);
      addLog(`Restoring ${backupEmojis.length} emojis...`);

      for (const emojiData of backupEmojis) {
        await runTask(async () => {
          if (!isMockGuild) {
            try {
              await guild.emojis.create({
                attachment: emojiData.url,
                name: emojiData.name
              });
              addLog(`Restored emoji: :${emojiData.name}:`);
            } catch (e) {
              addLog(`⚠️ Non-fatal: Could not recreate emoji :${emojiData.name}: (Max emojis reached or download failed)`);
            }
          } else {
            addLog(`Restored emoji: :${emojiData.name}:`);
          }
        }, `Restoring emoji: :${emojiData.name}:`);
        progress.currentStep++;
        restoreQueue.updateProgress(guildId, progress);
      }

      // --- STEP 7: RESTORING SERVER SETTINGS ---
      progress.currentAction = 'Configuring server settings...';
      restoreQueue.updateProgress(guildId, progress);
      addLog('Applying verification and safety rules settings...');

      await runTask(async () => {
        if (!isMockGuild) {
          const updateParams = {};
          if (backupSettings.verificationLevel !== undefined) updateParams.verificationLevel = backupSettings.verificationLevel;
          if (backupSettings.explicitContentFilter !== undefined) updateParams.explicitContentFilter = backupSettings.explicitContentFilter;
          if (backupSettings.defaultMessageNotifications !== undefined) updateParams.defaultMessageNotifications = backupSettings.defaultMessageNotifications;

          if (Object.keys(updateParams).length > 0) {
            await guild.edit(updateParams);
          }
        }
        addLog('Server settings updated successfully.');
      }, 'Applying server settings');
      progress.currentStep++;
      restoreQueue.updateProgress(guildId, progress);

      // --- FINALIZATION ---
      progress.status = 'completed';
      progress.currentAction = 'Restoration complete! Guild is fully configured.';
      restoreQueue.updateProgress(guildId, progress);
      addLog('🏆 Server restoration successfully completed.');

      // Save Log to Db
      await dbService.addRestoreLog(guildId, {
        action: 'RESTORE_APPLY',
        executorId: executor.id,
        executorName: executor.username,
        status: 'success',
        details: `Successfully restored server template structure. Recreated ${backupChannels.length} channels, ${backupRoles.length} roles, and ${backupEmojis.length} emojis.`
      });

      await dbService.addSecurityLog(guildId, {
        action: 'BACKUP_RESTORE',
        executorId: executor.id,
        executorName: executor.username,
        severity: 'critical',
        details: `Completed server restoration using backup snapshot. All layouts restored successfully.`
      });

      // Send Discord Log Channel notification if configured
      if (!isMockGuild) {
        const settings = await dbService.getGuildSettings(guildId);
        if (settings.moderation && settings.moderation.logChannelId) {
          const logChan = guild.channels.cache.get(settings.moderation.logChannelId);
          if (logChan) {
            const { EmbedBuilder } = require('discord.js');
            const logEmbed = new EmbedBuilder()
              .setColor('#53fc18')
              .setTitle('🛡️ Server Restored Successfully')
              .setDescription(`**Restored By:** ${executor} (${executor.username})\n**Backup Snapshot Name:** ${backup.name || backup.backupName}\n**Channels Restored:** ${backupChannels.length}\n**Roles Restored:** ${backupRoles.length}`)
              .setTimestamp()
              .setFooter({ text: 'RAGE OPTIMIZER Backup System' });
            await logChan.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      }

    } catch (err) {
      // HANDLE RESTORATION FAILURE
      progress.status = 'failed';
      progress.error = err.message;
      progress.currentAction = `Restoration failed: ${err.message}`;
      restoreQueue.updateProgress(guildId, progress);
      addLog(`💥 RESTORATION FAILED: ${err.message}`);

      // Save failure log to DB
      await dbService.addRestoreLog(guildId, {
        action: 'RESTORE_APPLY',
        executorId: executor.id,
        executorName: executor.username,
        status: 'failed',
        details: `Restoration failed: ${err.message}`
      });

      await dbService.addSecurityLog(guildId, {
        action: 'BACKUP_RESTORE_FAIL',
        executorId: executor.id,
        executorName: executor.username,
        severity: 'critical',
        details: `Failed restore operation: ${err.message}`
      });
    } finally {
      // Clear active state after 30 seconds so user can see completion
      setTimeout(() => {
        activeRestorations.delete(guildId);
      }, 30000);
    }
  }
};

module.exports = restoreQueue;
