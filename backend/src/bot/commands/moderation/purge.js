const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a specified number of messages in this channel')
    .addIntegerOption(option => 
      option.setName('amount')
        .setDescription('Number of messages to clear (1-100)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const { channel } = interaction;

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: '❌ Amount must be between 1 and 100.', ephemeral: true });
    }

    try {
      const deleted = await channel.bulkDelete(amount, true);
      
      const embed = new EmbedBuilder()
        .setColor('#ff003c')
        .setTitle('🧼 Channel Purged')
        .setDescription(`Successfully deleted **${deleted.size}** messages in this channel.`)
        .setFooter({ text: 'Messages older than 14 days cannot be bulk deleted.' });

      await interaction.reply({ embeds: [embed] });
      
      // Auto delete reply after 5 seconds
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    } catch (err) {
      console.error('[Purge Error] Failed to purge messages:', err);
      await interaction.reply({ content: '❌ Failed to delete messages. Make sure I have Manage Messages permission.', ephemeral: true });
    }
  }
};
