const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../services/dbService');

// GET /api/tickets/:guildId - Retrieve list of tickets + analytics
router.get('/:guildId', authMiddleware, async (req, res) => {
  const { guildId } = req.params;

  try {
    const tickets = await dbService.getTickets(guildId);

    // Calculate quick stats
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open').length;
    const claimed = tickets.filter(t => t.status === 'claimed').length;
    const closed = tickets.filter(t => t.status === 'closed').length;

    // Categories breakdown
    const categories = { buy: 0, support: 0, optimization: 0, sensi: 0, scam: 0 };
    tickets.forEach(t => {
      if (categories[t.category] !== undefined) {
        categories[t.category]++;
      }
    });

    res.json({
      tickets,
      stats: { total, open, claimed, closed },
      categories
    });
  } catch (error) {
    console.error('[Ticket API Error]', error);
    res.status(500).json({ error: 'Failed to retrieve ticket logs' });
  }
});

// GET /api/tickets/transcript/:channelId - HTML/JSON render of ticket chat log
router.get('/transcript/:channelId', async (req, res) => {
  const { channelId } = req.params;

  try {
    const ticket = await dbService.getTicketByChannelId(channelId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket transcript not found' });
    }

    // Check if client requested raw JSON
    if (req.query.format === 'json') {
      return res.json(ticket);
    }

    // Build responsive HTML transcript
    let messagesHtml = ticket.messages.map(msg => {
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

    if (ticket.messages.length === 0) {
      messagesHtml = `<div class="empty-state">No messages were sent in this ticket.</div>`;
    }

    const htmlResponse = `
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

    res.header('Content-Type', 'text/html');
    res.send(htmlResponse);

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate transcript' });
  }
});

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = router;
