const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout/Mute a member in the server')
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to timeout')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .addChoices(
          { name: '60 Seconds', value: 1 },
          { name: '5 Minutes', value: 5 },
          { name: '10 Minutes', value: 10 },
          { name: '1 Hour', value: 60 },
          { name: '1 Day', value: 1440 },
          { name: '1 Week', value: 10080 }
        ))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('The reason for timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const { guild, user } = interaction;

    if (target.id === user.id) {
      return interaction.reply({ content: '❌ You cannot timeout yourself.', ephemeral: true });
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: '❌ I cannot moderate this member. They might have a higher role than me or admin permissions.', ephemeral: true });
    }

    const durationMs = duration * 60 * 1000;

    // DM target
    await target.send(`⚠️ You have been timed out in **${guild.name}** for **${duration} minutes**\n**Reason:** ${reason}`).catch(() => {});

    // Perform Timeout
    await member.timeout(durationMs, `Timed out by ${user.username}: ${reason}`);

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('⏱️ Member Timed Out')
      .addFields(
        { name: 'Target Member', value: `${target} (${target.id})`, inline: true },
        { name: 'Muted By', value: `${user}`, inline: true },
        { name: 'Duration', value: `${duration} minutes`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Log to DB and logChannel
    try {
      await dbService.addSecurityLog(guild.id, {
        action: 'MEMBER_TIMEOUT',
        executorId: user.id,
        executorName: user.username,
        severity: 'warning',
        details: `Timed out ${target.username} (${target.id}) for ${duration}m. Reason: ${reason}`
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
