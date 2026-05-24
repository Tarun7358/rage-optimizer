const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const dbService = require('../../services/dbService');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    const { guild } = channel;
    if (!guild) return;

    try {
      const settings = await dbService.getGuildSettings(guild.id);
      if (!settings || !settings.security || !settings.security.antiNuke) return;

      // Fetch audit logs
      const fetchedLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
      });
      const deletionLog = fetchedLogs.entries.first();
      if (!deletionLog) return;

      const { executor } = deletionLog;
      if (executor.id === guild.ownerId || executor.id === guild.client.user.id) return;

      // Track limits
      if (!guild.client.antiNuke) guild.client.antiNuke = {};
      const key = `${guild.id}:${executor.id}`;
      const now = Date.now();

      if (!guild.client.antiNuke[key]) {
        guild.client.antiNuke[key] = { count: 0, resetTime: now + 60000 };
      }

      const limitInfo = guild.client.antiNuke[key];
      if (now > limitInfo.resetTime) {
        limitInfo.count = 1;
        limitInfo.resetTime = now + 60000;
      } else {
        limitInfo.count++;
      }

      const limit = settings.security.channelLimit || 5;

      if (limitInfo.count > limit) {
        // Punish executor - Strip administrative/moderator roles
        const member = await guild.members.fetch(executor.id).catch(() => null);
        if (member) {
          const rolesToRemove = member.roles.cache.filter(role => 
            role.permissions.has('Administrator') || 
            role.permissions.has('ManageChannels') || 
            role.permissions.has('ManageRoles')
          );
          if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove, 'RAGE ANTI-NUKE: Exceeded channel deletion limit').catch(() => {});
          }
        }

        // Add Security Log to DB
        await dbService.addSecurityLog(guild.id, {
          action: 'ANTI_NUKE_PREVENT',
          executorId: executor.id,
          executorName: executor.username,
          severity: 'critical',
          details: `Stripped management roles from ${executor.username} for exceeding rapid channel deletion limit (${limitInfo.count}/${limit}).`
        });

        // Send alert embed
        const alertEmbed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('🚨 RAGE Anti-Nuke Triggered')
          .setDescription(`**Executor:** ${executor} (${executor.username})\n**Action:** Mass Channel Deletion\n**Status:** Management roles stripped to prevent server damage.`)
          .addFields(
            { name: 'Deleted Channel Name', value: `#${channel.name}`, inline: true },
            { name: 'Deletions in 60s', value: `${limitInfo.count}`, inline: true }
          )
          .setTimestamp();

        if (settings.moderation && settings.moderation.logChannelId) {
          const logChannel = guild.channels.cache.get(settings.moderation.logChannelId);
          if (logChannel) await logChannel.send({ embeds: [alertEmbed] });
        }
      }
    } catch (err) {
      console.error('[Anti-Nuke ChannelDelete Error]', err);
    }
  }
};
