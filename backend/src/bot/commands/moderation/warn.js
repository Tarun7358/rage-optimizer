const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a server member')
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to warn')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('The reason for this warning')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const { guild, user } = interaction;

    if (target.bot) {
      return interaction.reply({ content: '❌ You cannot warn a bot.', ephemeral: true });
    }

    // Save Warning using Firebase service layer
    await dbService.addWarning(guild.id, {
      userId: target.id,
      userName: target.username,
      warnedBy: user.id,
      warnedByName: user.username,
      reason: reason
    });

    // DM target
    await target.send(`⚠️ You have been warned in **${guild.name}**\n**Reason:** ${reason}`).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('🛡️ Member Warned')
      .addFields(
        { name: 'Target Member', value: `${target} (${target.id})`, inline: true },
        { name: 'Warned By', value: `${user}`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Send to moderation log channel if set
    try {
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
