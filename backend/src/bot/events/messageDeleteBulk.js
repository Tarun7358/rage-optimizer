const { EmbedBuilder } = require('discord.js');
const loggerService = require('../../services/loggerService');

module.exports = {
  name: 'messageDeleteBulk',
  once: false,
  async execute(messages) {
    const firstMessage = messages.first();
    if (!firstMessage || !firstMessage.guild) return;

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('🗑️ Bulk Messages Deleted')
      .addFields(
        { name: 'Channel', value: `<#${firstMessage.channel.id}>`, inline: true },
        { name: 'Count', value: `${messages.size} messages`, inline: true }
      )
      .setTimestamp();

    await loggerService.sendLog(firstMessage.guild, 'messageDeleteBulk', firstMessage.channel.id, embed);
  }
};
