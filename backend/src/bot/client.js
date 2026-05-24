const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mediaService = require('../services/mediaService');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ]
});

client.commands = new Collection();

// Load Commands Helper
const loadCommands = () => {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    console.log(`[Bot] Commands directory not found. Creating placeholder...`);
    fs.mkdirSync(commandsPath, { recursive: true });
    return;
  }

  const commandFolders = fs.readdirSync(commandsPath);
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`[Bot Warning] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }
  console.log(`[Bot] Loaded ${client.commands.size} application commands.`);
};

// Load Events Helper
const loadEvents = () => {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) {
    console.log(`[Bot] Events directory not found. Creating placeholder...`);
    fs.mkdirSync(eventsPath, { recursive: true });
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
  console.log(`[Bot] Loaded ${eventFiles.length} client events.`);
};

// Deploy commands helper (Slash Commands)
const deploySlashCommands = async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || token === 'mock_bot_token' || !clientId || clientId === '123456789012345678') {
    console.log('[Bot] Mock bot mode: skipping slash command registration (invalid token/clientId).');
    return;
  }

  const commands = [];
  client.commands.forEach(cmd => {
    commands.push(cmd.data.toJSON());
  });

  const rest = new REST().setToken(token);
  try {
    console.log(`[Bot] Started refreshing ${commands.length} application (/) commands.`);
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('[Bot] Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(`[Bot Error] Failed to register slash commands: ${error.message}`);
  }
};

const initMockBot = (client) => {
  // Set up mock bot details
  client.user = {
    id: 'mock_bot_id',
    username: 'RAGE OPTIMIZER [MOCK]',
    discriminator: '0000',
    avatar: null,
    tag: 'RAGE OPTIMIZER [MOCK]#0000',
    send: async () => {},
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
  };
  client.guilds.cache.set('mock_guild_id_1', {
    id: 'mock_guild_id_1',
    name: 'Rage Esports Tournament',
    icon: null,
    memberCount: 1420,
    channels: {
      cache: new Map([
        ['channel_general', { id: 'channel_general', name: 'general', type: 0 }],
        ['channel_welcome', { id: 'channel_welcome', name: 'welcome', type: 0 }],
        ['channel_tickets', { id: 'channel_tickets', name: 'tickets', type: 0 }],
        ['channel_logs', { id: 'channel_logs', name: 'rage-logs', type: 0 }]
      ])
    },
    roles: {
      cache: new Map([
        ['role_admin', { id: 'role_admin', name: 'Administrator', color: 16711740 }],
        ['role_staff', { id: 'role_staff', name: 'Staff Support', color: 3447003 }],
        ['role_member', { id: 'role_member', name: 'Member', color: 0 }]
      ])
    }
  });
  client.guilds.cache.set('mock_guild_id_2', {
    id: 'mock_guild_id_2',
    name: 'Rage Optimizer Free Fire Hub',
    icon: null,
    memberCount: 5231,
    channels: {
      cache: new Map([
        ['channel_general_2', { id: 'channel_general_2', name: 'lounge', type: 0 }],
        ['channel_welcome_2', { id: 'channel_welcome_2', name: 'join-leave', type: 0 }],
        ['channel_alerts', { id: 'channel_alerts', name: 'announcements', type: 0 }]
      ])
    },
    roles: {
      cache: new Map([
        ['role_owner', { id: 'role_owner', name: 'Founder', color: 16711680 }],
        ['role_vip', { id: 'role_vip', name: 'VIP Buyer', color: 16776960 }]
      ])
    }
  });
};

const startBot = () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  loadCommands();
  loadEvents();

  if (!token || token === 'mock_bot_token') {
    console.log('[Bot] No valid DISCORD_BOT_TOKEN found. Bot is running in MOCK mode.');
    initMockBot(client);
    mediaService.init(client);
    return;
  }

  client.login(token)
    .then(async () => {
      console.log(`[Bot] Connected to Discord as ${client.user.tag}`);
      mediaService.init(client);
      await deploySlashCommands();
    })
    .catch(error => {
      console.error(`[Bot Error] Login failure: ${error.message}. Running in MOCK mode.`);
      initMockBot(client);
      mediaService.init(client);
    });
};

module.exports = { client, startBot };
