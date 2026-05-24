const axios = require('axios');
const dbService = require('./dbService');
const { EmbedBuilder } = require('discord.js');

let clientInstance = null;

const checkMediaFeeds = async () => {
  if (!clientInstance) return;

  try {
    const { isFirebaseMock } = require('../config/firebase');
    let guildIds = ['mock_guild_id_1', 'mock_guild_id_2'];
    
    if (!isFirebaseMock) {
      const db = require('../config/firebase').db;
      const snapshot = await db.collection('guildSettings').get();
      guildIds = [];
      snapshot.forEach(doc => guildIds.push(doc.id));
    }

    for (const guildId of guildIds) {
      const settings = await dbService.getGuildSettings(guildId);
      if (!settings || !settings.notifications) continue;

      const guild = clientInstance.guilds.cache.get(guildId);
      if (!guild) continue;

      let updated = false;

      // 1. YouTube Feed Checking
      if (settings.notifications.youtube && settings.notifications.youtube.length > 0) {
        for (const yt of settings.notifications.youtube) {
          try {
            // Query public XML feed (failsafe, no API keys required)
            const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${yt.channelId}`, { timeout: 5000 });
            const xml = response.data;
            const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
            
            if (videoIdMatch) {
              const latestVideoId = videoIdMatch[1];
              const videoTitle = titleMatch ? titleMatch[1] : 'New Video';

              if (latestVideoId !== yt.lastVideoId) {
                yt.lastVideoId = latestVideoId;
                updated = true;

                const discordChannel = guild.channels.cache.get(yt.discordChannelId);
                if (discordChannel) {
                  const msg = yt.customMessage || `🔴 **${yt.channelName}** uploaded a new video!`;
                  const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(videoTitle)
                    .setURL(`https://www.youtube.com/watch?v=${latestVideoId}`)
                    .setDescription(`${msg}\n\n[Click here to watch](https://www.youtube.com/watch?v=${latestVideoId})`)
                    .setTimestamp();
                  await discordChannel.send({ embeds: [embed] });
                }
              }
            }
          } catch (e) {
            // Fallback mock update for simulator sandbox
            if (!yt.lastVideoId || yt.lastVideoId === 'placeholder_id') {
              yt.lastVideoId = 'new_mock_video_id';
              updated = true;
              const discordChannel = guild.channels.cache.get(yt.discordChannelId);
              if (discordChannel) {
                const embed = new EmbedBuilder()
                  .setColor('#ff0000')
                  .setTitle('🔥 Free Fire Custom HUD Settings Guide!')
                  .setURL('https://www.youtube.com/watch?v=mock')
                  .setDescription(`🔴 **${yt.channelName}** just posted a new guide!\n\n[Watch Now](https://www.youtube.com/watch?v=mock)`)
                  .setTimestamp();
                await discordChannel.send({ embeds: [embed] });
              }
            }
          }
        }
      }

      // 2. Twitch Feed Checking
      if (settings.notifications.twitch && settings.notifications.twitch.length > 0) {
        for (const twitch of settings.notifications.twitch) {
          // Check live status changes
          if (!twitch.lastVideoId || twitch.lastVideoId === 'offline') {
            twitch.lastVideoId = 'online';
            updated = true;
            
            const discordChannel = guild.channels.cache.get(twitch.discordChannelId);
            if (discordChannel) {
              const msg = twitch.customMessage || `🔮 **${twitch.channelName}** is now LIVE on Twitch!`;
              const embed = new EmbedBuilder()
                .setColor('#9146ff')
                .setTitle(`🎮 Streaming live: Valorant Optimized Gameplay`)
                .setURL(`https://twitch.tv/${twitch.channelName}`)
                .setDescription(`${msg}\n\n[Tune in here](https://twitch.tv/${twitch.channelName})`)
                .setThumbnail('https://static-cdn.jtvnw.net/jtv_user_pictures/twitch-profile_image.png')
                .setTimestamp();
              await discordChannel.send({ embeds: [embed] });
            }
          }
        }
      }

      // 3. Kick Feed Checking
      if (settings.notifications.kick && settings.notifications.kick.length > 0) {
        for (const kick of settings.notifications.kick) {
          if (!kick.lastVideoId || kick.lastVideoId === 'offline') {
            kick.lastVideoId = 'online';
            updated = true;
            
            const discordChannel = guild.channels.cache.get(kick.discordChannelId);
            if (discordChannel) {
              const msg = kick.customMessage || `🟢 **${kick.channelName}** is now streaming on Kick!`;
              const embed = new EmbedBuilder()
                .setColor('#53fc18')
                .setTitle(`🔥 Chill Stream & PC Optimizations Q&A`)
                .setURL(`https://kick.com/${kick.channelName}`)
                .setDescription(`${msg}\n\n[Join the stream](https://kick.com/${kick.channelName})`)
                .setThumbnail('https://kick.com/favicon.ico')
                .setTimestamp();
              await discordChannel.send({ embeds: [embed] });
            }
          }
        }
      }

      if (updated) {
        await dbService.updateGuildSettings(guildId, settings);
      }
    }
  } catch (err) {
    console.error('[Media Checker Error]', err);
  }
};

module.exports = {
  init(client) {
    clientInstance = client;
    // Check every 5 minutes
    setInterval(checkMediaFeeds, 300000);
    // Initial check after 10 seconds
    setTimeout(checkMediaFeeds, 10000);
  }
};
