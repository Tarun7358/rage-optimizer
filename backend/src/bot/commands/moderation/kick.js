const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to kick')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('The reason for kicking')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  
  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const { guild, user } = interaction;

    if (target.id === user.id) {
      return interaction.reply({ content: '❌ You cannot kick yourself.', ephemeral: true });
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: '❌ I cannot kick this member. They might have a higher role than me or admin permissions.', ephemeral: true });
    }

    // DM target
    await target.send(`🚨 You have been kicked from **${guild.name}**\n**Reason:** ${reason}`).catch(() => {});

    // Perform Kick
    await member.kick(`Kicked by ${user.username}: ${reason}`);

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('👢 Member Kicked')
      .addFields(
        { name: 'Target Member', value: `${target} (${target.id})`, inline: true },
        { name: 'Kicked By', value: `${user}`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Log to DB and logChannel
    try {
      await dbService.addSecurityLog(guild.id, {
        action: 'MEMBER_KICK',
        executorId: user.id,
        executorName: user.username,
        severity: 'warning',
        details: `Kicked member ${target.username} (${target.id}). Reason: ${reason}`
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
