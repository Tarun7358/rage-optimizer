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
    channelId: '',
    message: 'Welcome {user} to **{server}**!',
    autoDm: false,
    dmMessage: 'Welcome to our gaming community!',
    autoRoles: [],
    embed: {
      enabled: true,
      title: '📥 Welcome to the server!',
      description: '{user} You Are the {membercount} Member\n\nFollow our Server Rules <#1507674485518630963>',
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
    logChannelId: '',
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
  },
  autoNick: {
    enabled: false,
    format: '[RAGE] {username}'
  },
  tempVoice: {
    enabled: false,
    channelId: '',
    categoryParent: ''
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
    
    // Sync settings in realtime database (non-blocking)
    if (rtdb) {
      rtdb.ref(`guilds/${guildId}/settings`).set(settings).catch(err => {
        console.warn('[Firebase RTDB Error] Failed to update live settings sync', err.message);
      });
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
      
      // Sync warning alert to Realtime Database (non-blocking)
      if (rtdb) {
        rtdb.ref(`guilds/${guildId}/liveLogs`).push({
          type: 'WARN',
          details: `User ${warnData.userName} warned for: ${warnData.reason}`,
          timestamp: new Date().toISOString()
        }).catch(() => {});
      }
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

      // Sync in Realtime Database for instant ticket updates (non-blocking)
      if (rtdb) {
        rtdb.ref(`guilds/${guildId}/tickets/${docRef.id}`).set(formatted).catch(() => {});
      }

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
        if (rtdb) {
          rtdb.ref(`guilds/${updated.guildId}/tickets/${ticketId}`).set(updated).catch(() => {});
        }
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
            ownerId: '1234567890',
            creatorId: '1234567890',
            creatorName: 'RageDeveloper',
            backupName: 'Post-Setup Snapshot (Base)',
            name: 'Post-Setup Snapshot (Base)',
            backupData: {
              channels: [
                { name: 'general', type: 0, position: 1 },
                { name: 'rules', type: 0, position: 0 },
                { name: 'tickets', type: 0, position: 2 },
                { name: 'voice-chat', type: 2, position: 3 }
              ],
              roles: [
                { name: 'Administrator', permissions: '8', color: 16711740, hoist: true, position: 1 },
                { name: 'Staff Support', permissions: '0', color: 3447003, hoist: true, position: 2 }
              ],
              categories: [],
              emojis: [],
              serverSettings: { name: 'Rage Esports Tournament', verificationLevel: 1 }
            },
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ];
        memoryDb.backups.push(...defaultBackups);
        return defaultBackups;
      }
      // Sort by newest first
      return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const snapshot = await db.collection('backups').where('guildId', '==', guildId).get();
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      backup = { _id: doc.id, ...doc.data() };
    });
    return backup;
  },

  addBackup: async (guildId, backupData) => {
    const formatted = {
      guildId,
      backupId: backupData.backupId,
      ownerId: backupData.ownerId || '',
      creatorId: backupData.creatorId,
      creatorName: backupData.creatorName,
      backupName: backupData.backupName || backupData.name || `Backup - ${new Date().toLocaleDateString()}`,
      name: backupData.backupName || backupData.name || `Backup - ${new Date().toLocaleDateString()}`,
      backupData: backupData.backupData || {
        channels: backupData.channels || [],
        roles: backupData.roles || [],
        categories: backupData.categories || [],
        emojis: backupData.emojis || [],
        serverSettings: backupData.serverSettings || {}
      },
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

  deleteBackup: async (guildId, backupId) => {
    if (isFirebaseMock) {
      memoryDb.backups = memoryDb.backups.filter(b => !(b.guildId === guildId && b.backupId === backupId));
      return true;
    }

    const snapshot = await db.collection('backups')
      .where('guildId', '==', guildId)
      .where('backupId', '==', backupId)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    try {
      const socketService = require('./socketService');
      socketService.emitToGuild(guildId, 'backupDeleted', backupId);
    } catch (err) {}

    return true;
  },

  // Templates CRUD
  getTemplates: async (options = {}) => {
    if (isFirebaseMock) {
      if (!memoryDb.templates) {
        memoryDb.templates = [
          {
            _id: 'mock_template_1',
            templateId: 'rage-scrim-v1',
            name: 'Rage Scrim Tournament',
            description: 'Esports tournament configuration with automatic scrim registration and lobby voice channels.',
            creatorId: '1234567890',
            creatorName: 'RageDeveloper',
            isPublic: true,
            category: 'Esports',
            tags: ['scrim', 'tournament', 'esports'],
            installCount: 120,
            downloadCount: 300,
            createdAt: new Date().toISOString(),
            backupData: {
              channels: [
                { name: 'information', type: 4, position: 0 },
                { name: 'announcements', type: 0, position: 1, parentName: 'information' },
                { name: 'registration', type: 0, position: 2, parentName: 'information' },
                { name: 'scrims-lobby', type: 2, position: 3 }
              ],
              roles: [
                { name: 'Organizer', color: 16711740, position: 1, permissions: '8' },
                { name: 'Player', color: 3447003, position: 2, permissions: '0' }
              ],
              categories: [
                { name: 'information', type: 4, position: 0 }
              ],
              emojis: [],
              serverSettings: { name: 'Rage Esports Tournament', verificationLevel: 1 }
            }
          },
          {
            _id: 'mock_template_2',
            templateId: 'rage-market-v2',
            name: 'Rage Marketplace Layout',
            description: 'Premium store layout containing product channels, reviews, support tickets, and staff roles.',
            creatorId: '1234567890',
            creatorName: 'RageDeveloper',
            isPublic: true,
            category: 'Marketplace',
            tags: ['market', 'shop', 'tickets'],
            installCount: 85,
            downloadCount: 190,
            createdAt: new Date().toISOString(),
            backupData: {
              channels: [
                { name: 'shop-area', type: 4, position: 0 },
                { name: 'products', type: 0, position: 1, parentName: 'shop-area' },
                { name: 'vouch-reviews', type: 0, position: 2, parentName: 'shop-area' }
              ],
              roles: [
                { name: 'Seller', color: 16776960, position: 1, permissions: '8' },
                { name: 'Buyer', color: 3447003, position: 2, permissions: '0' }
              ],
              categories: [
                { name: 'shop-area', type: 4, position: 0 }
              ],
              emojis: [],
              serverSettings: { name: 'Rage Marketplace Hub', verificationLevel: 2 }
            }
          }
        ];
      }

      let list = [...memoryDb.templates];
      if (options.isPublic !== undefined) {
        list = list.filter(t => t.isPublic === options.isPublic || (options.creatorId && t.creatorId === options.creatorId));
      }
      if (options.category && options.category !== 'All') {
        list = list.filter(t => t.category.toLowerCase() === options.category.toLowerCase());
      }
      if (options.search) {
        const q = options.search.toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.templateId.toLowerCase().includes(q));
      }
      return list;
    }

    let query = db.collection('templates');
    if (options.isPublic !== undefined) {
      query = query.where('isPublic', '==', options.isPublic);
    }
    if (options.category && options.category !== 'All') {
      query = query.where('category', '==', options.category);
    }

    const snapshot = await query.get();
    let list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });

    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.templateId.toLowerCase().includes(q));
    }

    return list;
  },

  getTemplateById: async (templateId) => {
    if (isFirebaseMock) {
      if (!memoryDb.templates) memoryDb.templates = [];
      return memoryDb.templates.find(t => t.templateId === templateId) || null;
    }

    const snapshot = await db.collection('templates')
      .where('templateId', '==', templateId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    let template = null;
    snapshot.forEach(doc => {
      template = { _id: doc.id, ...doc.data() };
    });
    return template;
  },

  addTemplate: async (templateData) => {
    const formatted = {
      templateId: templateData.templateId,
      name: templateData.name,
      description: templateData.description || '',
      creatorId: templateData.creatorId,
      creatorName: templateData.creatorName,
      isPublic: templateData.isPublic !== undefined ? templateData.isPublic : false,
      category: templateData.category || 'General',
      tags: templateData.tags || [],
      installCount: 0,
      downloadCount: 0,
      backupData: templateData.backupData,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseMock) {
      if (!memoryDb.templates) memoryDb.templates = [];
      formatted._id = 'mock_template_' + Math.random().toString(36).substring(7);
      memoryDb.templates.push(formatted);
      return formatted;
    }

    const docRef = await db.collection('templates').add(formatted);
    return { _id: docRef.id, ...formatted };
  },

  updateTemplate: async (templateId, updateData) => {
    if (isFirebaseMock) {
      const idx = memoryDb.templates?.findIndex(t => t.templateId === templateId);
      if (idx !== -1 && idx !== undefined) {
        memoryDb.templates[idx] = { ...memoryDb.templates[idx], ...updateData };
        return memoryDb.templates[idx];
      }
      return null;
    }

    const snapshot = await db.collection('templates')
      .where('templateId', '==', templateId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    let docId = null;
    snapshot.forEach(doc => {
      docId = doc.id;
    });

    await db.collection('templates').doc(docId).update(updateData);
    const updated = await db.collection('templates').doc(docId).get();
    return { _id: docId, ...updated.data() };
  },

  deleteTemplate: async (templateId) => {
    if (isFirebaseMock) {
      if (memoryDb.templates) {
        memoryDb.templates = memoryDb.templates.filter(t => t.templateId !== templateId);
      }
      return true;
    }

    const snapshot = await db.collection('templates')
      .where('templateId', '==', templateId)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return true;
  },

  // Restore Logs CRUD
  addRestoreLog: async (guildId, logData) => {
    const formatted = {
      guildId,
      action: logData.action || 'RESTORE_ACTION',
      executorId: logData.executorId,
      executorName: logData.executorName,
      status: logData.status || 'info', // 'success', 'failed', 'info'
      details: logData.details,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseMock) {
      if (!memoryDb.restoreLogs) memoryDb.restoreLogs = [];
      formatted._id = 'mock_restore_log_' + Math.random().toString(36).substring(7);
      memoryDb.restoreLogs.push(formatted);
      return formatted;
    }

    const docRef = await db.collection('restoreLogs').add(formatted);
    return { _id: docRef.id, ...formatted };
  },

  getRestoreLogs: async (guildId) => {
    if (isFirebaseMock) {
      if (!memoryDb.restoreLogs) return [];
      const list = memoryDb.restoreLogs.filter(l => l.guildId === guildId);
      return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const snapshot = await db.collection('restoreLogs')
      .where('guildId', '==', guildId)
      .get();
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  // Backup Metadata CRUD
  getBackupMetadata: async (guildId) => {
    const backups = await dbService.getBackups(guildId);
    return {
      totalBackups: backups.length,
      latestBackupAt: backups.length > 0 ? backups[0].createdAt : null,
      sizeBytesEstimate: backups.length * 1024
    };
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
      .limit(100)
      .get();
    
    const list = [];
    snapshot.forEach(doc => {
      list.push({ _id: doc.id, ...doc.data() });
    });
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      
      // Sync live log warning to Realtime Database (non-blocking)
      if (rtdb) {
        rtdb.ref(`guilds/${guildId}/liveLogs`).push(formatted).catch(() => {});
      }

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
