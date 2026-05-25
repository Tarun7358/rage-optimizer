import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  RefreshCw, Play, Pause, AlertTriangle, Eye, ShieldAlert,
  Server, Database, Tag, Search, ArrowRight, CheckCircle2,
  Terminal, Activity, Compass, Info, Heart
} from 'lucide-react';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';

export default function ClonerDash() {
  const { guildId } = useParams();
  const { user, guilds, backendUrl } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sourceType, setSourceType] = useState('server'); // 'server' | 'backup' | 'template'
  
  // Selection States
  const [selectedSourceServer, setSelectedSourceServer] = useState('');
  const [selectedSourceBackup, setSelectedSourceBackup] = useState('');
  const [selectedSourceTemplate, setSelectedSourceTemplate] = useState('');
  const [targetServer, setTargetServer] = useState(guildId || '');

  // Data Lists
  const [backups, setBackups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeRestore, setActiveRestore] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('rage_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // UI Search/Filter
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  
  // Preview State
  const [previewData, setPreviewData] = useState(null);
  
  // Progress Pause
  const [isPaused, setIsPaused] = useState(false);

  // Status message
  const [cloningStatus, setCloningStatus] = useState('');
  const [logs, setLogs] = useState([]);

  const terminalEndRef = useRef(null);

  // Filter guilds where bot is present & user is admin
  const adminGuilds = guilds.filter(g => {
    const permInt = parseInt(g.permissions || '0');
    return g.owner || (permInt & 0x8) === 0x8;
  });
  const botGuilds = adminGuilds.filter(g => g.botJoined);

  // Fetch initial templates & backups
  const fetchClonerData = async () => {
    try {
      // Get all backups for this target server
      const backupsRes = await axios.get(`${backendUrl}/api/security/${targetServer || guildId}/backups`);
      setBackups(backupsRes.data || []);

      // Get templates from marketplace
      const templatesRes = await axios.get(`${backendUrl}/api/templates`);
      setTemplates(templatesRes.data || []);

      // Check active progress
      const progressRes = await axios.get(`${backendUrl}/api/security/${targetServer || guildId}/restore-logs`);
      if (progressRes.data.active) {
        setActiveRestore(progressRes.data.active);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load cloner details', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetServer) {
      fetchClonerData();
    }
  }, [targetServer, backendUrl]);

  // Handle Socket & RTDB live updates
  useEffect(() => {
    if (!targetServer) return;

    let unsubscribeFirebase = null;
    let socket = null;

    if (!isMock && rtdb) {
      const restoreRef = ref(rtdb, `guilds/${targetServer}/restoreProgress`);
      unsubscribeFirebase = onValue(restoreRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setActiveRestore(val);
          if (val.status === 'completed' || val.status === 'failed') {
            fetchClonerData();
          }
        }
      });
    } else {
      socket = io(backendUrl);
      socket.emit('joinGuild', targetServer);

      socket.on('restoreProgress', (progress) => {
        setActiveRestore(progress);
        if (progress.status === 'completed' || progress.status === 'failed') {
          fetchClonerData();
        }
      });
    }

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      if (socket) {
        socket.emit('leaveGuild', targetServer);
        socket.disconnect();
      }
    };
  }, [targetServer, backendUrl]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeRestore?.logs]);

  // Load preview details
  const updatePreview = () => {
    if (sourceType === 'server') {
      const srcObj = botGuilds.find(g => g.id === selectedSourceServer);
      if (srcObj) {
        setPreviewData({
          name: srcObj.name,
          type: 'Discord Server (Live)',
          description: 'Extracting live layouts of channels, categories, permissions, and roles.',
          info: `ID: ${srcObj.id}`
        });
      } else {
        setPreviewData(null);
      }
    } else if (sourceType === 'backup') {
      const backupObj = backups.find(b => b.backupId === selectedSourceBackup);
      if (backupObj) {
        const caps = backupObj.backupData || backupObj;
        setPreviewData({
          name: backupObj.backupName || backupObj.name,
          type: 'Backup Snapshot',
          description: `Created on ${new Date(backupObj.createdAt).toLocaleString()} by ${backupObj.creatorName}.`,
          info: `ID: ${backupObj.backupId}`,
          roles: caps.roles || [],
          channels: caps.channels || [],
          categories: caps.categories || []
        });
      } else {
        setPreviewData(null);
      }
    } else if (sourceType === 'template') {
      const tempObj = templates.find(t => t.templateId === selectedSourceTemplate);
      if (tempObj) {
        setPreviewData({
          name: tempObj.name,
          type: 'Marketplace Template',
          description: tempObj.description || 'Custom configured template layout.',
          info: `Slug: ${tempObj.templateId} • Category: ${tempObj.category}`,
          roles: tempObj.backupData?.roles || [],
          channels: tempObj.backupData?.channels || [],
          categories: tempObj.backupData?.categories || []
        });
      } else {
        setPreviewData(null);
      }
    }
  };

  useEffect(() => {
    updatePreview();
  }, [sourceType, selectedSourceServer, selectedSourceBackup, selectedSourceTemplate, backups, templates]);

  const handleFavoriteToggle = (templateId) => {
    let nextFavs;
    if (favorites.includes(templateId)) {
      nextFavs = favorites.filter(id => id !== templateId);
    } else {
      nextFavs = [...favorites, templateId];
    }
    setFavorites(nextFavs);
    localStorage.setItem('rage_favorites', JSON.stringify(nextFavs));
  };

  const handleDownloadJSON = (backup) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup.backupData || backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${backup.backupName || backup.name || 'backup'}_layout.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const triggerClone = async () => {
    if (!targetServer) {
      alert('Please select a target server to apply structure into.');
      return;
    }

    let payload = { targetGuildId: targetServer };

    if (sourceType === 'server') {
      if (!selectedSourceServer) return alert('Please select a source server.');
      if (selectedSourceServer === targetServer) {
        return alert('Source and Target servers must be different to perform a clone.');
      }
      payload.sourceGuildId = selectedSourceServer;
    } else if (sourceType === 'backup') {
      if (!selectedSourceBackup) return alert('Please select a source backup snapshot.');
      payload.backupId = selectedSourceBackup;
      payload.sourceGuildId = targetServer; // Look inside target guild backups
    } else if (sourceType === 'template') {
      if (!selectedSourceTemplate) return alert('Please select a source template.');
      payload.templateId = selectedSourceTemplate;
    }

    if (!window.confirm('⚠️ WARNING: SERVER CLONING INITIATED!\n\nThis will completely delete all channels and roles in the target server and replace them with the source structure. Are you absolutely sure you want to clone?')) {
      return;
    }

    setCloningStatus('Initializing Clone Worker...');
    try {
      const res = await axios.post(`${backendUrl}/api/security/clone`, payload);
      setCloningStatus(res.data.message);
      fetchClonerData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start cloning worker.');
      setCloningStatus('');
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase()) || 
                          t.description.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesCat = templateCategory === 'All' || t.category === templateCategory;
    return matchesSearch && matchesCat;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-darkBg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-white/5 rounded-full" />
          <div className="w-12 h-12 border-t-2 border-accentRed rounded-full animate-spin absolute inset-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkBg pt-16 flex transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 md:p-8 overflow-y-auto transition-all duration-300">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="border-b border-white/5 pb-6">
            <span className="text-xs text-accentRed font-semibold uppercase tracking-widest">Dashboard module</span>
            <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Discord Server Cloner</h2>
            <p className="text-textGray text-xs mt-1">Copy and transfer layout setups, role hierarchies, and permission overlays between servers in one click.</p>
          </div>

          {/* ACTIVE CLONE TERMINAL */}
          {activeRestore && (
            <div className="glass-card border border-accentRed/30 p-6 rounded-xl bg-[#0a0508] shadow-[0_0_20px_rgba(255,0,60,0.2)] animate-pulse">
              <div className="flex items-center justify-between pb-3 border-b border-accentRed/20 mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-accentRed animate-spin" />
                  <span className="font-gaming font-black text-xs text-accentRed tracking-wider uppercase">Cloning worker executing</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded border border-white/5 transition-all text-[10px] font-bold flex items-center space-x-1"
                  >
                    {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <span className="text-[10px] font-gaming font-bold bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full">
                    {isPaused ? 'PAUSED' : activeRestore.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold text-white">
                  <span>{isPaused ? 'Queue Paused by Administrator' : activeRestore.currentAction}</span>
                  <span>{activeRestore.currentStep} / {activeRestore.totalSteps} tasks ({Math.min(100, Math.round((activeRestore.currentStep / activeRestore.totalSteps) * 100)) || 0}%)</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accentRed h-full transition-all duration-500 shadow-neonGlow"
                    style={{ width: `${Math.min(100, (activeRestore.currentStep / activeRestore.totalSteps) * 100)}%` }}
                  />
                </div>

                {/* Console Log Terminal */}
                <div className="bg-white/5 border border-borderColor rounded-xl p-3 h-40 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 scrollbar-thin">
                  {isPaused && (
                    <div className="text-amber-400 font-bold">[SYSTEM] Clone worker paused. Waiting for resume instruction...</div>
                  )}
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

          {/* MAIN WIDGET - CONFIGURATION PANEL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Cloner Settings Form */}
            <div className="md:col-span-2 space-y-6">
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <Compass className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">1. Configure Cloner</h3>
                </div>

                {/* Source Selection Type */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-textGray uppercase tracking-wider">Select Source Layout Type</label>
                  <div className="grid grid-cols-3 gap-2 bg-white/4 p-1 rounded-lg border border-white/5">
                    <button
                      onClick={() => setSourceType('server')}
                      className={`py-2 text-[10px] font-gaming font-bold rounded transition-all ${
                        sourceType === 'server' ? 'bg-accentRed text-white shadow-neonGlow' : 'text-textGray hover:text-white'
                      }`}
                    >
                      LIVE SERVER
                    </button>
                    <button
                      onClick={() => setSourceType('backup')}
                      className={`py-2 text-[10px] font-gaming font-bold rounded transition-all ${
                        sourceType === 'backup' ? 'bg-accentRed text-white shadow-neonGlow' : 'text-textGray hover:text-white'
                      }`}
                    >
                      SAVED BACKUP
                    </button>
                    <button
                      onClick={() => setSourceType('template')}
                      className={`py-2 text-[10px] font-gaming font-bold rounded transition-all ${
                        sourceType === 'template' ? 'bg-accentRed text-white shadow-neonGlow' : 'text-textGray hover:text-white'
                      }`}
                    >
                      TEMPLATE
                    </button>
                  </div>
                </div>

                {/* Source details input fields */}
                {sourceType === 'server' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-textGray uppercase">Source Discord Server</label>
                    <select
                      value={selectedSourceServer}
                      onChange={(e) => setSelectedSourceServer(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                    >
                      <option value="">-- Choose Server --</option>
                      {botGuilds.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-textGray/60 block">Copy layout structure directly from this active guild.</span>
                  </div>
                )}

                {sourceType === 'backup' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-textGray uppercase">Select Backup Snapshot</label>
                    <select
                      value={selectedSourceBackup}
                      onChange={(e) => setSelectedSourceBackup(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                    >
                      <option value="">-- Choose Backup Snapshot --</option>
                      {backups.map(b => (
                        <option key={b.backupId} value={b.backupId}>{b.backupName || b.name} ({b.backupId})</option>
                      ))}
                    </select>
                  </div>
                )}

                {sourceType === 'template' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-textGray uppercase">Select Marketplace Layout Template</label>
                    <select
                      value={selectedSourceTemplate}
                      onChange={(e) => setSelectedSourceTemplate(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                    >
                      <option value="">-- Choose Template Layout --</option>
                      {templates.map(t => (
                        <option key={t.templateId} value={t.templateId}>{t.name} (Slug: {t.templateId})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Target Server selection */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-textGray uppercase">Target Destination Server</label>
                    <span className="text-[9px] font-gaming font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Active Target</span>
                  </div>
                  <select
                    value={targetServer}
                    onChange={(e) => setTargetServer(e.target.value)}
                    className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2.5 focus:outline-none focus:border-accentRed"
                  >
                    {botGuilds.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-accentRed/70 block">⚠️ Warning: The current setup on the target server will be overwritten.</span>
                </div>

                {/* Trigger buttons */}
                <div className="pt-2">
                  <button
                    onClick={triggerClone}
                    disabled={activeRestore && activeRestore.status === 'processing'}
                    className="w-full bg-accentRed hover:bg-accentRedHover disabled:bg-accentRed/40 text-white font-gaming font-black tracking-wider text-xs py-3.5 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-neonGlow hover:shadow-neonHover"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-slow" />
                    <span>CLONE SERVER LAYOUT</span>
                  </button>
                  {cloningStatus && (
                    <span className="text-[10px] text-center text-textGray/60 block mt-2">{cloningStatus}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Layout Previewer Card */}
            <div className="glass-card p-6 rounded-xl border-borderColor/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5 mb-4">
                  <Eye className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">2. Preview Layout</h3>
                </div>

                {previewData ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-black text-accentRed uppercase tracking-wider block">{previewData.type}</span>
                      <h4 className="text-sm font-gaming font-bold text-white uppercase mt-0.5">{previewData.name}</h4>
                      <p className="text-[10px] text-textGray leading-relaxed mt-1">{previewData.description}</p>
                    </div>

                    <div className="p-3 bg-[#08080c] border border-white/5 rounded-lg text-[10px] text-zinc-400 space-y-1 leading-relaxed">
                      <div>{previewData.info}</div>
                      {previewData.roles && <div>Roles: <strong>{previewData.roles.length}</strong></div>}
                      {previewData.channels && <div>Channels: <strong>{previewData.channels.length}</strong></div>}
                      {previewData.categories && <div>Categories: <strong>{previewData.categories.length}</strong></div>}
                    </div>

                    {/* Simple details preview list */}
                    {previewData.channels && (
                      <div className="max-h-36 overflow-y-auto border border-white/5 p-2 rounded bg-[#08080c] font-mono text-[9px] text-textGray space-y-1 scrollbar-thin">
                        {previewData.categories?.map((cat, ci) => (
                          <div key={ci} className="space-y-0.5">
                            <div className="text-white font-bold">📂 {cat.name}</div>
                            {previewData.channels.filter(c => c.parentId === cat.id || c.parentName === cat.name).map((ch, chi) => (
                              <div key={chi} className="pl-3">
                                {ch.type === 2 ? '🔊' : '💬'} {ch.name}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-xs text-textGray italic">
                    Select a source layout configuration on the left to review its preview details before executing clone.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 text-[9px] text-textGray/55 flex items-center space-x-1.5 leading-relaxed">
                <Info className="w-3.5 h-3.5 text-accentRed shrink-0" />
                <span>RAGE cloner handles rate-limits and permissions hierarchies automatically in the background queue.</span>
              </div>
            </div>
          </div>

          {/* TEMPLATE MARKETPLACE SECTION */}
          <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/5 gap-4">
              <div className="flex items-center space-x-3">
                <Compass className="w-5 h-5 text-accentRed" />
                <h3 className="font-gaming font-bold text-white uppercase text-md">Browse Marketplace Layout Templates</h3>
              </div>
              <div className="relative flex-1 max-w-sm w-full">
                <Search className="w-3.5 h-3.5 text-textGray/50 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Filter templates..."
                  className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-[10px] pl-8 pr-4 py-2.5 focus:outline-none focus:border-accentRed"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/5">
              {['All', 'Esports', 'Marketplace', 'Community', 'Development', 'General', 'Free Fire', 'Scrims', 'VIP', 'Support'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-3 py-1.5 text-[9px] font-bold font-gaming rounded transition-all shrink-0 ${
                    templateCategory === cat
                      ? 'bg-accentRed text-white shadow-neonGlow'
                      : 'bg-white/5 text-textGray hover:text-white'
                  }`}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Templates grid */}
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-xs text-textGray italic">No layout templates matching filters.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map(tpl => {
                  const tChans = tpl.backupData?.channels?.length + tpl.backupData?.categories?.length || 0;
                  const tRoles = tpl.backupData?.roles?.length || 0;
                  const isFav = favorites.includes(tpl.templateId);
                  return (
                    <div key={tpl._id} className="p-4 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[8px] font-gaming font-black px-1.5 py-0.5 bg-accentRed/10 text-accentRed rounded uppercase tracking-wider">
                            {tpl.category}
                          </span>
                          <button
                            onClick={() => handleFavoriteToggle(tpl.templateId)}
                            className="p-1 hover:bg-white/5 rounded text-textGray hover:text-red-400 transition-all"
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-accentRed text-accentRed' : 'text-textGray'}`} />
                          </button>
                        </div>
                        <h4 className="text-sm font-gaming font-bold text-white uppercase truncate mb-1">{tpl.name}</h4>
                        <p className="text-[10px] text-textGray leading-relaxed min-h-[30px] line-clamp-2">{tpl.description}</p>
                      </div>

                      <div className="border-t border-white/5 pt-3 mt-3 flex items-center justify-between gap-2">
                        <div className="text-[9px] text-textGray/60">
                          Installs: <strong className="text-white">{tpl.installCount || 0}</strong> • Roles: {tRoles} • Chans: {tChans}
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => {
                              setSourceType('template');
                              setSelectedSourceTemplate(tpl.templateId);
                            }}
                            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-gaming font-bold tracking-wider rounded text-zinc-300 transition-all"
                          >
                            SELECT
                          </button>
                          <button
                            onClick={() => {
                              setSourceType('template');
                              setSelectedSourceTemplate(tpl.templateId);
                              triggerClone();
                            }}
                            className="px-2.5 py-1.5 bg-accentRed hover:bg-accentRedHover text-[9px] font-gaming font-bold tracking-wider rounded text-white transition-all shadow-neonGlow"
                          >
                            INSTALL
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BACKUP MANAGER CARD */}
          <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
            <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
              <Database className="w-5 h-5 text-accentRed" />
              <h3 className="font-gaming font-bold text-white uppercase text-md">Web Backup Snapshot Manager</h3>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-6 text-xs text-textGray italic">No backups found. Create a snapshot in the Shield & Backups tab.</div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 scrollbar-thin">
                {backups.map(bkp => {
                  const bChans = bkp.backupData ? (bkp.backupData.channels?.length + bkp.backupData.categories?.length || 0) : (bkp.channels?.length || 0);
                  const bRoles = bkp.backupData ? (bkp.backupData.roles?.length || 0) : (bkp.roles?.length || 0);
                  return (
                    <div key={bkp._id} className="p-3 rounded-lg bg-white/4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">{bkp.backupName || bkp.name}</span>
                          <span className="text-[9px] font-mono bg-white/5 text-textGray px-1.5 py-0.5 rounded">{bkp.backupId}</span>
                        </div>
                        <span className="text-[10px] text-textGray/60 block mt-0.5">
                          Created: {new Date(bkp.createdAt).toLocaleString()} • Channels: {bChans} • Roles: {bRoles}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setSourceType('backup');
                            setSelectedSourceBackup(bkp.backupId);
                          }}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] font-semibold border border-white/5"
                        >
                          Select Source
                        </button>
                        <button
                          onClick={() => handleDownloadJSON(bkp)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 rounded text-[10px] font-semibold border border-white/5"
                        >
                          Download JSON
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
