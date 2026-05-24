const dbService = require('../../services/dbService');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
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
        .replace(/{user}/g, `${member}`)
        .replace(/{server}/g, guild.name)
        .replace(/{membercount}/g, guild.memberCount.toString());
    };

    // 1. Welcome Channel Notification
    if (settings.welcome.enabled && settings.welcome.channelId) {
      const channel = guild.channels.cache.get(settings.welcome.channelId);
      if (channel) {
        if (settings.welcome.embed && settings.welcome.embed.enabled) {
          const embedConfig = settings.welcome.embed;
          const welcomeEmbed = new EmbedBuilder()
            .setColor(embedConfig.color || '#ff003c')
            .setTitle(formatMessage(embedConfig.title))
            .setDescription(formatMessage(embedConfig.description))
            .setTimestamp();

          if (embedConfig.imageUrl) {
            welcomeEmbed.setImage(embedConfig.imageUrl);
          }
          if (embedConfig.thumbnail) {
            welcomeEmbed.setThumbnail(member.user.displayAvatarURL({ forceStatic: false }));
          }
          
          await channel.send({ embeds: [welcomeEmbed] }).catch(err => console.error('[Welcome Error] Failed to send embed welcome:', err));
        } else {
          const text = formatMessage(settings.welcome.message);
          await channel.send(text).catch(err => console.error('[Welcome Error] Failed to send text welcome:', err));
        }
      }
    }

    // 2. Auto DM
    if (settings.welcome.autoDm && settings.welcome.dmMessage) {
      const dmText = formatMessage(settings.welcome.dmMessage);
      await member.send(dmText).catch(() => {
        // Safe fail if user has DMs closed
      });
    }

    // 3. Auto Assign Roles
    if (settings.welcome.autoRoles && settings.welcome.autoRoles.length > 0) {
      for (const roleId of settings.welcome.autoRoles) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role).catch(err => {
            console.error(`[Welcome Role Error] Failed to assign role ${role.name}:`, err.message);
          });
        }
      }
    }
  }
};
