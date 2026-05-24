const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const dbService = require('../../services/dbService');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[Command Error] Error executing ${interaction.commandName}:`, error);
        const errorEmbed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('⚠️ Command Execution Error')
          .setDescription('There was an error while executing this command. Please try again later.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }
    } else if (interaction.isButton()) {
      const customId = interaction.customId;
      const { guild, user, channel } = interaction;

      // Handle ticket creation panel buttons
      if (customId.startsWith('ticket_open:')) {
        await interaction.deferReply({ ephemeral: true });
        const category = customId.split(':')[1]; // buy, support, optimization, sensi, scam

        // Find Guild Settings
        let settings;
        try {
          settings = await dbService.getGuildSettings(guild.id);
        } catch (err) {
          return interaction.editReply({ content: '❌ Failed to read server database configurations.' });
        }

        // Create channel
        try {
          const parentId = settings.tickets.categoryParent || null;
          const staffRoles = settings.tickets.staffRoles || [];
          
          // Define permission overwrites
          const permissionOverwrites = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            }
          ];

          // Add staff roles permissions
          staffRoles.forEach(roleId => {
            permissionOverwrites.push({
              id: roleId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            });
          });

          const ticketChannel = await guild.channels.create({
            name: `${category}-${user.username}`,
            type: ChannelType.GuildText,
            parent: parentId,
            permissionOverwrites
          });

          // Save Ticket in Firestore DB
          await dbService.addTicket(guild.id, {
            channelId: ticketChannel.id,
            userId: user.id,
            userName: user.username,
            category: category,
            status: 'open'
          });

          // Send Ticket Panel to the new channel
          const ticketEmbed = new EmbedBuilder()
            .setColor('#ff003c')
            .setTitle(`Ticket: ${category.toUpperCase()} - ${user.username}`)
            .setDescription(`Welcome ${user} to your ticket support channel. A staff member will be with you shortly.\nPlease describe your query in detail.`)
            .addFields(
              { name: 'Category', value: category.toUpperCase(), inline: true },
              { name: 'Status', value: '🟢 OPEN', inline: true }
            )
            .setFooter({ text: 'RAGE OPTIMIZER Ticket System' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
          );

          await ticketChannel.send({
            content: `${user} | <@&${staffRoles[0] || ''}>`,
            embeds: [ticketEmbed],
            components: [row]
          });

          await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });

        } catch (err) {
          console.error('[Ticket Error] Failed to create channel:', err);
          await interaction.editReply({ content: '❌ Failed to create support ticket. Please verify my permissions.' });
        }
      }

      // Handle Ticket Actions (Claim, Close)
      if (customId === 'ticket_claim') {
        const ticket = await dbService.getTicketByChannelId(channel.id);
        if (!ticket) {
          return interaction.reply({ content: '❌ Ticket record not found in database.', ephemeral: true });
        }

        if (ticket.status === 'claimed') {
          return interaction.reply({ content: `❌ This ticket has already been claimed by ${ticket.claimedByName || 'another agent'}.`, ephemeral: true });
        }

        await dbService.updateTicket(ticket._id, {
          status: 'claimed',
          claimedBy: user.id,
          claimedByName: user.username
        });

        const claimEmbed = new EmbedBuilder()
          .setColor('#00ff3c')
          .setTitle('🎫 Ticket Claimed')
          .setDescription(`This ticket is now being handled by **${user.username}**.`);
        
        await interaction.reply({ embeds: [claimEmbed] });
      }

      if (customId === 'ticket_close') {
        await interaction.deferReply();
        const ticket = await dbService.getTicketByChannelId(channel.id);
        if (!ticket) {
          return interaction.editReply({ content: '❌ Ticket record not found in database.' });
        }

        const updateFields = {
          status: 'closed',
          closedAt: new Date().toISOString(),
          closedBy: user.id,
          closedByName: user.username
        };

        // Fetch messages for transcript
        try {
          const messages = await channel.messages.fetch({ limit: 100 });
          const chatLog = [];
          messages.reverse().forEach(msg => {
            if (msg.author.bot && msg.embeds.length > 0) return;
            chatLog.push({
              userId: msg.author.id,
              userName: msg.author.username,
              avatar: msg.author.displayAvatarURL(),
              content: msg.content || '',
              timestamp: msg.createdAt.toISOString()
            });
          });
          updateFields.messages = chatLog;

          // Generate HTML file and upload to Supabase Storage transcripts bucket
          const fullTicketObj = { ...ticket, ...updateFields };
          const htmlContent = generateTranscriptHtml(fullTicketObj);
          const transcriptFileName = `${ticket._id}_transcript.html`;
          
          const storageService = require('../../services/storageService');
          const uploadResult = await storageService.uploadFile(
            'transcripts',
            Buffer.from(htmlContent, 'utf-8'),
            transcriptFileName,
            'text/html'
          );
          
          updateFields.transcriptUrl = uploadResult.publicUrl;
          console.log(`[Tickets] Saved transcript file successfully to Supabase Storage: ${uploadResult.publicUrl}`);
        } catch (err) {
          console.error('[Transcript Error] Could not fetch messages or upload transcript:', err);
        }

        await dbService.updateTicket(ticket._id, updateFields);

        const closeEmbed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('🔒 Ticket Closed')
          .setDescription('This ticket is now closed and will be deleted in 5 seconds.');

        await interaction.editReply({ embeds: [closeEmbed] });

        setTimeout(async () => {
          try {
            await channel.delete();
          } catch (e) {
            console.error('[Ticket Delete Error] Failed to delete channel:', e);
          }
        }, 5000);
      }

      // Handle Poll Vote clicks
      if (customId.startsWith('poll_vote:')) {
        await interaction.deferReply({ ephemeral: true });
        const [_, pollId, optionIdxStr] = customId.split(':');
        const optionIdx = parseInt(optionIdxStr);

        try {
          const poll = await dbService.getPoll(pollId);
          if (!poll) {
            return interaction.editReply({ content: '❌ Poll not found in database.' });
          }

          // Initialize user votes tracking if missing
          if (!poll.votes) poll.votes = {};

          const userId = user.id;
          const previousVote = poll.votes[userId];

          if (previousVote !== undefined) {
            if (previousVote === optionIdx) {
              // Unvote
              delete poll.votes[userId];
              await interaction.editReply({ content: '🗳️ Removed your vote from this poll.' });
            } else {
              // Change vote
              poll.votes[userId] = optionIdx;
              await interaction.editReply({ content: `🗳️ Changed your vote to Option ${['A', 'B', 'C', 'D'][optionIdx]}.` });
            }
          } else {
            // New vote
            poll.votes[userId] = optionIdx;
            await interaction.editReply({ content: `🗳️ Voted for Option ${['A', 'B', 'C', 'D'][optionIdx]}!` });
          }

          // Recalculate options votesCount
          const totalVotes = Object.keys(poll.votes).length;
          poll.options.forEach(opt => {
            opt.votesCount = Object.values(poll.votes).filter(v => v === opt.index).length;
          });

          // Update database
          await dbService.savePoll(pollId, poll);

          // Rebuild description and progress bars
          const letters = ['A', 'B', 'C', 'D'];
          const description = poll.options.map((opt, idx) => {
            const pct = totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0;
            
            // Progress bar calculation (10 blocks total)
            const blockCount = Math.round(pct / 10);
            const filled = '█'.repeat(blockCount);
            const empty = '░'.repeat(10 - blockCount);
            
            return `**Option ${letters[idx]}**: ${opt.label}\n${filled}${empty} ${pct}% (${opt.votesCount} votes)`;
          }).join('\n\n');

          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(description)
            .setFooter({ text: `Created by ${poll.creatorName} | Total Votes: ${totalVotes}` });

          await interaction.message.edit({ embeds: [updatedEmbed] });
        } catch (err) {
          console.error('[Poll Interaction Error]', err);
          await interaction.editReply({ content: '❌ Failed to process your vote.' });
        }
      }
    }
  },
};

function generateTranscriptHtml(ticket) {
  let messagesHtml = (ticket.messages || []).map(msg => {
    const avatarUrl = msg.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const formattedDate = new Date(msg.timestamp).toLocaleString();
    return `
      <div class="message-row">
        <img src="${avatarUrl}" class="avatar" alt="avatar" />
        <div class="message-body">
          <div class="message-header">
            <span class="username">${msg.userName}</span>
            <span class="timestamp">${formattedDate}</span>
          </div>
          <div class="message-content">${escapeHtml(msg.content)}</div>
        </div>
      </div>
    `;
  }).join('');

  if (!ticket.messages || ticket.messages.length === 0) {
    messagesHtml = `<div class="empty-state">No messages were sent in this ticket.</div>`;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Ticket Transcript - ${ticket.category.toUpperCase()}-${ticket.userName}</title>
      <style>
        body {
          background-color: #0d0e12;
          color: #dcddde;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background-color: #18191d;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #2f3136;
        }
        .header {
          background-color: #ff003c;
          padding: 20px;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .metadata {
          margin-top: 10px;
          font-size: 14px;
          opacity: 0.85;
        }
        .chat-area {
          padding: 20px;
        }
        .message-row {
          display: flex;
          margin-bottom: 20px;
          align-items: flex-start;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          margin-right: 15px;
        }
        .message-body {
          display: flex;
          flex-direction: column;
        }
        .message-header {
          margin-bottom: 5px;
        }
        .username {
          font-weight: bold;
          color: #ffffff;
          margin-right: 10px;
        }
        .timestamp {
          font-size: 12px;
          color: #72767d;
        }
        .message-content {
          font-size: 15px;
          line-height: 1.4;
          word-break: break-word;
        }
        .empty-state {
          text-align: center;
          color: #72767d;
          padding: 40px 0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #4f545c;
          border-top: 1px solid #2f3136;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RAGE OPTIMIZER Support Transcript</h1>
          <div class="metadata">
            <strong>Category:</strong> ${ticket.category.toUpperCase()} | 
            <strong>Opened By:</strong> ${ticket.userName} (${ticket.userId}) | 
            <strong>Closed By:</strong> ${ticket.closedByName || 'System'}
          </div>
        </div>
        <div class="chat-area">
          ${messagesHtml}
        </div>
        <div class="footer">
          Transcript generated by RAGE OPTIMIZER Bot - bot.ragefps.in
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
