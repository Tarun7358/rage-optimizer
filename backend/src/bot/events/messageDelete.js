const { EmbedBuilder } = require('discord.js');
const loggerService = require('../../services/loggerService');

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(message) {
    if (message.partial) return;
    if (message.author?.bot) return;
    if (!message.guild) return;

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle('🗑️ Message Deleted')
      .setAuthor({
        name: `${message.author.username} (${message.author.id})`,
        iconURL: message.author.displayAvatarURL({ forceStatic: false })
      })
      .addFields(
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Author', value: `<@${message.author.id}>`, inline: true },
        { name: 'Content', value: message.content || '*No text content (likely media/embed)*' }
      )
      .setTimestamp();

    await loggerService.sendLog(message.guild, 'messageDelete', message.channel.id, embed);
  }
};
