import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, Shield, Trash2, Plus, ShieldAlert, History } from 'lucide-react';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';

export default function ModDash() {
  const { guildId } = useParams();
  const { backendUrl } = useAuth();

  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState('');
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [warnings, setWarnings] = useState([]);
  
  const [newWord, setNewWord] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Fetch settings & warnings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const settingsRes = await axios.get(`${backendUrl}/api/guilds/${guildId}/settings`);
        setGuildName(settingsRes.data.guildName);
        setSettings(settingsRes.data.settings);
        setChannels(settingsRes.data.discordMetadata.channels);

        const warningsRes = await axios.get(`${backendUrl}/api/guilds/${guildId}/warnings`);
        setWarnings(warningsRes.data);
        
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

      socket.on('warningAdded', (newWarn) => {
        setWarnings(prev => {
          if (prev.some(w => w._id === newWarn._id)) return prev;
          return [newWarn, ...prev];
        });
      });

      socket.on('warningDeleted', (deletedWarnId) => {
        setWarnings(prev => prev.filter(w => w._id !== deletedWarnId));
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
      moderation: {
        ...prev.moderation,
        [field]: !prev.moderation[field]
      }
    }));
  };

  const handleChange = (field, val) => {
    setSettings(prev => ({
      ...prev,
      moderation: {
        ...prev.moderation,
        [field]: val
      }
    }));
  };

  const addWord = () => {
    if (!newWord.trim()) return;
    if (settings.moderation.badWords.includes(newWord.trim())) return;

    setSettings(prev => ({
      ...prev,
      moderation: {
        ...prev.moderation,
        badWords: [...prev.moderation.badWords, newWord.trim()]
      }
    }));
    setNewWord('');
  };

  const removeWord = (word) => {
    setSettings(prev => ({
      ...prev,
      moderation: {
        ...prev.moderation,
        badWords: prev.moderation.badWords.filter(w => w !== word)
      }
    }));
  };

  const deleteWarning = async (warnId) => {
    try {
      await axios.delete(`${backendUrl}/api/guilds/${guildId}/warnings/${warnId}`);
      setWarnings(prev => prev.filter(w => w._id !== warnId));
    } catch (err) {
      console.error('Failed to delete warning', err);
    }
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
          <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
            <div>
              <span className="text-xs text-accentRed font-semibold uppercase tracking-widest">Configuration module</span>
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Auto Moderation</h2>
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
              {/* Automod filters list */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <Shield className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Safety Filters</h3>
                </div>

                {[
                  { label: 'Anti-Invite links blocker', desc: 'Auto-delete invite links to foreign Discord communities.', field: 'antiInvite' },
                  { label: 'Anti-Scam domain blocker', desc: 'Auto-delete nitro gifts phishing links and fake Steam domain lists.', field: 'antiScam' },
                  { label: 'Anti-Spam frequency detector', desc: 'Prevent spamming identical messages rapidly (more than 5 in 5 seconds).', field: 'antiSpam' },
                  { label: 'Ghost-Ping notification filter', desc: 'Log ghost pings when a user mentions and immediately deletes the message.', field: 'ghostPing' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between space-x-4">
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-white block mb-0.5">{item.label}</label>
                      <span className="text-xs text-textGray leading-relaxed">{item.desc}</span>
                    </div>
                    <button
                      onClick={() => handleToggle(item.field)}
                      className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${
                        settings.moderation[item.field] ? 'bg-accentRed' : 'bg-white/10'
                      }`}
                    >
                      <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-all duration-300 ${
                        settings.moderation[item.field] ? 'translate-x-5.5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}

                <div className="pt-4 border-t border-white/5">
                  <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Moderation Logs Channel</label>
                  <select
                    value={settings.moderation.logChannelId}
                    onChange={(e) => handleChange('logChannelId', e.target.value)}
                    className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-sm p-2.5 focus:outline-none focus:border-accentRed"
                  >
                    <option value="">Disable logs channel</option>
                    {channels.filter(c => c.type === 0).map(c => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warning Log history list */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <History className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Infractions History Logs</h3>
                </div>

                {warnings.length === 0 ? (
                  <div className="text-center py-6 text-xs text-textGray italic">No active warnings or infractions found for this server.</div>
                ) : (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                    {warnings.map((warn) => (
                      <div key={warn._id} className="p-4 rounded-lg bg-white/5 border border-white/5 flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-semibold text-white">{warn.userName}</span>
                            <span className="text-[10px] text-textGray">({warn.userId})</span>
                          </div>
                          <p className="text-xs text-textGray leading-relaxed mb-2"><strong>Reason:</strong> {warn.reason}</p>
                          <span className="text-[10px] text-textGray/60 block">Warned by {warn.warnedByName} • {new Date(warn.createdAt).toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => deleteWarning(warn._id)}
                          className="bg-accentRed/10 border border-accentRed/20 hover:bg-accentRed text-accentRed hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        >
                          Pardon
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Keyword blacklist sidebar */}
            <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6 self-start">
              <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                <ShieldAlert className="w-5 h-5 text-accentRed" />
                <h3 className="font-gaming font-bold text-white uppercase text-md">Banned Words</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Add Banned Word</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-sm px-2.5 py-1.5 focus:outline-none focus:border-accentRed"
                    placeholder="badword"
                  />
                  <button
                    onClick={addWord}
                    className="bg-accentRed hover:bg-accentRedHover text-white px-3 rounded-lg flex items-center justify-center transition-all shadow-neonGlow"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-textGray uppercase mb-1">Blacklist Word Pool</label>
                {settings.moderation.badWords.length === 0 ? (
                  <span className="text-xs text-textGray italic block">No banned words configured yet.</span>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {settings.moderation.badWords.map((word) => (
                      <div
                        key={word}
                        className="flex items-center space-x-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded text-xs"
                      >
                        <span>{word}</span>
                        <button
                          onClick={() => removeWord(word)}
                          className="text-textGray hover:text-accentRed transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
