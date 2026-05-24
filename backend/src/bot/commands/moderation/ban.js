const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to ban')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('The reason for banning')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  
  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const { guild, user } = interaction;

    if (target.id === user.id) {
      return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ I cannot ban this member. They might have a higher role than me or admin permissions.', ephemeral: true });
    }

    // DM target
    await target.send(`🚨 You have been banned from **${guild.name}**\n**Reason:** ${reason}`).catch(() => {});

    // Perform Ban
    await guild.members.ban(target, { reason: `Banned by ${user.username}: ${reason}` });

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'Target Member', value: `${target} (${target.id})`, inline: true },
        { name: 'Banned By', value: `${user}`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Log to DB and logChannel
    try {
      await dbService.addSecurityLog(guild.id, {
        action: 'MEMBER_BAN',
        executorId: user.id,
        executorName: user.username,
        severity: 'warning',
        details: `Banned member ${target.username} (${target.id}). Reason: ${reason}`
      });

      const settings = await dbService.getGuildSettings(guild.id);
      if (settings && settings.moderation && settings.moderation.logChannelId) {
        const logChannel = guild.channels.cache.get(settings.moderation.logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      }
    } catch (err) {}
  }
};
