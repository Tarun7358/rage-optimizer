const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Create a secure configuration backup of this server')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('Name of this backup snapshot')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('name') || `Backup - ${new Date().toLocaleDateString()}`;
    const { guild, user } = interaction;

    try {
      // Fetch current roles
      const guildRoles = [];
      guild.roles.cache.forEach(role => {
        if (role.name === '@everyone' || role.managed) return;
        guildRoles.push({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          managed: role.managed,
          mentionable: role.mentionable
        });
      });

      // Fetch current channels
      const guildChannels = [];
      guild.channels.cache.forEach(channel => {
        const overwrites = [];
        channel.permissionOverwrites.cache.forEach(ow => {
          overwrites.push({
            id: ow.id,
            type: ow.type === 0 ? 'role' : 'member',
            allow: ow.allow.bitfield.toString(),
            deny: ow.deny.bitfield.toString()
          });
        });

        guildChannels.push({
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
          position: channel.position,
          topic: channel.topic || "",
          nsfw: channel.nsfw || false,
          rateLimitPerUser: channel.rateLimitPerUser || 0,
          permissionOverwrites: overwrites
        });
      });

      // Generate random unique backup ID
      const backupId = 'RAGE_' + Math.random().toString(36).substring(2, 10).toUpperCase();

      await dbService.addBackup(guild.id, {
        backupId: backupId,
        creatorId: user.id,
        creatorName: user.username,
        name: name,
        channels: guildChannels,
        roles: guildRoles
      });

      const embed = new EmbedBuilder()
        .setColor('#ff003c')
        .setTitle('🛡️ Server Backup Created')
        .setDescription(`Successfully captured server settings snapshot. You can restore this using the Dashboard website.`)
        .addFields(
          { name: 'Backup Name', value: name, inline: true },
          { name: 'Backup ID', value: `\`${backupId}\``, inline: true },
          { name: 'Channels Saved', value: guildChannels.length.toString(), inline: true },
          { name: 'Roles Saved', value: guildRoles.length.toString(), inline: true }
        )
        .setFooter({ text: 'RAGE OPTIMIZER Auto-Backup Security Module' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('[Backup Command Error]', err);
      await interaction.editReply({ content: '❌ Failed to generate configuration backup. Please check console logs.' });
    }
  }
};
