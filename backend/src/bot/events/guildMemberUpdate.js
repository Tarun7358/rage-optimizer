const { EmbedBuilder } = require('discord.js');
const loggerService = require('../../services/loggerService');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    // Check if role was added
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    if (addedRoles.size > 0) {
      for (const [roleId, role] of addedRoles) {
        const embed = new EmbedBuilder()
          .setColor('#00aaff')
          .setTitle('🛡️ Role Added')
          .setAuthor({
            name: `${newMember.user.username} (${newMember.user.id})`,
            iconURL: newMember.user.displayAvatarURL({ forceStatic: false })
          })
          .setDescription(`Added role <@&${roleId}> to <@${newMember.user.id}>.`)
          .setTimestamp();

        await loggerService.sendLog(newMember.guild, 'roleGiven', null, embed);
      }
    }

    // Check if role was removed
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
    if (removedRoles.size > 0) {
      for (const [roleId, role] of removedRoles) {
        const embed = new EmbedBuilder()
          .setColor('#0055ff')
          .setTitle('🛡️ Role Removed')
          .setAuthor({
            name: `${newMember.user.username} (${newMember.user.id})`,
            iconURL: newMember.user.displayAvatarURL({ forceStatic: false })
          })
          .setDescription(`Removed role <@&${roleId}> from <@${newMember.user.id}>.`)
          .setTimestamp();

        await loggerService.sendLog(newMember.guild, 'roleRemoved', null, embed);
      }
    }
  }
};
