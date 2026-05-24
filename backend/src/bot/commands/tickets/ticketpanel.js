const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Publish the Ticket creation panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guild, channel } = interaction;

    // Find guild settings
    try {
      await dbService.getGuildSettings(guild.id);
    } catch (err) {}

    const panelEmbed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('🎫 RAGE OPTIMIZER Support Hub')
      .setDescription('Select a category below to open a support ticket. Our team is online and ready to assist you!\n\n' +
        '🚀 **Optimization Service** - Get your PC boosted and fine-tuned for gaming.\n' +
        '🎯 **Sensi Purchase** - Purchase custom, high-precision Free Fire sensitivities.\n' +
        '🛒 **Shop & Buy** - Buy premium optimization packages.\n' +
        '🛡️ **Support / Help** - Query about features, configurations or licensing.\n' +
        '⚠️ **Scam Report** - File a report against malicious activities.')
      .setThumbnail(guild.iconURL() || null)
      .setFooter({ text: 'Rage Optimizer - Fast & Secure Assistance' });

    // Row 1 Buttons
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open:optimization').setLabel('Optimization Ticket').setStyle(ButtonStyle.Primary).setEmoji('🚀'),
      new ButtonBuilder().setCustomId('ticket_open:sensi').setLabel('Sensi Purchase').setStyle(ButtonStyle.Success).setEmoji('🎯'),
      new ButtonBuilder().setCustomId('ticket_open:buy').setLabel('Buy Package').setStyle(ButtonStyle.Secondary).setEmoji('🛒')
    );

    // Row 2 Buttons
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open:support').setLabel('General Support').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('ticket_open:scam').setLabel('Scam Report').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
    );

    await channel.send({ embeds: [panelEmbed], components: [row1, row2] });

    await interaction.reply({ content: '✅ Ticket panel successfully deployed here!', ephemeral: true });
  }
};
