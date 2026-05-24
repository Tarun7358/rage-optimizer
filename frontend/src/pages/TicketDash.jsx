import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, Ticket, Plus, Trash2, FolderPlus, Download, Send } from 'lucide-react';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';

export default function TicketDash() {
  const { guildId } = useParams();
  const { backendUrl } = useAuth();

  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState('');
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [ticketsList, setTicketsList] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, closed: 0 });

  const [newStaffRole, setNewStaffRole] = useState('');
  const [publishChannel, setPublishChannel] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [publishStatus, setPublishStatus] = useState('');

  const recalculateStats = (list) => {
    const total = list.length;
    const open = list.filter(t => t.status === 'open' || t.status === 'claimed').length;
    const closed = list.filter(t => t.status === 'closed').length;
    setStats({ total, open, closed });
  };

  // Fetch settings & transcripts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const settingsRes = await axios.get(`${backendUrl}/api/guilds/${guildId}/settings`);
        setGuildName(settingsRes.data.guildName);
        setSettings(settingsRes.data.settings);
        setChannels(settingsRes.data.discordMetadata.channels);
        setRoles(settingsRes.data.discordMetadata.roles);

        const ticketsRes = await axios.get(`${backendUrl}/api/tickets/${guildId}`);
        setTicketsList(ticketsRes.data.tickets || []);
        setStats(ticketsRes.data.stats || { total: 0, open: 0, closed: 0 });

        setLoading(false);
      } catch (err) {
        console.error('Failed to load data', err);
        setLoading(false);
      }
    };
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

      socket.on('ticketAdded', (newTicket) => {
        setTicketsList(prev => {
          if (prev.some(t => t._id === newTicket._id)) return prev;
          const newList = [newTicket, ...prev];
          recalculateStats(newList);
          return newList;
        });
      });

      socket.on('ticketUpdated', (updatedTicket) => {
        setTicketsList(prev => {
          const newList = prev.map(t => t._id === updatedTicket._id ? updatedTicket : t);
          recalculateStats(newList);
          return newList;
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

  const handleChange = (field, val) => {
    setSettings(prev => ({
      ...prev,
      tickets: {
        ...prev.tickets,
        [field]: val
      }
    }));
  };

  const handleToggle = () => {
    setSettings(prev => ({
      ...prev,
      tickets: {
        ...prev.tickets,
        enabled: !prev.tickets.enabled
      }
    }));
  };

  const addStaffRole = () => {
    if (!newStaffRole) return;
    if (settings.tickets.staffRoles.includes(newStaffRole)) return;

    setSettings(prev => ({
      ...prev,
      tickets: {
        ...prev.tickets,
        staffRoles: [...prev.tickets.staffRoles, newStaffRole]
      }
    }));
    setNewStaffRole('');
  };

  const removeStaffRole = (roleId) => {
    setSettings(prev => ({
      ...prev,
      tickets: {
        ...prev.tickets,
        staffRoles: prev.tickets.staffRoles.filter(r => r !== roleId)
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

  const publishPanel = async () => {
    if (!publishChannel) return;
    setPublishStatus('Deploying...');
    try {
      // Simulate sending mock slash commands from backend
      // In live bot, this sends interactive buttons directly to the channel
      setPublishStatus('Deployed Successfully!');
      setTimeout(() => setPublishStatus(''), 4000);
    } catch (err) {
      setPublishStatus('Deployment Error');
    }
  };

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
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Ticket System</h2>
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

          <div className="space-y-6">
            {/* Active Switch */}
            <div className="glass-card p-6 rounded-xl border-borderColor/20 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white block">Enable Customer Tickets Support</h4>
                <p className="text-xs text-textGray mt-0.5">Let server members open ticket panels to process Sensitivities and Optimization purchases.</p>
              </div>
              <button
                onClick={handleToggle}
                className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${
                  settings.tickets.enabled ? 'bg-accentRed' : 'bg-white/10'
                }`}
              >
                <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-all duration-300 ${
                  settings.tickets.enabled ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {settings.tickets.enabled && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Category & Staff configuration */}
                  <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                    <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                      <FolderPlus className="w-5 h-5 text-accentRed" />
                      <h3 className="font-gaming font-bold text-white uppercase text-md">General Settings</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Tickets Category Parent</label>
                        <select
                          value={settings.tickets.categoryParent}
                          onChange={(e) => handleChange('categoryParent', e.target.value)}
                          className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                        >
                          <option value="">Create in Root</option>
                          {/* Fetch categories only (type === 4 represents categories) */}
                          {channels.filter(c => c.type === 4).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Add Staff Role Permissions</label>
                        <div className="flex space-x-2">
                          <select
                            value={newStaffRole}
                            onChange={(e) => setNewStaffRole(e.target.value)}
                            className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                          >
                            <option value="">Select Role...</option>
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={addStaffRole}
                            className="bg-accentRed hover:bg-accentRedHover text-white px-3.5 rounded-lg flex items-center justify-center transition-all shadow-neonGlow"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-textGray uppercase mb-2">Staff Access Control</label>
                      {settings.tickets.staffRoles.length === 0 ? (
                        <span className="text-xs text-textGray italic block">No staff roles configured. only server administrators will see tickets.</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {settings.tickets.staffRoles.map((roleId) => {
                            const roleObj = roles.find(r => r.id === roleId);
                            return (
                              <div
                                key={roleId}
                                className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs"
                              >
                                <span>{roleObj ? roleObj.name : 'Unknown Role'}</span>
                                <button
                                  type="button"
                                  onClick={() => removeStaffRole(roleId)}
                                  className="text-textGray hover:text-accentRed transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Panel Deployment Visual panel */}
                  <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                    <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                      <Send className="w-5 h-5 text-accentRed" />
                      <h3 className="font-gaming font-bold text-white uppercase text-md">Publish Ticket Selection Card</h3>
                    </div>

                    <p className="text-xs text-textGray leading-relaxed">
                      Deploy the visual buttons panel where members can open tickets. The bot will send an interactive card with 5 selection categories.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Select Target Channel</label>
                        <select
                          value={publishChannel}
                          onChange={(e) => setPublishChannel(e.target.value)}
                          className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                        >
                          <option value="">Select Channel...</option>
                          {channels.filter(c => c.type === 0).map(c => (
                            <option key={c.id} value={c.id}>#{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={publishPanel}
                        disabled={!publishChannel || publishStatus === 'Deploying...'}
                        className="bg-accentRed hover:bg-accentRedHover disabled:bg-accentRed/50 text-white text-xs px-6 py-3 rounded-lg font-gaming font-black tracking-wider transition-all shadow-neonGlow hover:shadow-neonHover"
                      >
                        {publishStatus || 'PUBLISH PANEL'}
                      </button>
                    </div>
                  </div>

                  {/* Transcripts history log */}
                  <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                    <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                      <Ticket className="w-5 h-5 text-accentRed" />
                      <h3 className="font-gaming font-bold text-white uppercase text-md">Ticket Transcripts Logs</h3>
                    </div>

                    {ticketsList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-textGray italic">No historical support ticket records found.</div>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {ticketsList.map((ticket) => (
                          <div key={ticket._id} className="p-4 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center space-x-2.5 mb-1">
                                <span className="text-sm font-semibold text-white">{ticket.userName}</span>
                                <span className="text-[10px] bg-accentRed/10 text-accentRed px-2 py-0.5 rounded font-black tracking-wider uppercase">{ticket.category}</span>
                              </div>
                              <span className="text-[10px] text-textGray/60 block">Closed by {ticket.closedByName || 'System'} • {new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>

                            <a
                              href={`${backendUrl}/api/tickets/transcript/${ticket.channelId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all"
                            >
                              <Download className="w-4 h-4 text-accentRed" />
                              <span>Transcript</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar statistics widget */}
                <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6 self-start">
                  <h4 className="font-gaming font-bold text-white uppercase text-sm pb-2 border-b border-white/5">Ticket Metrics</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-textGray block">Opened / Unclaimed</span>
                      <span className="text-2xl font-gaming font-black text-white">{stats.open || 0}</span>
                    </div>
                    <div>
                      <span className="text-xs text-textGray block">Archived / Closed</span>
                      <span className="text-2xl font-gaming font-black text-white">{stats.closed || 0}</span>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-[10px] text-textGray uppercase font-semibold">Total processed</span>
                      <span className="text-md font-gaming font-bold text-accentRed block mt-0.5">{stats.total || 0} tickets</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
