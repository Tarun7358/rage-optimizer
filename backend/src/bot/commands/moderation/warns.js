const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription("View a server member's warnings")
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to view warnings for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const { guild } = interaction;

    await interaction.deferReply();

    try {
      const allWarnings = await dbService.getWarnings(guild.id);
      const userWarnings = allWarnings.filter(w => w.userId === target.id);

      if (userWarnings.length === 0) {
        return interaction.editReply({ content: `✅ **${target.username}** has clean records (0 warnings).` });
      }

      const embed = new EmbedBuilder()
        .setColor('#ff003c')
        .setTitle(`⚠️ Warnings Log - ${target.username}`)
        .setDescription(`Showing all active warning records for ${target}`)
        .setThumbnail(target.displayAvatarURL() || 'https://cdn.discordapp.com/embed/avatars/0.png')
        .setTimestamp();

      userWarnings.slice(0, 10).forEach((w, index) => {
        embed.addFields({
          name: `Warning #${index + 1} - ${w.reason}`,
          value: `**Warned By:** <@${w.warnedBy}> | **Date:** ${new Date(w.createdAt).toLocaleDateString()}`
        });
      });

      if (userWarnings.length > 10) {
        embed.setFooter({ text: `Showing top 10 of ${userWarnings.length} warnings. Manage remaining in Web Dashboard.` });
      } else {
        embed.setFooter({ text: `Total warnings: ${userWarnings.length}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Failed to read warnings database logs.' });
    }
  }
};
