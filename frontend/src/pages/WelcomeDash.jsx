import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import EmbedBuilder from '../components/EmbedBuilder';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, UserPlus, FileText, CheckSquare, Plus, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';

export default function WelcomeDash() {
  const { guildId } = useParams();
  const { backendUrl } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState('');
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/guilds/${guildId}/settings`);
        setGuildName(response.data.guildName);
        setSettings(response.data.settings);
        setChannels(response.data.discordMetadata.channels);
        setRoles(response.data.discordMetadata.roles);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load settings', err);
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
      welcome: {
        ...prev.welcome,
        [field]: val
      }
    }));
  };

  const handleEmbedChange = (newEmbed) => {
    setSettings(prev => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        embed: newEmbed
      }
    }));
  };

  const addRole = () => {
    if (!newRole) return;
    if (settings.welcome.autoRoles.includes(newRole)) return;
    
    setSettings(prev => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        autoRoles: [...prev.welcome.autoRoles, newRole]
      }
    }));
    setNewRole('');
  };

  const removeRole = (roleId) => {
    setSettings(prev => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        autoRoles: prev.welcome.autoRoles.filter(r => r !== roleId)
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
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Welcome & DM</h2>
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
            {/* General Toggles */}
            <div className="glass-card p-6 rounded-xl border-borderColor/20 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.welcome.enabled}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="w-5 h-5 accent-accentRed rounded"
                  />
                  <div>
                    <span className="text-sm font-semibold text-white block">Enable Welcome Channel Messages</span>
                    <span className="text-xs text-textGray">Announce when a new member joins the server.</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.welcome.autoDm}
                    onChange={(e) => handleChange('autoDm', e.target.checked)}
                    className="w-5 h-5 accent-accentRed rounded"
                  />
                  <div>
                    <span className="text-sm font-semibold text-white block">Enable Welcome Direct Messages (DMs)</span>
                    <span className="text-xs text-textGray">Send a private greeting DM to new members.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Message and Channel Config */}
            {settings.welcome.enabled && (
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <FileText className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Welcome Channel settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Welcome Announcement Channel</label>
                    <select
                      value={settings.welcome.channelId}
                      onChange={(e) => handleChange('channelId', e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                    >
                      <option value="">Select Channel...</option>
                      {channels.filter(c => c.type === 0).map(c => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={settings.welcome.embed.enabled}
                        onChange={(e) => {
                          handleChange('embed', { ...settings.welcome.embed, enabled: e.target.checked });
                        }}
                        className="w-4.5 h-4.5 accent-accentRed rounded"
                      />
                      <div>
                        <span className="text-sm font-semibold text-white block">Use Discord Rich Embeds</span>
                        <span className="text-xs text-textGray">Replace text with custom cyber-embed card styles.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {settings.welcome.embed.enabled ? (
                  <EmbedBuilder 
                    embed={settings.welcome.embed} 
                    onChange={handleEmbedChange} 
                    guildName={guildName}
                  />
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Welcome Message Text</label>
                    <textarea
                      rows={3}
                      value={settings.welcome.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                      placeholder="Welcome {user} to {server}!"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['{user}', '{server}', '{membercount}'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleChange('message', settings.welcome.message + ' ' + v)}
                          className="bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] text-white px-2 py-1 rounded transition-all"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Direct Message Config */}
            {settings.welcome.autoDm && (
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-4">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <UserPlus className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Direct Message Greeting</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">DM Message Content</label>
                  <textarea
                    rows={4}
                    value={settings.welcome.dmMessage}
                    onChange={(e) => handleChange('dmMessage', e.target.value)}
                    className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                    placeholder="Welcome {user} to {server}! Let us know if you need anything."
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['{user}', '{server}', '{membercount}'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleChange('dmMessage', settings.welcome.dmMessage + ' ' + v)}
                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] text-white px-2 py-1 rounded transition-all"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Auto Roles Configuration */}
            <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
              <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                <CheckSquare className="w-5 h-5 text-accentRed" />
                <h3 className="font-gaming font-bold text-white uppercase text-md">Join Auto Roles</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Add Join Role</label>
                  <div className="flex space-x-2">
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-sm p-2.5 focus:outline-none focus:border-accentRed"
                    >
                      <option value="">Select Role...</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addRole}
                      className="bg-accentRed hover:bg-accentRedHover text-white px-4 rounded-lg flex items-center justify-center transition-all shadow-neonGlow"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textGray uppercase mb-2">Active Auto Roles</label>
                  {settings.welcome.autoRoles.length === 0 ? (
                    <span className="text-xs text-textGray italic">No auto roles configured. new users will not receive roles on join.</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {settings.welcome.autoRoles.map((roleId) => {
                        const roleObj = roles.find(r => r.id === roleId);
                        return (
                          <div
                            key={roleId}
                            className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-sm"
                          >
                            <span>{roleObj ? roleObj.name : 'Unknown Role'}</span>
                            <button
                              type="button"
                              onClick={() => removeRole(roleId)}
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
