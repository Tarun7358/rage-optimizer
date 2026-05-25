import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Save, Lock, ShieldAlert, Database, History, RefreshCw, Plus,
  AlertCircle, Trash2, Eye, Tag, Search, Filter, Play, Check,
  X, Shield, Globe, Award, Sparkles, Terminal, Activity, FileText
} from 'lucide-react';
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
  const [restoreLogs, setRestoreLogs] = useState([]);
  const [activeRestore, setActiveRestore] = useState(null);

  const [activeTab, setActiveTab] = useState('security'); // 'security' | 'templates'
  const [backupName, setBackupName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');

  // Marketplace States
  const [templates, setTemplates] = useState([]);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState('All');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Modals
  const [previewBackup, setPreviewBackup] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [createTemplateBackup, setCreateTemplateBackup] = useState(null);
  
  // Template Form State
  const [templateForm, setTemplateForm] = useState({
    templateId: '',
    name: '',
    description: '',
    isPublic: true,
    category: 'Esports',
    tags: ''
  });
  const [templateCreateStatus, setTemplateCreateStatus] = useState('');

  const terminalEndRef = useRef(null);

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

      const restoreLogsRes = await axios.get(`${backendUrl}/api/security/${guildId}/restore-logs`);
      setRestoreLogs(restoreLogsRes.data.history || []);
      if (restoreLogsRes.data.active) {
        setActiveRestore(restoreLogsRes.data.active);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load data', err);
      setLoading(false);
    }
  };

  // Fetch templates for marketplace
  const fetchMarketplace = async () => {
    setLoadingTemplates(true);
    try {
      const res = await axios.get(`${backendUrl}/api/templates`, {
        params: { search: marketSearch, category: marketCategory }
      });
      setTemplates(res.data || []);
      setLoadingTemplates(false);
    } catch (err) {
      console.error('Failed to load marketplace templates', err);
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [guildId, backendUrl]);

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchMarketplace();
    }
  }, [activeTab, marketSearch, marketCategory]);

  // Scroll active restore terminal to bottom when new logs enter
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeRestore?.logs]);

  // Setup Realtime Sync: Firebase RTDB or Socket.IO fallback
  useEffect(() => {
    let unsubscribeFirebase = null;
    let unsubscribeRestoreProgress = null;
    let socket = null;

    if (!isMock && rtdb) {
      console.log('[Realtime Sync] Subscribing via Firebase RTDB...');
      const settingsRef = ref(rtdb, `guilds/${guildId}/settings`);
      unsubscribeFirebase = onValue(settingsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) setSettings(val);
      });

      const restoreRef = ref(rtdb, `guilds/${guildId}/restoreProgress`);
      unsubscribeRestoreProgress = onValue(restoreRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setActiveRestore(val);
          if (val.status === 'completed' || val.status === 'failed') {
            fetchData(); // reload lists
            setTimeout(() => setActiveRestore(null), 15000); // hide panel after 15s
          }
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

      socket.on('backupDeleted', (deletedId) => {
        setBackups(prev => prev.filter(b => b.backupId !== deletedId));
      });

      socket.on('securityLogAdded', (newLog) => {
        setSecurityLogs(prev => {
          if (prev.some(l => l._id === newLog._id)) return prev;
          return [newLog, ...prev];
        });
      });

      socket.on('restoreProgress', (progress) => {
        setActiveRestore(progress);
        if (progress.status === 'completed' || progress.status === 'failed') {
          fetchData(); // refresh history & logs
          setTimeout(() => setActiveRestore(null), 15000);
        }
      });
    }

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      if (unsubscribeRestoreProgress) unsubscribeRestoreProgress();
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
      setTimeout(() => setSaveStatus(''), 3000);
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
      fetchData();
    } catch (err) {
      setBackupStatus('Failed to backup');
      setTimeout(() => setBackupStatus(''), 3000);
    }
  };

  const triggerRestore = async (backupId) => {
    if (!window.confirm('⚠️ WARNING: Restoring will completely recreate channels, categories, and roles in this server. Old layouts will be deleted. Are you sure you want to proceed?')) {
      return;
    }
    try {
      const res = await axios.post(`${backendUrl}/api/security/${guildId}/backups/${backupId}/restore`);
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to trigger restore.');
    }
  };

  const deleteBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to delete this backup snapshot permanently?')) {
      return;
    }
    try {
      await axios.delete(`${backendUrl}/api/security/${guildId}/backups/${backupId}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete backup snapshot');
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setTemplateCreateStatus('Saving Template...');
    try {
      await axios.post(`${backendUrl}/api/templates`, {
        backupId: createTemplateBackup.backupId,
        guildId: guildId,
        templateId: templateForm.templateId,
        name: templateForm.name,
        description: templateForm.description,
        isPublic: templateForm.isPublic,
        category: templateForm.category,
        tags: templateForm.tags
      });
      setTemplateCreateStatus('Template Saved!');
      setTimeout(() => {
        setCreateTemplateBackup(null);
        setTemplateForm({ templateId: '', name: '', description: '', isPublic: true, category: 'Esports', tags: '' });
        setTemplateCreateStatus('');
      }, 2000);
      fetchData();
    } catch (err) {
      setTemplateCreateStatus(err.response?.data?.error || 'Failed to create template');
    }
  };

  const installTemplate = async (templateId) => {
    if (!window.confirm('⚠️ WARNING: Installing this layout template will delete your existing channels and recreate the server structural configuration. Proceed?')) {
      return;
    }
    try {
      const res = await axios.post(`${backendUrl}/api/templates/${templateId}/load/${guildId}`);
      alert(res.data.message);
      setPreviewTemplate(null);
      fetchData();
      setActiveTab('security');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to install template layout.');
    }
  };

  const scanDangerousRoles = () => {
    const dangerous = [];
    roles.forEach(role => {
      const bitfield = parseInt(role.permissions || '0');
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
      <div className="min-h-screen bg-darkBg flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-accentRed rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkBg pt-16 flex transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 md:p-8 overflow-y-auto transition-all duration-300">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-6 mb-8 gap-4">
            <div>
              <span className="text-xs text-accentRed font-semibold uppercase tracking-widest">Configuration module</span>
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Security & Backup</h2>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex bg-white/4 p-1 rounded-lg border border-white/5">
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 py-2 font-gaming font-bold tracking-wider text-xs rounded-md transition-all ${
                    activeTab === 'security'
                      ? 'bg-accentRed text-white shadow-neonGlow'
                      : 'text-textGray hover:text-white'
                  }`}
                >
                  SHIELD & BACKUPS
                </button>
                <button
                  onClick={() => setActiveTab('templates')}
                  className={`px-4 py-2 font-gaming font-bold tracking-wider text-xs rounded-md transition-all ${
                    activeTab === 'templates'
                      ? 'bg-accentRed text-white shadow-neonGlow'
                      : 'text-textGray hover:text-white'
                  }`}
                >
                  TEMPLATES MARKET
                </button>
              </div>

              {activeTab === 'security' && (
                <button
                  onClick={saveSettings}
                  disabled={saveStatus === 'Saving...'}
                  className="bg-accentRed hover:bg-accentRedHover disabled:bg-accentRed/50 text-white font-gaming font-bold tracking-wider text-xs px-5 py-3 rounded-lg flex items-center space-x-2 transition-all shadow-neonGlow hover:shadow-neonHover"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus || 'SAVE CONFIGURATION'}</span>
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE RESTORE LIVE TERMINAL */}
          {activeRestore && (
            <div className="glass-card border border-accentRed/30 p-6 rounded-xl mb-8 bg-[#0a0508] shadow-[0_0_15px_rgba(255,0,60,0.15)] animate-pulse">
              <div className="flex items-center justify-between pb-3 border-b border-accentRed/20 mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-accentRed animate-spin" />
                  <span className="font-gaming font-black text-xs text-accentRed tracking-wider uppercase">Active Server Restoration In Progress</span>
                </div>
                <span className={`text-[10px] font-gaming font-bold px-2.5 py-0.5 rounded-full ${
                  activeRestore.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                  activeRestore.status === 'failed' ? 'bg-accentRed/10 text-accentRed' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {activeRestore.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold text-white">
                  <span>{activeRestore.currentAction}</span>
                  <span>{activeRestore.currentStep} / {activeRestore.totalSteps} tasks</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accentRed h-full transition-all duration-500 shadow-neonGlow"
                    style={{ width: `${Math.min(100, (activeRestore.currentStep / activeRestore.totalSteps) * 100)}%` }}
                  />
                </div>

                {/* Console Log Terminal */}
                <div className="bg-[#040406] border border-white/5 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 scrollbar-thin">
                  {activeRestore.logs?.map((log, idx) => (
                    <div key={idx} className={`${log.includes('❌') ? 'text-accentRed' : log.includes('⚠️') ? 'text-amber-400' : log.includes('✅') ? 'text-emerald-400' : ''}`}>
                      {log}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' ? (
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
                    <div className="flex-1 w-full">
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
                      className="bg-accentRed hover:bg-accentRedHover text-white text-xs px-6 py-3 rounded-lg font-gaming font-black tracking-wider transition-all shadow-neonGlow hover:shadow-neonHover flex items-center space-x-2 shrink-0"
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
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                        {backups.map((backup) => {
                          const chanCount = backup.backupData ? (backup.backupData.channels?.length + backup.backupData.categories?.length || 0) : (backup.channels?.length || 0);
                          const roleCount = backup.backupData ? (backup.backupData.roles?.length || 0) : (backup.roles?.length || 0);
                          return (
                            <div key={backup._id} className="p-4 rounded-lg bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-sm font-semibold text-white">{backup.backupName || backup.name}</span>
                                  <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-textGray">{backup.backupId}</span>
                                </div>
                                <span className="text-[10px] text-textGray/60 block">
                                  Created by {backup.creatorName} • Channels: {chanCount} • Roles: {roleCount} • <span className="text-white/40">{new Date(backup.createdAt).toLocaleString()}</span>
                                </span>
                              </div>

                              <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                                <button
                                  onClick={() => setPreviewBackup(backup)}
                                  title="Preview Layout Structure"
                                  className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/5"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setCreateTemplateBackup(backup);
                                    setTemplateForm(prev => ({
                                      ...prev,
                                      name: `${backup.backupName || backup.name} Template`,
                                      templateId: `rage-${(backup.backupName || backup.name).toLowerCase().replace(/[^a-z0-9]/g, '-')}-t`
                                    }));
                                  }}
                                  title="Save as Marketplace Template"
                                  className="p-2 bg-white/5 hover:bg-white/10 text-amber-400 rounded-lg transition-all border border-white/5"
                                >
                                  <Tag className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => triggerRestore(backup.backupId)}
                                  className="bg-accentRed hover:bg-accentRedHover text-white px-3 py-1.5 rounded-lg text-xs font-gaming font-bold tracking-wider transition-all shadow-neonGlow flex items-center space-x-1"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>Restore</span>
                                </button>

                                <button
                                  onClick={() => deleteBackup(backup.backupId)}
                                  title="Delete Backup"
                                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-accentRed rounded-lg transition-all border border-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Restore logs and history */}
                <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                  <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                    <History className="w-5 h-5 text-accentRed" />
                    <h3 className="font-gaming font-bold text-white uppercase text-md">Restoration History Logs</h3>
                  </div>

                  {restoreLogs.length === 0 ? (
                    <div className="text-center py-4 text-xs text-textGray italic">No restore actions logged in history.</div>
                  ) : (
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                      {restoreLogs.map((log) => (
                        <div key={log._id} className="text-xs p-3 rounded bg-white/5 border-l-2 border-indigo-500 flex justify-between items-start">
                          <div className="pr-4">
                            <span className="font-semibold block text-white mb-0.5">{log.action}</span>
                            <span className="text-textGray leading-relaxed">{log.details}</span>
                            <span className="text-[10px] text-textGray/45 block mt-1">
                              Executor: {log.executorName} • Status: <span className={log.status === 'success' ? 'text-emerald-400' : 'text-accentRed'}>{log.status.toUpperCase()}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-textGray/40 shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Security Incident Logs */}
                <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                  <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                    <ShieldAlert className="w-5 h-5 text-accentRed" />
                    <h3 className="font-gaming font-bold text-white uppercase text-md">Security Audit Logs</h3>
                  </div>

                  {securityLogs.length === 0 ? (
                    <div className="text-center py-4 text-xs text-textGray italic">No security incidents logged. Server is safe.</div>
                  ) : (
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
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
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
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
          ) : (
            /* TEMPLATE MARKETPLACE TAB */
            <div className="space-y-6">
              {/* Controls Panel */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-textGray/60 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    placeholder="Search templates (e.g. scrim, market, rules)..."
                    className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm pl-10 pr-4 py-3 focus:outline-none focus:border-accentRed focus:ring-1 focus:ring-accentRed/40 placeholder-textGray/40"
                  />
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
                  {['All', 'Esports', 'Marketplace', 'Community', 'Development', 'General'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setMarketCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-bold font-gaming rounded-lg transition-all shrink-0 ${
                        marketCategory === cat
                          ? 'bg-accentRed text-white border border-accentRed/30'
                          : 'bg-white/5 text-textGray hover:text-white border border-transparent'
                      }`}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Templates List */}
              {loadingTemplates ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-10 h-10 border-t-2 border-accentRed rounded-full animate-spin"></div>
                  <span className="text-xs text-textGray uppercase tracking-wider font-gaming">Browsing Marketplace Database...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-white/2 border border-white/5 rounded-xl border-dashed">
                  <Globe className="w-12 h-12 text-textGray/30 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-white mb-1">No templates found</h3>
                  <p className="text-xs text-textGray max-w-sm mx-auto">Try refining your search terms or switch categories to browse more layout setups.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {templates.map(template => {
                    const chanCount = template.backupData?.channels?.length + template.backupData?.categories?.length || 0;
                    const roleCount = template.backupData?.roles?.length || 0;
                    return (
                      <div
                        key={template._id}
                        className="glass-card p-6 rounded-xl border-borderColor/20 flex flex-col justify-between hover:border-accentRed/30 transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-accentRed/5 rounded-bl-full pointer-events-none group-hover:bg-accentRed/10 transition-all" />
                        
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-gaming font-black px-2 py-0.5 bg-accentRed/10 text-accentRed rounded uppercase tracking-wider">
                              {template.category}
                            </span>
                            <span className="text-[10px] text-textGray/60 font-mono">#{template.templateId}</span>
                          </div>

                          <h3 className="text-lg font-gaming font-black text-white group-hover:text-accentRed transition-all uppercase tracking-wide mb-1.5">
                            {template.name}
                          </h3>
                          <p className="text-xs text-textGray leading-relaxed mb-4 min-h-[40px] line-clamp-2">
                            {template.description || 'A structured server layout template built for Rage Optimizer users.'}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[10px] text-textGray/50 border-t border-white/5 pt-4 mb-4">
                            <span>Creator: <strong className="text-white">{template.creatorName}</strong></span>
                            <div className="flex space-x-3">
                              <span>Roles: <strong className="text-zinc-300">{roleCount}</strong></span>
                              <span>Channels: <strong className="text-zinc-300">{chanCount}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                              📥 {template.installCount || 0} Installs
                            </span>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setPreviewTemplate(template)}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-gaming font-bold tracking-wider transition-all border border-white/5 flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>
                              <button
                                onClick={() => installTemplate(template.templateId)}
                                className="px-3 py-2 bg-accentRed hover:bg-accentRedHover text-white rounded-lg text-xs font-gaming font-bold tracking-wider transition-all shadow-neonGlow hover:shadow-neonHover flex items-center space-x-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Install</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* PREVIEW BACKUP MODAL */}
      {previewBackup && (
        <div className="fixed inset-0 z-50 bg-[#040406]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c0c14] border border-white/10 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/2">
              <div>
                <span className="text-[10px] text-accentRed font-bold uppercase tracking-wider font-gaming">Backup Previewer</span>
                <h3 className="text-lg font-gaming font-black text-white uppercase">{previewBackup.backupName || previewBackup.name}</h3>
              </div>
              <button
                onClick={() => setPreviewBackup(null)}
                className="text-textGray hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
              {/* Settings */}
              <div>
                <span className="text-[10px] font-bold text-textGray uppercase block mb-2">Guild Configuration</span>
                <div className="p-3 bg-[#08080c] border border-white/5 rounded-lg text-xs grid grid-cols-2 gap-2 text-zinc-300">
                  <div>Verification Level: <strong>{previewBackup.backupData?.serverSettings?.verificationLevel ?? 'Default'}</strong></div>
                  <div>Explicit Filter: <strong>{previewBackup.backupData?.serverSettings?.explicitContentFilter ?? 'Default'}</strong></div>
                  <div>ID: <strong className="font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">{previewBackup.backupId}</strong></div>
                  <div>Created: <strong>{new Date(previewBackup.createdAt).toLocaleDateString()}</strong></div>
                </div>
              </div>

              {/* Roles */}
              <div>
                <span className="text-[10px] font-bold text-textGray uppercase block mb-2">Saved Roles ({previewBackup.backupData?.roles?.length || 0})</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#08080c] border border-white/5 rounded-lg">
                  {previewBackup.backupData?.roles?.map((role, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] px-2 py-0.5 rounded-full border border-white/10 font-medium"
                      style={{ color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#ccc', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}10` : '#fff0' }}
                    >
                      {role.name}
                    </span>
                  ))}
                  {(!previewBackup.backupData?.roles || previewBackup.backupData.roles.length === 0) && (
                    <span className="text-xs text-textGray italic">No roles captured.</span>
                  )}
                </div>
              </div>

              {/* Channels Structure */}
              <div>
                <span className="text-[10px] font-bold text-textGray uppercase block mb-2">Category & Channel Tree</span>
                <div className="bg-[#08080c] border border-white/5 rounded-lg p-4 font-mono text-[10px] text-zinc-300 space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                  {previewBackup.backupData?.categories?.map((cat, idx) => {
                    const children = previewBackup.backupData.channels.filter(c => c.parentId === cat.id);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="text-white font-bold uppercase tracking-wide">📂 {cat.name}</div>
                        <div className="pl-4 space-y-0.5 border-l border-white/10 ml-2">
                          {children.map((chan, cidx) => (
                            <div key={cidx} className="text-zinc-400">
                              {chan.type === 2 ? '🔊' : '💬'} {chan.name} {chan.rateLimitPerUser > 0 && <span className="text-[8px] text-accentRed font-semibold">({chan.rateLimitPerUser}s slowmode)</span>}
                            </div>
                          ))}
                          {children.length === 0 && <div className="text-textGray italic">No channels under category.</div>}
                        </div>
                      </div>
                    );
                  })}
                  {/* Or list all channels flat if no categories */}
                  {(!previewBackup.backupData?.categories || previewBackup.backupData.categories.length === 0) && (
                    <div className="space-y-1">
                      {previewBackup.backupData?.channels?.map((chan, idx) => (
                        <div key={idx}>
                          {chan.type === 2 ? '🔊' : '💬'} {chan.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-white/2 border-t border-white/5 flex justify-end space-x-2 shrink-0">
              <button
                onClick={() => setPreviewBackup(null)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white rounded-lg text-xs font-gaming font-bold"
              >
                CLOSE
              </button>
              <button
                onClick={() => {
                  triggerRestore(previewBackup.backupId);
                  setPreviewBackup(null);
                }}
                className="px-5 py-2 bg-accentRed hover:bg-accentRedHover text-white rounded-lg text-xs font-gaming font-bold shadow-neonGlow"
              >
                APPLY RESTORE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW TEMPLATE MODAL */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-[#040406]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c0c14] border border-white/10 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-fadeIn">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/2">
              <div>
                <span className="text-[10px] text-accentRed font-bold uppercase tracking-wider font-gaming">Marketplace Template Preview</span>
                <h3 className="text-lg font-gaming font-black text-white uppercase">{previewTemplate.name}</h3>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-textGray hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
              <div>
                <span className="text-[10px] font-bold text-textGray uppercase block mb-2">Description</span>
                <p className="text-xs text-zinc-300 leading-relaxed bg-[#08080c] p-3 border border-white/5 rounded-lg">
                  {previewTemplate.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-textGray uppercase block mb-1">Marketplace Info</span>
                  <div className="p-3 bg-[#08080c] border border-white/5 rounded-lg text-xs text-zinc-300 space-y-1">
                    <div>Category: <strong>{previewTemplate.category}</strong></div>
                    <div>Installs: <strong>{previewTemplate.installCount || 0}</strong></div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-textGray uppercase block mb-1">Creator Info</span>
                  <div className="p-3 bg-[#08080c] border border-white/5 rounded-lg text-xs text-zinc-300 space-y-1">
                    <div>Created By: <strong>{previewTemplate.creatorName}</strong></div>
                    <div>Date: <strong>{new Date(previewTemplate.createdAt).toLocaleDateString()}</strong></div>
                  </div>
                </div>
              </div>

              {/* Roles */}
              <div>
                <span className="text-[10px] font-bold text-textGray uppercase block mb-2">Included Roles ({previewTemplate.backupData?.roles?.length || 0})</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#08080c] border border-white/5 rounded-lg">
                  {previewTemplate.backupData?.roles?.map((role, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] px-2 py-0.5 rounded-full border border-white/10 font-medium font-gaming"
                      style={{ color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#ccc', backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}10` : '#fff0' }}
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Channels Tree */}
              <div>
                <span className="text-[10px] font-bold text-textGray uppercase block mb-2">Category & Channel Structure</span>
                <div className="bg-[#08080c] border border-white/5 rounded-lg p-4 font-mono text-[10px] text-zinc-300 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {previewTemplate.backupData?.categories?.map((cat, idx) => {
                    const children = previewTemplate.backupData.channels.filter(c => c.parentId === cat.id || c.parentName === cat.name);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="text-white font-bold uppercase tracking-wide">📂 {cat.name}</div>
                        <div className="pl-4 space-y-0.5 border-l border-white/10 ml-2">
                          {children.map((chan, cidx) => (
                            <div key={cidx} className="text-zinc-400">
                              {chan.type === 2 ? '🔊' : '💬'} {chan.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {(!previewTemplate.backupData?.categories || previewTemplate.backupData.categories.length === 0) && (
                    <div className="space-y-1">
                      {previewTemplate.backupData?.channels?.map((chan, idx) => (
                        <div key={idx}>
                          {chan.type === 2 ? '🔊' : '💬'} {chan.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/2 border-t border-white/5 flex justify-end space-x-2 shrink-0">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white rounded-lg text-xs font-gaming font-bold"
              >
                CLOSE
              </button>
              <button
                onClick={() => installTemplate(previewTemplate.templateId)}
                className="px-5 py-2 bg-accentRed hover:bg-accentRedHover text-white rounded-lg text-xs font-gaming font-bold shadow-neonGlow"
              >
                INSTALL LAYOUT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE BACKUP AS TEMPLATE MODAL */}
      {createTemplateBackup && (
        <div className="fixed inset-0 z-50 bg-[#040406]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateTemplate} className="bg-[#0c0c14] border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fadeIn">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/2">
              <div>
                <span className="text-[10px] text-accentRed font-bold uppercase tracking-wider font-gaming">Template Publisher</span>
                <h3 className="text-lg font-gaming font-black text-white uppercase">Convert snapshot to Template</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateTemplateBackup(null)}
                className="text-textGray hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              <div>
                <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Source Backup Snapshot</label>
                <input
                  type="text"
                  disabled
                  value={`${createTemplateBackup.backupName || createTemplateBackup.name} (${createTemplateBackup.backupId})`}
                  className="w-full bg-[#08080c]/50 border border-white/5 text-zinc-500 rounded-lg text-xs p-2.5 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Unique Template ID (Slug)</label>
                <input
                  type="text"
                  required
                  pattern="^[a-z0-9-_]+$"
                  value={templateForm.templateId}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, templateId: e.target.value.toLowerCase() }))}
                  placeholder="rage-scrim-v1"
                  className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                />
                <span className="text-[9px] text-textGray/60 mt-1 block">Only lowercase letters, numbers, dashes (-) and underscores (_).</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Template Name</label>
                <input
                  type="text"
                  required
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Rage Esports Pro Tourney Setup"
                  className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Short Description</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your server structure layout features..."
                  className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Category</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                  >
                    <option value="Esports">Esports & Gaming</option>
                    <option value="Marketplace">Marketplace</option>
                    <option value="Community">Community Hub</option>
                    <option value="Development">Development</option>
                    <option value="General">General Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={templateForm.tags}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="scrim, shop, fast"
                    className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-lg mt-2">
                <div>
                  <span className="text-xs font-semibold text-white block">Publish to Marketplace</span>
                  <span className="text-[10px] text-textGray/60">Allow other users to search and use this layout.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateForm(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-all ${
                    templateForm.isPublic ? 'bg-accentRed' : 'bg-white/10'
                  }`}
                >
                  <div className={`bg-white w-4.5 h-4.5 rounded-full transform transition-all ${
                    templateForm.isPublic ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/2 border-t border-white/5 flex justify-between items-center shrink-0">
              <span className="text-xs text-accentRed font-semibold">{templateCreateStatus}</span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setCreateTemplateBackup(null)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white rounded-lg text-xs font-gaming font-bold"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={templateCreateStatus.includes('Saving')}
                  className="px-5 py-2 bg-accentRed hover:bg-accentRedHover text-white rounded-lg text-xs font-gaming font-bold shadow-neonGlow hover:shadow-neonHover"
                >
                  PUBLISH
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
