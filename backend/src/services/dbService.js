const { db, rtdb, isFirebaseMock } = require('../config/firebase');

// In-Memory Database for Mock fallback development
const memoryDb = {
  guildSettings: {},
  warnings: [],
  tickets: [],
  backups: [],
  securityLogs: [],
  users: {}
};

// Default Settings Generator
const getDefaultSettings = (guildId) => ({
  guildId,
  welcome: {
    enabled: true,
    channelId: 'channel_welcome',
    message: 'Welcome {user} to {server}!',
    autoDm: true,
    dmMessage: 'Welcome to our gaming community!',
    autoRoles: ['role_member'],
    embed: {
      enabled: true,
      title: 'CYBERPUNK WIPE',
      description: 'A new user has entered the grid',
      color: '#ff003c',
      thumbnail: '',
      image: '',
      footer: 'Powered by RAGE'
    }
  },
  moderation: {
    autoMod: true,
    antiInvite: true,
    antiScam: true,
    antiSpam: true,
    ghostPing: true,
    logChannelId: 'channel_logs',
    badWords: ['cheat', 'hack', 'scam']
  },
  tickets: {
    enabled: true,
    categoryParent: '',
    staffRoles: ['role_staff']
  },
  security: {
    antiNuke: true,
    channelLimit: 5,
    roleLimit: 3
  },
  notifications: {
    youtube: [],
    twitch: [],
    instagram: []
  }
});

