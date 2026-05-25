const { ChannelType } = require('discord.js');

const backupService = {
  /**
   * Capture complete structural configurations of a guild
   */
  captureGuild: async (guild) => {
    // 1. Server Settings
    const serverSettings = {
      name: guild.name,
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      systemChannelId: guild.systemChannelId,
      rulesChannelId: guild.rulesChannelId,
      publicUpdatesChannelId: guild.publicUpdatesChannelId,
      mfaLevel: guild.mfaLevel
    };

    // 2. Roles
    const roles = [];
    guild.roles.cache.forEach(role => {
      // Keep everyone and configurable custom roles
      if (role.managed) return;
      roles.push({
        id: role.id,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable,
        isEveryone: role.name === '@everyone'
      });
    });

    // 3. Channels and Categories
    const categories = [];
    const channels = [];

    guild.channels.cache.forEach(channel => {
      const overwrites = [];
      channel.permissionOverwrites.cache.forEach(ow => {
        overwrites.push({
          id: ow.id,
          type: ow.type, // 0 = role, 1 = member
          allow: ow.allow.bitfield.toString(),
          deny: ow.deny.bitfield.toString()
        });
      });

      const channelInfo = {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        position: channel.position,
        topic: channel.topic || '',
        nsfw: channel.nsfw || false,
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        permissionOverwrites: overwrites
      };

      if (channel.type === ChannelType.GuildCategory || channel.type === 4) {
        categories.push(channelInfo);
      } else {
        // Save text, voice, forum channels
        channels.push(channelInfo);
      }
    });

    // 4. Emojis
    const emojis = [];
    guild.emojis.cache.forEach(emoji => {
      emojis.push({
        name: emoji.name,
        url: emoji.url
      });
    });

    return {
      serverSettings,
      roles,
      categories,
      channels,
      emojis
    };
  }
};

module.exports = backupService;
