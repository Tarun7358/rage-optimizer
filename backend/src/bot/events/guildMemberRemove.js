const dbService = require('../../services/dbService');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild } = member;
    
    // Fetch settings
    let settings;
    try {
      settings = await dbService.getGuildSettings(guild.id);
    } catch (err) {
      return;
    }
    
    if (!settings || !settings.welcome) return;

    // Helper to replace custom variables in string
    const formatMessage = (str) => {
      if (!str) return "";
      return str
        .replace(/{user}/g, `${member.user.username}`)
        .replace(/{user\.mention}/g, `${member.user.username}`)
        .replace(/{server}/g, guild.name)
        .replace(/{server\.name}/g, guild.name)
        .replace(/{membercount}/g, guild.memberCount.toString());
    };

    // Log to welcome channel
    if (settings.welcome.enabled && settings.welcome.channelId) {
      const channel = guild.channels.cache.get(settings.welcome.channelId);
      if (channel) {
        const leaveEmbed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('👋 Member Left')
          .setDescription(formatMessage(`👋 **{user}** has left **{server}**. We are now down to **{membercount}** members.`))
          .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }) || 'https://cdn.discordapp.com/embed/avatars/0.png')
          .setTimestamp();
        
        await channel.send({ embeds: [leaveEmbed] }).catch(err => console.error('[Leave Error] Failed to send leave message:', err));
      }
    }
  }
};
