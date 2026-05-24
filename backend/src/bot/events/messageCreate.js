const dbService = require('../../services/dbService');
const { EmbedBuilder } = require('discord.js');

// Simple spam detection cache: userId -> Array of timestamps
const messageCache = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;

    const { guild, author, content, channel } = message;

    // Retrieve settings
    let settings;
    try {
      settings = await dbService.getGuildSettings(guild.id);
    } catch (err) {
      return;
    }
    
    if (!settings || !settings.moderation || !settings.moderation.autoMod) return;

    const modConfig = settings.moderation;

    // Automod bypass for Admins/Staff
    const member = await guild.members.fetch(author.id).catch(() => null);
    if (member && (member.permissions.has('Administrator') || (settings.tickets.staffRoles && settings.tickets.staffRoles.some(role => member.roles.cache.has(role))))) {
      return;
    }

    let isViolated = false;
    let reason = "";

    // 1. Anti-Invite filter
    if (modConfig.antiInvite) {
      const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i;
      if (inviteRegex.test(content)) {
        isViolated = true;
        reason = "Anti-Invite Protection: Discord invite links are not allowed.";
      }
    }

    // 2. Anti-Scam / Phishing filter
    if (modConfig.antiScam && !isViolated) {
      const scamRegex = /(steamcommunity-.*|gift.*discord.*|free.*nitro.*|dlscord.*|disocrd.*|nitro-.*)\.(com|xyz|info|gift|org|net)/i;
      if (scamRegex.test(content)) {
        isViolated = true;
        reason = "Anti-Scam Protection: Phishing or suspicious links detected.";
      }
    }

    // 3. Blacklisted Words filter
    if (modConfig.badWords && modConfig.badWords.length > 0 && !isViolated) {
      const lowerContent = content.toLowerCase();
      const detectedWord = modConfig.badWords.find(word => lowerContent.includes(word.toLowerCase()));
      if (detectedWord) {
        isViolated = true;
        reason = `Banned Word Filter: Message contained blacklisted word.`;
      }
    }

    // 4. Anti-Spam filter
    if (modConfig.antiSpam && !isViolated) {
      const now = Date.now();
      const timestamps = messageCache.get(author.id) || [];
      timestamps.push(now);

      // Keep only logs from the last 5 seconds
      const recentTimestamps = timestamps.filter(ts => now - ts < 5000);
      messageCache.set(author.id, recentTimestamps);

      // Rule: More than 5 messages in 5 seconds is spam
      if (recentTimestamps.length > 5) {
        isViolated = true;
        reason = "Anti-Spam Protection: Too many messages sent in a short duration.";
      }
    }

    if (isViolated) {
      try {
        // Delete offending message
        await message.delete().catch(() => {});

        // Save warning to Firebase DB
        await dbService.addWarning(guild.id, {
          userId: author.id,
          userName: author.username,
          warnedBy: client.user.id,
          warnedByName: client.user.username,
          reason: reason
        });

        // Send Warning embed to channel
        const warnEmbed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('⚠️ Automod Rule Violation')
          .setDescription(`${author}, your message was deleted for violating a safety filter.`)
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp();

        const warnMessage = await channel.send({ embeds: [warnEmbed] });
        setTimeout(() => warnMessage.delete().catch(() => {}), 6000);

        // Try to DM warning to user
        await author.send(`⚠️ You received a warning in **${guild.name}**:\n**Reason:** ${reason}`).catch(() => {});

        // Log to moderation channel if configured
        if (modConfig.logChannelId) {
          const logChannel = guild.channels.cache.get(modConfig.logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor('#ff003c')
              .setTitle('🛡️ Automod Warning Issued')
              .addFields(
                { name: 'User', value: `${author.tag} (${author.id})`, inline: true },
                { name: 'Channel', value: `${channel}`, inline: true },
                { name: 'Rule Triggered', value: reason }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        }

      } catch (err) {
        console.error('[Automod Error] Failed to handle violation:', err);
      }
    }
  }
};
