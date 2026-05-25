const dbService = require('../../services/dbService');
const { ChannelType } = require('discord.js');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guildId = oldState.guild.id;

    // Fetch settings
    let settings;
    try {
      settings = await dbService.getGuildSettings(guildId);
    } catch (err) {
      return;
    }

    if (!settings || !settings.tempVoice || !settings.tempVoice.enabled) return;

    const { channelId: masterChannelId, categoryParent } = settings.tempVoice;

    // 1. User Joins Master Channel -> Create Temp Voice
    if (newState.channelId === masterChannelId) {
      try {
        const parentCategory = categoryParent || null;
        
        // Create new voice channel named after the user
        const tempChannel = await newState.guild.channels.create({
          name: `🔊 ${newState.member.user.username}'s VC`,
          type: ChannelType.GuildVoice,
          parent: parentCategory,
          userLimit: 10
        });

        // Move member to the new channel
        await newState.setChannel(tempChannel);

      } catch (err) {
        console.error('[Temp Voice Error] Failed to create temp VC:', err);
      }
    }

    // 2. User Leaves/Changes Channel -> Clean Up Empty Temp Voice
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const oldChannel = oldState.channel;
      
      // If it's a temporary channel (starts with '🔊 ') and is empty, delete it
      if (
        oldChannel &&
        oldChannel.type === ChannelType.GuildVoice &&
        oldChannel.name.startsWith('🔊 ') &&
        oldChannel.members.size === 0 &&
        oldChannel.id !== masterChannelId
      ) {
        try {
          await oldChannel.delete();
        } catch (err) {
          console.warn('[Temp Voice Error] Failed to delete empty temp VC:', err.message);
        }
      }
    }
  }
};
