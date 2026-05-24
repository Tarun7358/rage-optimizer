import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, Lock, ShieldAlert, Database, History, RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';

export default function SecurityDash() {
  const { guildId } = useParams();
  const { backendUrl } = useAuth();

  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState('');
  const [settings, setSettings] = useState(null);
  const [roles, setRoles] = useState([]);
  const [backups, setBackups] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  
  const [backupName, setBackupName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');

  // Fetch security data
  const fetchData = async () => {
    try {
      const settingsRes = await axios.get(`${backendUrl}/api/guilds/${guildId}/settings`);
      setGuildName(settingsRes.data.guildName);
      setSettings(settingsRes.data.settings);
      setRoles(settingsRes.data.discordMetadata.roles);

      const backupsRes = await axios.get(`${backendUrl}/api/security/${guildId}/backups`);
      setBackups(backupsRes.data || []);

      const logsRes = await axios.get(`${backendUrl}/api/security/${guildId}/logs`);
      setSecurityLogs(logsRes.data || []);

      setLoading(false);
    } catch (err) {
      console.error('Failed to load data', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [guildId, backendUrl]);

  // Setup Realtime Sync: Firebase RTDB or Socket.IO fallback
  useEffect(() => {
    let unsubscribeFirebase = null;
    let socket = null;

    if (!isMock && rtdb) {
      console.log('[Realtime Sync] Subscribing via Firebase RTDB...');
      const settingsRef = ref(rtdb, `guilds/${guildId}/settings`);
      unsubscribeFirebase = onValue(settingsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setSettings(val);
        }
      });
    } else {
      console.log('[Realtime Sync] Subscribing via Socket.IO...');
      socket = io(backendUrl);
      socket.emit('joinGuild', guildId);
      
      socket.on('settingsUpdate', (updatedSettings) => {
        setSettings(updatedSettings);
      });

      socket.on('backupAdded', (newBackup) => {
        setBackups(prev => {
          if (prev.some(b => b._id === newBackup._id)) return prev;
          return [newBackup, ...prev];
        });
      });

      socket.on('securityLogAdded', (newLog) => {
        setSecurityLogs(prev => {
          if (prev.some(l => l._id === newLog._id)) return prev;
          return [newLog, ...prev];
        });
      });
    }

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      if (socket) {
        socket.emit('leaveGuild', guildId);
        socket.disconnect();
      }
    };
  }, [guildId, backendUrl]);

  const handleToggle = (field) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [field]: !prev.security[field]
      }
    }));
  };

  const handleSliderChange = (field, val) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [field]: parseInt(val)
      }
    }));
  };

  const saveSettings = async () => {
    setSaveStatus('Saving...');
    try {
      await axios.put(`${backendUrl}/api/guilds/${guildId}/settings`, settings);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus('Error saving');
    }
  };

  const createBackup = async (e) => {
    e.preventDefault();
    setBackupStatus('Capturing...');
    try {
      await axios.post(`${backendUrl}/api/security/${guildId}/backups`, { name: backupName });
      setBackupStatus('Backup Created!');
      setBackupName('');
      setTimeout(() => setBackupStatus(''), 3000);
      fetchData(); // refresh list
    } catch (err) {
      setBackupStatus('Failed to backup');
    }
  };

  const triggerRestore = async (backupId) => {
    if (!window.confirm('⚠️ WARNING: Triggering restoration will overwrite your current channel layout and setup. Are you sure you want to proceed?')) {
      return;
    }
    setRestoreStatus('Queued...');
    try {
      const res = await axios.post(`${backendUrl}/api/security/${guildId}/backups/${backupId}/restore`);
      alert(res.data.message);
      setRestoreStatus('');
      fetchData();
    } catch (err) {
      alert('Failed to trigger restore.');
      setRestoreStatus('');
    }
  };

  // Check roles for dangerous permissions
  const scanDangerousRoles = () => {
    const dangerous = [];
    roles.forEach(role => {
      const bitfield = parseInt(role.permissions || '0');
      // Admin perm: 0x8, Manage Webhooks: 0x20000000, Manage Roles: 0x10000000, Manage Channels: 0x10
      const hasAdmin = (bitfield & 0x8) === 0x8;
      const hasWebhooks = (bitfield & 0x20000000) === 0x20000000;
      const hasRoles = (bitfield & 0x10000000) === 0x10000000;
      const hasChannels = (bitfield & 0x10) === 0x10;

      if (hasAdmin || hasWebhooks || hasRoles || hasChannels) {
        const warningsList = [];
        if (hasAdmin) warningsList.push('ADMINISTRATOR');
        if (hasWebhooks) warningsList.push('MANAGE_WEBHOOKS');
        if (hasRoles) warningsList.push('MANAGE_ROLES');
        if (hasChannels) warningsList.push('MANAGE_CHANNELS');
        
        dangerous.push({
          name: role.name,
          warnings: warningsList
        });
      }
    });
    return dangerous;
  };

  const dangerousRoles = scanDangerousRoles();

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-accentRed rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] pt-16 flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
            <div>
              <span className="text-xs text-accentRed font-semibold uppercase tracking-widest">Configuration module</span>
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Security & Anti-Nuke</h2>
            </div>
            
            <button
              onClick={saveSettings}
              disabled={saveStatus === 'Saving...'}
              className="bg-accentRed hover:bg-accentRedHover disabled:bg-accentRed/50 text-white font-gaming font-bold tracking-wider text-xs px-5 py-3 rounded-lg flex items-center space-x-2 transition-all shadow-neonGlow hover:shadow-neonHover"
            >
              <Save className="w-4 h-4" />
              <span>{saveStatus || 'SAVE CONFIGURATION'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Anti-Nuke Control */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <Lock className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Anti-Nuke Safeguard</h3>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white block">Anti-Nuke Protection Active</span>
                    <span className="text-xs text-textGray">Lock down channels and roles creation/deletions threshold.</span>
                  </div>
                  <button
                    onClick={() => handleToggle('antiNuke')}
                    className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${
                      settings.security.antiNuke ? 'bg-accentRed' : 'bg-white/10'
                    }`}
                  >
                    <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-all duration-300 ${
                      settings.security.antiNuke ? 'translate-x-5.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {settings.security.antiNuke && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div>
                      <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Max Channels Deletion Limit (per minute)</label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={settings.security.channelLimit}
                          onChange={(e) => handleSliderChange('channelLimit', e.target.value)}
                          className="w-full accent-accentRed"
                        />
                        <span className="font-mono text-sm text-white w-6">{settings.security.channelLimit}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Max Roles Deletion Limit (per minute)</label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={settings.security.roleLimit}
                          onChange={(e) => handleSliderChange('roleLimit', e.target.value)}
                          className="w-full accent-accentRed"
                        />
                        <span className="font-mono text-sm text-white w-6">{settings.security.roleLimit}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Backup Manager */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <Database className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Server Backup Manager</h3>
                </div>

                <form onSubmit={createBackup} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Backup Name / Label</label>
                    <input
                      type="text"
                      required
                      value={backupName}
                      onChange={(e) => setBackupName(e.target.value)}
                      placeholder="Initial Config Setup"
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={backupStatus === 'Capturing...'}
                    className="bg-accentRed hover:bg-accentRedHover text-white text-xs px-6 py-3 rounded-lg font-gaming font-black tracking-wider transition-all shadow-neonGlow hover:shadow-neonHover flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{backupStatus || 'CREATE SNAPSHOT'}</span>
                  </button>
                </form>

                {/* Backups List */}
                <div className="pt-4 border-t border-white/5">
                  <label className="block text-xs font-semibold text-textGray uppercase mb-3">Saved Snapshots</label>
                  {backups.length === 0 ? (
                    <div className="text-center py-4 text-xs text-textGray italic">No backups found. Create a snapshot above to guard your guild structure.</div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {backups.map((backup) => (
                        <div key={backup._id} className="p-4 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-semibold text-white">{backup.name}</span>
                              <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-textGray">{backup.backupId}</span>
                            </div>
                            <span className="text-[10px] text-textGray/60 block">Created by {backup.creatorName} • Channels: {backup.channels?.length || 0} • Roles: {backup.roles?.length || 0}</span>
                          </div>

                          <button
                            onClick={() => triggerRestore(backup.backupId)}
                            className="bg-accentRed hover:bg-accentRedHover text-white px-4 py-2 rounded-lg text-xs font-gaming font-bold tracking-wider transition-all shadow-neonGlow"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Security Logs */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <History className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Security Audit Logs</h3>
                </div>

                {securityLogs.length === 0 ? (
                  <div className="text-center py-4 text-xs text-textGray italic">No security incidents logged. Server is safe.</div>
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                    {securityLogs.map((log) => (
                      <div key={log._id} className="text-xs p-3 rounded bg-white/5 border-l-2 border-accentRed flex justify-between items-start">
                        <div className="pr-4">
                          <span className="font-semibold block text-white mb-0.5">{log.action}</span>
                          <span className="text-textGray leading-relaxed">{log.details}</span>
                          <span className="text-[10px] text-textGray/45 block mt-1">Executor: {log.executorName}</span>
                        </div>
                        <span className="text-[10px] text-textGray/40 shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dangerous permissions scanner sidebar */}
            <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6 self-start">
              <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                <ShieldAlert className="w-5 h-5 text-accentRed" />
                <h3 className="font-gaming font-bold text-white uppercase text-md">Dangerous Scans</h3>
              </div>

              <p className="text-xs text-textGray leading-relaxed">
                Automated audit of server roles possessing high-privilege access permissions. Over-granting these permissions leaves the server open to raid scripts.
              </p>

              {dangerousRoles.length === 0 ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-400 text-xs">
                  🟢 0 Dangerous roles found. Permissions are clean!
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-accentRed font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Flagged Roles ({dangerousRoles.length})</span>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {dangerousRoles.map((role, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="text-xs font-bold text-white">{role.name}</div>
                        <div className="flex flex-wrap gap-1">
                          {role.warnings.map(warn => (
                            <span key={warn} className="text-[9px] font-mono bg-accentRed/10 text-accentRed px-1.5 py-0.5 rounded">
                              {warn}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
