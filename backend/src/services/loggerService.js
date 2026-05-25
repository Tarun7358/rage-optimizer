const { EmbedBuilder } = require('discord.js');
const dbService = require('./dbService');

const loggerService = {
  getLogChannel: (guild, settings, eventKey, sourceChannelId = null) => {
    if (!settings || !settings.serverLogs || !settings.serverLogs.enabled) {
      return null;
    }

    const { channelId, splitEvents, channelSpecific, eventChannels } = settings.serverLogs;

    // 1. If splitEvents is enabled and a specific channel is set for this event type
    if (splitEvents && eventChannels && eventChannels[eventKey]) {
      const chan = guild.channels.cache.get(eventChannels[eventKey]);
      if (chan) return chan;
    }

    // 2. If sourceChannelId is provided, check for channel-specific overrides
    if (sourceChannelId && channelSpecific && Array.isArray(channelSpecific)) {
      const match = channelSpecific.find(item => item.sourceChannelId === sourceChannelId);
      if (match) {
        const chan = guild.channels.cache.get(match.targetChannelId);
        if (chan) return chan;
      }
    }

    // 3. Fallback to default server log channel
    if (channelId) {
      const chan = guild.channels.cache.get(channelId);
      if (chan) return chan;
    }

    return null;
  },

  sendLog: async (guild, eventKey, sourceChannelId, embed) => {
    try {
      const settings = await dbService.getGuildSettings(guild.id);
      if (!settings || !settings.serverLogs || !settings.serverLogs.enabled) {
        return;
      }

      // Check if this specific event logging is enabled
      if (settings.serverLogs.events && !settings.serverLogs.events[eventKey]) {
        return;
      }

      const logChannel = loggerService.getLogChannel(guild, settings, eventKey, sourceChannelId);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error(`[Logger Service Error] Failed to send server log for event ${eventKey}:`, err.message);
    }
  }
};

module.exports = loggerService;
