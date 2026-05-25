const { EmbedBuilder } = require('discord.js');
const loggerService = require('../../services/loggerService');

module.exports = {
  name: 'messageUpdate',
  once: false,
  async execute(oldMessage, newMessage) {
    if (newMessage.partial) {
      try {
        await newMessage.fetch();
      } catch (err) {
        return;
      }
    }
    
    if (newMessage.author?.bot) return;
    if (!newMessage.guild) return;

    // Handle pin/unpin check
    if (oldMessage.pinned !== undefined && oldMessage.pinned !== newMessage.pinned) {
      const isPinned = newMessage.pinned;
      const eventKey = isPinned ? 'messagePin' : 'messageUnpin';
      
      const embed = new EmbedBuilder()
        .setColor('#00aaff')
        .setTitle(isPinned ? '📌 Message Pinned' : '📍 Message Unpinned')
        .setAuthor({
          name: `${newMessage.author.username} (${newMessage.author.id})`,
          iconURL: newMessage.author.displayAvatarURL({ forceStatic: false })
        })
        .setDescription(`A message by <@${newMessage.author.id}> was ${isPinned ? 'pinned' : 'unpinned'} in <#${newMessage.channel.id}>.`)
        .addFields({ name: 'Content', value: newMessage.content || '*No text content*' })
        .setTimestamp();

      await loggerService.sendLog(newMessage.guild, eventKey, newMessage.channel.id, embed);
      return;
    }

    // Handle normal content edits
    if (oldMessage.content !== newMessage.content) {
      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('✏️ Message Edited')
        .setAuthor({
          name: `${newMessage.author.username} (${newMessage.author.id})`,
          iconURL: newMessage.author.displayAvatarURL({ forceStatic: false })
        })
        .addFields(
          { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
          { name: 'Author', value: `<@${newMessage.author.id}>`, inline: true },
          { name: 'Before', value: oldMessage.content || '*No text content*' },
          { name: 'After', value: newMessage.content || '*No text content*' }
        )
        .setTimestamp();

      await loggerService.sendLog(newMessage.guild, 'messageEdit', newMessage.channel.id, embed);
    }
  }
};
