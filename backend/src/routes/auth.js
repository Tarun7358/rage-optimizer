const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const dbService = require('../services/dbService');
const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_rage_key_999';

// POST /api/auth/discord
router.post('/discord', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'OAuth2 code is required' });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  // MOCK FLOW: Triggered if client secret is placeholder or code starts with 'mock'
  if (clientSecret === 'mock_client_secret' || code.startsWith('mock_')) {
    console.log('[Auth API] Processing mock authentication flow...');
    
    let userObj = {
      discordId: '1234567890',
      username: 'RageDeveloper',
      avatar: '0',
      isAdmin: true
    };

    try {
      let user = await dbService.getUser('1234567890');
      if (!user) {
        user = await dbService.updateUser('1234567890', userObj);
      } else {
        userObj.isAdmin = user.isAdmin;
        userObj.username = user.username;
        userObj.avatar = user.avatar;
      }
    } catch (err) {
      console.log('[Auth API Warning] Firebase is offline. Serving transient mock user.');
    }

    let firebaseToken = null;
    try {
      const { auth: adminAuth, isFirebaseMock: mockFlag } = require('../config/firebase');
      if (!mockFlag && adminAuth) {
        firebaseToken = await adminAuth.createCustomToken(userObj.discordId, { isAdmin: userObj.isAdmin });
      }
    } catch (fbErr) {
      console.warn('[Firebase Auth Token Warn]', fbErr.message);
    }

    const token = jwt.sign(
      { userId: userObj.discordId, username: userObj.username, isAdmin: userObj.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return mockup response
    return res.json({
      token,
      firebaseToken,
      user: {
        id: userObj.discordId,
        username: userObj.username,
        avatar: userObj.avatar,
        isAdmin: userObj.isAdmin
      },
      guilds: [
        {
          id: 'mock_guild_id_1',
          name: 'Rage Esports Tournament',
          icon: null,
          owner: true,
          permissions: '2147483647', // admin
          features: [],
          botJoined: true
        },
        {
          id: 'mock_guild_id_2',
          name: 'Rage Optimizer Free Fire Hub',
          icon: null,
          owner: true,
          permissions: '2147483647',
          features: [],
          botJoined: true
        },
        {
          id: 'mock_guild_id_3',
          name: 'Unconfigured Community Server',
          icon: null,
          owner: false,
          permissions: '8', // admin permission too
          features: [],
          botJoined: false
        }
      ]
    });
  }

  // PRODUCTION OAUTH2 FLOW
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });

    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Fetch user details
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const discordUser = userResponse.data;

    // Fetch user guilds
    const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const userGuilds = guildsResponse.data;

    // Save or update user in Firestore
    let user = await dbService.getUser(discordUser.id);
    const updatedData = {
      username: discordUser.username,
      avatar: discordUser.avatar || '',
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000).toISOString()
    };
    user = await dbService.updateUser(discordUser.id, updatedData);

    // Check if bot is present in guilds
    const enrichedGuilds = userGuilds.map(guild => {
      const botClient = require('../bot/client').client;
      const botJoined = botClient.guilds.cache.has(guild.id);
      
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
        permissions: guild.permissions,
        botJoined
      };
    });

    // Create Firebase Auth Custom Token
    let firebaseToken = null;
    try {
      const { auth: adminAuth, isFirebaseMock: mockFlag } = require('../config/firebase');
      if (!mockFlag && adminAuth) {
        firebaseToken = await adminAuth.createCustomToken(discordUser.id, { isAdmin: user.isAdmin || false });
      }
    } catch (fbErr) {
      console.warn('[Firebase Auth Custom Token Error]', fbErr.message);
    }

    // Create JWT
    const token = jwt.sign(
      { userId: discordUser.id, username: discordUser.username, isAdmin: user.isAdmin || false },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      firebaseToken,
      user: {
        id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar || '',
        isAdmin: user.isAdmin || false
      },
      guilds: enrichedGuilds
    });

  } catch (error) {
    console.error('[Auth API Error]', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Discord Authentication Failed' });
  }
});

module.exports = router;