// Database Service API
const dbService = {
  // Guild Settings CRUD
  getGuildSettings: async (guildId) => {
    if (isFirebaseMock) {
      if (!memoryDb.guildSettings[guildId]) {
        memoryDb.guildSettings[guildId] = getDefaultSettings(guildId);
      }
      return memoryDb.guildSettings[guildId];
    }
    
    const docRef = db.collection('guildSettings').doc(guildId);
    const doc = await docRef.get();
    if (!doc.exists) {
      const defaultSettings = getDefaultSettings(guildId);
      await docRef.set(defaultSettings);
      return defaultSettings;
    }
    return doc.data();
  },

  updateGuildSettings: async (guildId, settings) => {
    if (isFirebaseMock) {
      memoryDb.guildSettings[guildId] = { ...memoryDb.guildSettings[guildId], ...settings };
      return memoryDb.guildSettings[guildId];
    }

    await db.collection('guildSettings').doc(guildId).set(settings, { merge: true });
    
    // Sync settings in realtime database
    try {
      await rtdb.ref(`guilds/${guildId}/settings`).set(settings);
    } catch (err) {
      console.warn('[Firebase RTDB Error] Failed to update live settings sync', err.message);
    }
    
    return settings;
  },

  // Warnings CRUD
  getWarnings: async (guildId) => {
    if (isFirebaseMock) {
      return memoryDb.warnings.filter(w => w.guildId === guildId);
    }

    const snapshot = await db.collection('warnings').where('guildId', '==', guildId).get();
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list;
  },

  addWarning: async (guildId, warnData) => {
    const formatted = {
      guildId,
      userId: warnData.userId,
      userName: warnData.userName,
      warnedBy: warnData.warnedBy,
      warnedByName: warnData.warnedByName,
      reason: warnData.reason,
      createdAt: new Date().toISOString()
    };

    let result;
    if (isFirebaseMock) {
      formatted._id = 'mock_warn_' + Math.random().toString(36).substring(7);
      memoryDb.warnings.push(formatted);
      result = formatted;
    } else {
      const docRef = await db.collection('warnings').add(formatted);
      
      // Sync warning alert to Realtime Database
      try {
        await rtdb.ref(`guilds/${guildId}/liveLogs`).push({
          type: 'WARN',
          details: `User ${warnData.userName} warned for: ${warnData.reason}`,
          timestamp: new Date().toISOString()
        });
      } catch (err) {}
      result = { _id: docRef.id, ...formatted };
    }

    // Broadcast warning added in real-time
    try {
      const socketService = require('./socketService');
      socketService.emitToGuild(guildId, 'warningAdded', result);
    } catch (err) {}

    return result;
  },

  deleteWarning: async (guildId, warnId) => {
    if (isFirebaseMock) {
      memoryDb.warnings = memoryDb.warnings.filter(w => w._id !== warnId);
    } else {
      await db.collection('warnings').doc(warnId).delete();
    }

    // Broadcast warning deleted in real-time
    try {
      const socketService = require('./socketService');
      socketService.emitToGuild(guildId, 'warningDeleted', warnId);
    } catch (err) {}

    return true;
  },

  // Tickets CRUD
  getTickets: async (guildId) => {
    if (isFirebaseMock) {
      // Create some default tickets if empty to populate the UI
      const list = memoryDb.tickets.filter(t => t.guildId === guildId);
      if (list.length === 0) {
        const defaultTickets = [
          {
            _id: 'mock_ticket_1',
            guildId,
            channelId: 'mock_channel_ticket_1',
            userId: '1234567890',
            userName: 'RageDeveloper',
            category: 'sensi',
            status: 'closed',
            closedByName: 'StaffMember',
            createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            messages: [
              { userName: 'RageDeveloper', content: 'Hey, I would like to buy the Free Fire optimization pack.', timestamp: Date.now() - 3600000 * 2.1 },
              { userName: 'StaffMember', content: 'Sure, we accept PayPal. Send payment to shop@ragefps.in.', timestamp: Date.now() - 3600000 * 2 }
            ]
          },
          {
            _id: 'mock_ticket_2',
            guildId,
            channelId: 'mock_channel_ticket_2',
            userId: '987654321',
            userName: 'ClientZero',
            category: 'optimization',
            status: 'open',
            createdAt: new Date().toISOString(),
            messages: []
          }
        ];
        memoryDb.tickets.push(...defaultTickets);
        return defaultTickets;
      }
      return list;
    }

    const snapshot = await db.collection('tickets').where('guildId', '==', guildId).get();
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list;
  },

  getTicketByChannelId: async (channelId) => {
    if (isFirebaseMock) {
      return memoryDb.tickets.find(t => t.channelId === channelId) || null;
    }

    const snapshot = await db.collection('tickets').where('channelId', '==', channelId).limit(1).get();
    if (snapshot.empty) return null;
    let ticket = null;
    snapshot.forEach(doc => {
      ticket = { _id: doc.id, ...doc.data() };
    });
    return ticket;
  },

  addTicket: async (guildId, ticketData) => {
    const formatted = {
      guildId,
      channelId: ticketData.channelId,
      userId: ticketData.userId,
      userName: ticketData.userName,
      category: ticketData.category,
      status: ticketData.status || 'open',
      claimedBy: ticketData.claimedBy || null,
      claimedByName: ticketData.claimedByName || null,
      closedByName: null,
      messages: ticketData.messages || [],
      createdAt: new Date().toISOString()
    };

    let result;
    if (isFirebaseMock) {
      formatted._id = 'mock_ticket_' + Math.random().toString(36).substring(7);
      memoryDb.tickets.push(formatted);
      result = formatted;
    } else {
      const docRef = await db.collection('tickets').add(formatted);

      // Sync in Realtime Database for instant ticket updates
      try {
        await rtdb.ref(`guilds/${guildId}/tickets/${docRef.id}`).set(formatted);
      } catch (err) {}

      result = { _id: docRef.id, ...formatted };
    }

    // Broadcast ticket added in real-time
    try {
      const socketService = require('./socketService');
      socketService.emitToGuild(guildId, 'ticketAdded', result);
    } catch (err) {}

    return result;
  },

  updateTicket: async (ticketId, updateData) => {
    let result = null;
    if (isFirebaseMock) {
      const idx = memoryDb.tickets.findIndex(t => t._id === ticketId);
      if (idx !== -1) {
        memoryDb.tickets[idx] = { ...memoryDb.tickets[idx], ...updateData };
        result = memoryDb.tickets[idx];
      }
    } else {
      await db.collection('tickets').doc(ticketId).update(updateData);
      
      // Fetch updated ticket to sync with RTDB
      const updatedDoc = await db.collection('tickets').doc(ticketId).get();
      const updated = updatedDoc.data();
      if (updated) {
        try {
          await rtdb.ref(`guilds/${updated.guildId}/tickets/${ticketId}`).set(updated);
        } catch (err) {}
        result = { _id: ticketId, ...updated };
      }
    }

    if (result) {
      // Broadcast ticket updated in real-time
      try {
        const socketService = require('./socketService');
        socketService.emitToGuild(result.guildId, 'ticketUpdated', result);
      } catch (err) {}
    }

    return result;
  },

  // Backups CRUD
  getBackups: async (guildId) => {
    if (isFirebaseMock) {
      const list = memoryDb.backups.filter(b => b.guildId === guildId);
      if (list.length === 0) {
        const defaultBackups = [
          {
            _id: 'mock_backup_1',
            guildId,
            backupId: 'RAGE_A9B8C7D6',
            creatorId: '1234567890',
            creatorName: 'RageDeveloper',
            name: 'Post-Setup Snapshot (Base)',
            channels: [
              { name: 'general', type: 0 },
              { name: 'rules', type: 0 },
              { name: 'tickets', type: 0 },
              { name: 'voice-chat', type: 2 }
            ],
            roles: [
              { name: 'Administrator', permissions: '8' },
              { name: 'Staff Support', permissions: '0' }
            ],
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ];
        memoryDb.backups.push(...defaultBackups);
        return defaultBackups;
      }
      return list;
    }

    const snapshot = await db.collection('backups').where('guildId', '==', guildId).get();
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list;
  },

  getBackupById: async (guildId, backupId) => {
    if (isFirebaseMock) {
      return memoryDb.backups.find(b => b.guildId === guildId && b.backupId === backupId) || null;
    }

    const snapshot = await db.collection('backups')
      .where('guildId', '==', guildId)
      .where('backupId', '==', backupId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    let backup = null;
    snapshot.forEach(doc => {
      backup = doc.data();
    });
    return backup;
  },

  addBackup: async (guildId, backupData) => {
    const formatted = {
      guildId,
      backupId: backupData.backupId,
      creatorId: backupData.creatorId,
      creatorName: backupData.creatorName,
      name: backupData.name,
      channels: backupData.channels,
      roles: backupData.roles,
      createdAt: new Date().toISOString()
    };

    let result;
    if (isFirebaseMock) {
      formatted._id = 'mock_backup_' + Math.random().toString(36).substring(7);
      memoryDb.backups.push(formatted);
      result = formatted;
    } else {
      const docRef = await db.collection('backups').add(formatted);
      result = { _id: docRef.id, ...formatted };
    }

    try {
      const socketService = require('./socketService');
      socketService.emitToGuild(guildId, 'backupAdded', result);
    } catch (err) {}

    return result;
  },

  // Security Logs CRUD
  getSecurityLogs: async (guildId) => {
    if (isFirebaseMock) {
      const list = memoryDb.securityLogs.filter(l => l.guildId === guildId);
      if (list.length === 0) {
        const defaultLogs = [
          {
            _id: 'mock_sec_log_1',
            guildId,
            action: 'ANTI_NUKE_PREVENT',
            executorId: '987654321',
            executorName: 'CompromisedStaff',
            severity: 'critical',
            details: 'Prevented rapid deletion of channel: #general (Anti-nuke limit hit)',
            createdAt: new Date().toISOString()
          },
          {
            _id: 'mock_sec_log_2',
            guildId,
            action: 'BACKUP_CREATE',
            executorId: '1234567890',
            executorName: 'RageDeveloper',
            severity: 'info',
            details: 'Created server configuration backup: Post-Setup Snapshot (Base) (RAGE_A9B8C7D6)',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ];
        memoryDb.securityLogs.push(...defaultLogs);
        return defaultLogs;
      }
      return list;
    }

    const snapshot = await db.collection('securityLogs')
      .where('guildId', '==', guildId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list;
  },

  addSecurityLog: async (guildId, logData) => {
    const formatted = {
      guildId,
      action: logData.action,
      executorId: logData.executorId,
      executorName: logData.executorName,
      severity: logData.severity || 'info',
      details: logData.details,
      createdAt: new Date().toISOString()
    };

    let result;
    if (isFirebaseMock) {
      formatted._id = 'mock_log_' + Math.random().toString(36).substring(7);
      memoryDb.securityLogs.push(formatted);
      result = formatted;
    } else {
      const docRef = await db.collection('securityLogs').add(formatted);
      
      // Sync live log warning to Realtime Database
      try {
        await rtdb.ref(`guilds/${guildId}/liveLogs`).push(formatted);
      } catch (err) {}

      result = { _id: docRef.id, ...formatted };
    }

    try {
      const socketService = require('./socketService');
      socketService.emitToGuild(guildId, 'securityLogAdded', result);
    } catch (err) {}

    return result;
  },

  // User Session CRUD
  getUser: async (userId) => {
    if (isFirebaseMock) {
      return memoryDb.users[userId] || null;
    }

    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    return doc.data();
  },

  updateUser: async (userId, userData) => {
    if (isFirebaseMock) {
      memoryDb.users[userId] = { ...memoryDb.users[userId], ...userData, discordId: userId };
      return memoryDb.users[userId];
    }

    await db.collection('users').doc(userId).set(userData, { merge: true });
    return userData;
  },

  // Polls CRUD
  getPoll: async (pollId) => {
    if (isFirebaseMock) {
      if (!memoryDb.polls) memoryDb.polls = {};
      return memoryDb.polls[pollId] || null;
    }
    const doc = await db.collection('polls').doc(pollId).get();
    return doc.exists ? doc.data() : null;
  },

  savePoll: async (pollId, pollData) => {
    if (isFirebaseMock) {
      if (!memoryDb.polls) memoryDb.polls = {};
      memoryDb.polls[pollId] = pollData;
      return pollData;
    }
    await db.collection('polls').doc(pollId).set(pollData);
    return pollData;
  },

  // Stats Metrics aggregations
  getGlobalCounts: async () => {
    if (isFirebaseMock) {
      return {
        ticketsCount: 1542,
        activeTicketsCount: 8,
        warningsCount: 421
      };
    }

    try {
      // In firestore, counts are fetched via collection metadata or queries
      const ticketsSnap = await db.collection('tickets').get();
      const activeTicketsSnap = await db.collection('tickets').where('status', 'in', ['open', 'claimed']).get();
      const warningsSnap = await db.collection('warnings').get();

      return {
        ticketsCount: ticketsSnap.size,
        activeTicketsCount: activeTicketsSnap.size,
        warningsCount: warningsSnap.size
      };
    } catch (err) {
      return { ticketsCount: 1542, activeTicketsCount: 8, warningsCount: 421 };
    }
  }
};

module.exports = dbService;
