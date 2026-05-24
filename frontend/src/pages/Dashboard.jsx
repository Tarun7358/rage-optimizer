import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Save, ShieldCheck, AlertTriangle, Users, Ticket,
  Activity, Clock, Wifi, CheckCircle, AlertCircle, ToggleLeft, ToggleRight,
  RefreshCw, Server, Shield, Bell, Lock
} from 'lucide-react';

// Toggle Switch Component
function Toggle({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none ${
        enabled ? 'bg-accentRed shadow-neonGlow' : 'bg-white/10'
      }`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

// Stat mini card
function StatCard({ icon: Icon, label, value, color = 'text-accentRed', suffix = '' }) {
  return (
    <div className="bg-white/4 border border-white/6 rounded-xl p-4 flex flex-col items-center text-center">
      <Icon className={`w-5 h-5 ${color} mb-2 opacity-80`} />
      <span className={`text-xl font-gaming font-black tracking-wide ${color}`}>{value}{suffix}</span>
      <span className="text-[10px] text-textGray font-semibold uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { guildId } = useParams();
  const { backendUrl } = useAuth();

  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState('Guild');
  const [settings, setSettings] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [liveStats, setLiveStats] = useState(null);
  const [discordMeta, setDiscordMeta] = useState({ channels: [], roles: [] });
  const [activity, setActivity] = useState([]);
  const socketRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Fetch guild settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/guilds/${guildId}/settings`);
        setGuildName(res.data.guildName);
        setSettings(res.data.settings);
        setDiscordMeta(res.data.discordMetadata || { channels: [], roles: [] });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load guild settings', err);
        setLoading(false);
      }
    };
    fetchSettings();
  }, [guildId, backendUrl]);

  // Live bot stats via SSE
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${backendUrl}/api/stats/live`);
      eventSourceRef.current = es;
      es.onmessage = (e) => {
        try { setLiveStats(JSON.parse(e.data)); } catch {}
      };
      es.onerror = () => { es.close(); setTimeout(connect, 8000); };
    };
    connect();
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, [backendUrl]);

  // Realtime settings sync: Firebase RTDB or Socket.IO fallback
  useEffect(() => {
    let unsubFirebase = null;

    if (!isMock && rtdb) {
      const settingsRef = ref(rtdb, `guilds/${guildId}/settings`);
      unsubFirebase = onValue(settingsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) setSettings(val);
      });
    } else {
      const socket = io(backendUrl);
      socketRef.current = socket;
      socket.emit('joinGuild', guildId);

      socket.on('settingsUpdate', (updated) => {
        setSettings(updated);
        addActivity({ type: 'settings', msg: 'Settings synced from remote change', ts: Date.now() });
      });

      socket.on('warningAdded', (warn) => {
        addActivity({ type: 'warn', msg: `Warning issued to ${warn.userName}`, ts: Date.now() });
      });

      socket.on('ticketAdded', (ticket) => {
        addActivity({ type: 'ticket', msg: `New ticket opened by ${ticket.userName}`, ts: Date.now() });
      });

      socket.on('securityLogAdded', (log) => {
        addActivity({ type: 'security', msg: log.details, ts: Date.now() });
      });
    }

    return () => {
      if (unsubFirebase) unsubFirebase();
      if (socketRef.current) {
        socketRef.current.emit('leaveGuild', guildId);
        socketRef.current.disconnect();
      }
    };
  }, [guildId, backendUrl]);

  const addActivity = (item) => {
    setActivity(prev => [item, ...prev].slice(0, 8));
  };

  const handleToggle = (module, subfield) => {
    setSettings(prev => ({
      ...prev,
      [module]: { ...prev[module], [subfield]: !prev[module][subfield] }
    }));
  };

  const saveSettings = async () => {
    setSaveStatus('saving');
    try {
      await axios.put(`${backendUrl}/api/guilds/${guildId}/settings`, settings);
      setSaveStatus('saved');
      addActivity({ type: 'settings', msg: 'Settings saved successfully', ts: Date.now() });
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const formatUptime = (s) => {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const modules = [
    { label: 'Welcome Messages', module: 'welcome', field: 'enabled', icon: Users, desc: 'Auto-greet members, assign starter roles, send DM.' },
    { label: 'Auto Moderation', module: 'moderation', field: 'autoMod', icon: Shield, desc: 'Scan for links, bad words, scam, and spam.' },
    { label: 'Ticket System', module: 'tickets', field: 'enabled', icon: Ticket, desc: 'Enable multi-category support ticket buttons.' },
    { label: 'Anti-Nuke Security', module: 'security', field: 'antiNuke', icon: Lock, desc: 'Block mass channel/role destruction attempts.' },
  ];

  const activityIcons = {
    settings: { icon: Settings, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    ticket: { icon: Ticket, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    security: { icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-white/5 rounded-full" />
            <div className="w-16 h-16 border-t-2 border-accentRed rounded-full animate-spin absolute inset-0" />
          </div>
          <span className="text-textGray text-sm font-semibold tracking-wider">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] pt-16 flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[11px] text-accentRed font-bold uppercase tracking-[0.15em]">Server Console</span>
              <h1 className="text-2xl font-gaming font-black text-white mt-1 uppercase tracking-wider">{guildName}</h1>
              <p className="text-textGray text-xs mt-1">Manage your bot configuration in real-time</p>
            </div>

            <button
              onClick={saveSettings}
              disabled={saveStatus === 'saving'}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-gaming font-black tracking-wider text-xs transition-all self-start sm:self-auto ${
                saveStatus === 'saved'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : saveStatus === 'error'
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                  : 'bg-accentRed hover:bg-accentRedHover text-white shadow-neonGlow hover:shadow-neonHover'
              }`}
            >
              {saveStatus === 'saving' ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /><span>SAVING...</span></>
              ) : saveStatus === 'saved' ? (
                <><CheckCircle className="w-4 h-4" /><span>SAVED!</span></>
              ) : saveStatus === 'error' ? (
                <><AlertCircle className="w-4 h-4" /><span>ERROR</span></>
              ) : (
                <><Save className="w-4 h-4" /><span>SAVE CHANGES</span></>
              )}
            </button>
          </div>

          {/* ── Live Bot Stat Cards ── */}
          {liveStats && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <StatCard icon={Server} label="Guilds" value={liveStats.servers} color="text-accentRed" />
              <StatCard icon={Users} label="Members" value={liveStats.members.toLocaleString()} color="text-blue-400" />
              <StatCard icon={Wifi} label="Ping" value={liveStats.ping} suffix="ms" color={liveStats.ping < 100 ? 'text-emerald-400' : 'text-yellow-400'} />
              <StatCard icon={Clock} label="Uptime" value={formatUptime(liveStats.uptimeSeconds)} color="text-purple-400" />
            </motion.div>
          )}

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Module Toggles */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center space-x-3 px-5 py-4 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-accentRed/10 border border-accentRed/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-accentRed" />
                </div>
                <div>
                  <h3 className="font-gaming font-bold text-white text-sm uppercase tracking-wider">Active Modules</h3>
                  <p className="text-[10px] text-textGray">Enable or disable core bot systems</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {modules.map((item, idx) => {
                  const Icon = item.icon;
                  const isEnabled = settings?.[item.module]?.[item.field];
                  return (
                    <div key={idx} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isEnabled ? 'bg-accentRed/5 border-accentRed/15' : 'bg-white/3 border-white/5'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isEnabled ? 'bg-accentRed/15 border border-accentRed/25' : 'bg-white/5 border border-white/5'
                        }`}>
                          <Icon className={`w-4 h-4 ${isEnabled ? 'text-accentRed' : 'text-textGray'}`} />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-white block">{item.label}</label>
                          <span className="text-[10px] text-textGray">{item.desc}</span>
                        </div>
                      </div>
                      <Toggle enabled={isEnabled} onToggle={() => handleToggle(item.module, item.field)} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: System stats + Activity */}
            <div className="space-y-5">
              {/* Server Quick Stats */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center space-x-3 px-5 py-4 border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-gaming font-bold text-white text-sm uppercase tracking-wider">Server Stats</h3>
                    <p className="text-[10px] text-textGray">Current configuration snapshot</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/4 border border-white/6 rounded-xl p-4 text-center">
                      <span className="block text-xl font-gaming font-black text-white tracking-wide">
                        {settings.welcome?.autoRoles?.length || 0}
                      </span>
                      <span className="text-[10px] text-textGray uppercase font-semibold tracking-wider">Auto-Roles</span>
                    </div>
                    <div className="bg-white/4 border border-white/6 rounded-xl p-4 text-center">
                      <span className="block text-xl font-gaming font-black text-white tracking-wide">
                        {settings.moderation?.badWords?.length || 0}
                      </span>
                      <span className="text-[10px] text-textGray uppercase font-semibold tracking-wider">Banned Words</span>
                    </div>
                    <div className="bg-white/4 border border-white/6 rounded-xl p-4 text-center">
                      <span className="block text-xl font-gaming font-black text-white tracking-wide">
                        {discordMeta.channels.filter(c => c.type === 0).length}
                      </span>
                      <span className="text-[10px] text-textGray uppercase font-semibold tracking-wider">Channels</span>
                    </div>
                    <div className="bg-white/4 border border-white/6 rounded-xl p-4 text-center">
                      <span className="block text-xl font-gaming font-black text-white tracking-wide">
                        {discordMeta.roles.length}
                      </span>
                      <span className="text-[10px] text-textGray uppercase font-semibold tracking-wider">Roles</span>
                    </div>
                  </div>

                  {/* Permission warning */}
                  <div className="p-3.5 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex items-start space-x-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-yellow-300 leading-relaxed">
                      <strong>Important:</strong> Keep the <span className="font-mono bg-yellow-500/10 px-1 rounded">RAGE OPTIMIZER</span> role at the top of your role hierarchy for ban/kick to work.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-gaming font-bold text-white text-sm uppercase tracking-wider">Live Activity</h3>
                      <p className="text-[10px] text-textGray">Real-time socket events</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="p-4">
                  {activity.length === 0 ? (
                    <div className="text-center py-6">
                      <Activity className="w-8 h-8 text-textGray/30 mx-auto mb-2" />
                      <p className="text-xs text-textGray/50">Listening for events...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {activity.map((item, i) => {
                          const cfg = activityIcons[item.type] || activityIcons.settings;
                          const Icon = cfg.icon;
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-start space-x-3 p-3 rounded-lg border ${cfg.bg}`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${cfg.color} mt-0.5 shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/80 leading-snug truncate">{item.msg}</p>
                                <p className="text-[10px] text-textGray/50 mt-0.5">
                                  {new Date(item.ts).toLocaleTimeString()}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Bot Status Footer ── */}
          {liveStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-accentRed/10 border border-accentRed/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-accentRed" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{liveStats.botTag}</div>
                  <div className="text-[11px] text-textGray">
                    {liveStats.isLive ? 'Connected to Discord Gateway' : 'Running in Mock Mode'}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-xs">
                <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${
                  liveStats.isLive
                    ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20'
                    : 'bg-yellow-500/8 text-yellow-400 border-yellow-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${liveStats.isLive ? 'bg-emerald-400 animate-ping' : 'bg-yellow-400'}`} />
                  <span>{liveStats.isLive ? 'LIVE' : 'MOCK'}</span>
                </div>
                <div className="text-textGray">
                  Serving <span className="text-white font-semibold">{liveStats.servers}</span> guild{liveStats.servers !== 1 ? 's' : ''}
                </div>
                <div className="text-textGray">
                  Ping: <span className={liveStats.ping < 100 ? 'text-emerald-400' : 'text-yellow-400'}>{liveStats.ping}ms</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
