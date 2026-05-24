const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[Bot Ready] Active and serving ${client.guilds.cache.size} guilds.`);
    
    // Set premium gaming-related status activity
    client.user.setPresence({
      activities: [{ name: 'Rage Optimizer | /help', type: ActivityType.Playing }],
      status: 'dnd',
    });
  },
};
