import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, Bell, Plus, Trash2, Video, Radio, Camera, List, Shield, CheckSquare, MessageSquare, User, Info } from 'lucide-react';
import { io } from 'socket.io-client';
import { ref, onValue } from 'firebase/database';
import { rtdb, isMock } from '../config/firebase';

export default function NotificationDash() {
  const { guildId } = useParams();
  const { backendUrl } = useAuth();

  const [loading, setLoading] = useState(true);
  const [guildName, setGuildName] = useState('');
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  
  const [saveStatus, setSaveStatus] = useState('');
  const [activeTab, setActiveTab] = useState('social'); // 'social' | 'logs'
  
  // Forms inputs
  const [ytUrl, setYtUrl] = useState('');
  const [ytChan, setYtChan] = useState('');
  
  const [twitchName, setTwitchName] = useState('');
  const [twitchChan, setTwitchChan] = useState('');

  const [instaName, setInstaName] = useState('');
  const [instaChan, setInstaChan] = useState('');

  // Channel Specific Logs Inputs
  const [specSourceChan, setSpecSourceChan] = useState('');
  const [specTargetChan, setSpecTargetChan] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/guilds/${guildId}/settings`);
        setGuildName(response.data.guildName);
        setSettings(response.data.settings);
        setChannels(response.data.discordMetadata.channels);
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

  const addYoutube = () => {
    if (!ytUrl || !ytChan) return;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        youtube: [...prev.notifications.youtube, { channelUrl: ytUrl, alertChannelId: ytChan }]
      }
    }));
    setYtUrl('');
    setYtChan('');
  };

  const removeYoutube = (idx) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        youtube: prev.notifications.youtube.filter((_, i) => i !== idx)
      }
    }));
  };

  const addTwitch = () => {
    if (!twitchName || !twitchChan) return;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        twitch: [...prev.notifications.twitch, { streamerName: twitchName, alertChannelId: twitchChan, isLive: false }]
      }
    }));
    setTwitchName('');
    setTwitchChan('');
  };

  const removeTwitch = (idx) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        twitch: prev.notifications.twitch.filter((_, i) => i !== idx)
      }
    }));
  };

  const addInstagram = () => {
    if (!instaName || !instaChan) return;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        instagram: [...prev.notifications.instagram, { username: instaName, alertChannelId: instaChan }]
      }
    }));
    setInstaName('');
    setInstaChan('');
  };

  const removeInstagram = (idx) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        instagram: prev.notifications.instagram.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleServerLogsChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      serverLogs: {
        ...prev.serverLogs,
        [field]: value
      }
    }));
  };

  const handleEventToggle = (eventName) => {
    setSettings(prev => ({
      ...prev,
      serverLogs: {
        ...prev.serverLogs,
        events: {
          ...prev.serverLogs?.events,
          [eventName]: !prev.serverLogs?.events?.[eventName]
        }
      }
    }));
  };

  const handleEventChannelChange = (eventName, channelId) => {
    setSettings(prev => ({
      ...prev,
      serverLogs: {
        ...prev.serverLogs,
        eventChannels: {
          ...prev.serverLogs?.eventChannels,
          [eventName]: channelId
        }
      }
    }));
  };

  const handleToggleAllEvents = (enabled) => {
    setSettings(prev => {
      const newEvents = {};
      const eventKeys = [
        'messageDelete', 'messageEdit', 'messageDeleteBulk',
        'trackInvites', 'messagePin', 'messageUnpin',
        'memberJoin', 'memberLeave', 'roleGiven', 'roleRemoved'
      ];
      eventKeys.forEach(k => {
        newEvents[k] = enabled;
      });
      return {
        ...prev,
        serverLogs: {
          ...prev.serverLogs,
          events: newEvents
        }
      };
    });
  };

  const addChannelSpecificLog = () => {
    if (!specSourceChan || !specTargetChan) return;
    setSettings(prev => {
      const list = prev.serverLogs?.channelSpecific || [];
      if (list.some(item => item.sourceChannelId === specSourceChan)) return prev;
      return {
        ...prev,
        serverLogs: {
          ...prev.serverLogs,
          channelSpecific: [...list, { sourceChannelId: specSourceChan, targetChannelId: specTargetChan }]
        }
      };
    });
    setSpecSourceChan('');
    setSpecTargetChan('');
  };

  const removeChannelSpecificLog = (sourceChanId) => {
    setSettings(prev => ({
      ...prev,
      serverLogs: {
        ...prev.serverLogs,
        channelSpecific: (prev.serverLogs?.channelSpecific || []).filter(item => item.sourceChannelId !== sourceChanId)
      }
    }));
  };

  const saveSettings = async () => {
    setSaveStatus('Saving...');
    try {
      await axios.put(`${backendUrl}/api/guilds/${guildId}/settings`, settings);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 3500);
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
          <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-6">
            <div>
              <span className="text-xs text-accentRed font-semibold uppercase tracking-widest">Configuration module</span>
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">
                {activeTab === 'social' ? 'Social Feeds' : 'Server Logs'}
              </h2>
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

          {/* Navigation Tabs */}
          <div className="flex space-x-2 mb-8 bg-white/5 p-1 rounded-xl border border-white/5 w-fit">
            <button
              onClick={() => setActiveTab('social')}
              className={`px-4 py-2.5 rounded-lg text-xs font-gaming font-bold uppercase tracking-wider transition-all ${
                activeTab === 'social'
                  ? 'bg-accentRed text-white shadow-neonGlow'
                  : 'text-textGray hover:text-white hover:bg-white/5'
              }`}
            >
              Social Feeds
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 rounded-lg text-xs font-gaming font-bold uppercase tracking-wider transition-all ${
                activeTab === 'logs'
                  ? 'bg-accentRed text-white shadow-neonGlow'
                  : 'text-textGray hover:text-white hover:bg-white/5'
              }`}
            >
              Server Logs
            </button>
          </div>

          {activeTab === 'social' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* YouTube alerts */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-2 border-b border-white/5">
                  <Video className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">YouTube Announcements</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">YouTube Channel URL</label>
                      <input
                        type="text"
                        value={ytUrl}
                        onChange={(e) => setYtUrl(e.target.value)}
                        placeholder="https://youtube.com/@channel"
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Discord Target Channel</label>
                      <select
                        value={ytChan}
                        onChange={(e) => setYtChan(e.target.value)}
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                      >
                        <option value="">Select Channel...</option>
                        {channels.filter(c => c.type === 0).map(c => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={addYoutube}
                      className="bg-accentRed hover:bg-accentRedHover text-white text-xs py-2 rounded-lg font-gaming font-black tracking-wider transition-all"
                    >
                      ADD YOUTUBE ALERT
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    {settings.notifications.youtube.length === 0 ? (
                      <span className="text-xs text-textGray italic block">No YouTube alert pipelines configured.</span>
                    ) : (
                      settings.notifications.youtube.map((yt, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-2 rounded text-xs">
                          <div className="truncate pr-4">
                            <span className="text-white block truncate">{yt.channelUrl}</span>
                            <span className="text-[10px] text-textGray">Announces in #{channels.find(c => c.id === yt.alertChannelId)?.name || 'unknown'}</span>
                          </div>
                          <button onClick={() => removeYoutube(idx)} className="text-textGray hover:text-accentRed transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Twitch alerts */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-2 border-b border-white/5">
                  <Radio className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Twitch Live Alerts</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Twitch Streamer Name</label>
                      <input
                        type="text"
                        value={twitchName}
                        onChange={(e) => setTwitchName(e.target.value)}
                        placeholder="streamer_name"
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Discord Target Channel</label>
                      <select
                        value={twitchChan}
                        onChange={(e) => setTwitchChan(e.target.value)}
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                      >
                        <option value="">Select Channel...</option>
                        {channels.filter(c => c.type === 0).map(c => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={addTwitch}
                      className="bg-accentRed hover:bg-accentRedHover text-white text-xs py-2 rounded-lg font-gaming font-black tracking-wider transition-all"
                    >
                      ADD TWITCH ALERT
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    {settings.notifications.twitch.length === 0 ? (
                      <span className="text-xs text-textGray italic block">No Twitch alert pipelines configured.</span>
                    ) : (
                      settings.notifications.twitch.map((twitch, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-2 rounded text-xs">
                          <div>
                            <span className="text-white block font-semibold">{twitch.streamerName}</span>
                            <span className="text-[10px] text-textGray">Announces in #{channels.find(c => c.id === twitch.alertChannelId)?.name || 'unknown'}</span>
                          </div>
                          <button onClick={() => removeTwitch(idx)} className="text-textGray hover:text-accentRed transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Instagram alerts */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center space-x-3 pb-2 border-b border-white/5">
                  <Camera className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Instagram Feeds</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Instagram Username</label>
                      <input
                        type="text"
                        value={instaName}
                        onChange={(e) => setInstaName(e.target.value)}
                        placeholder="instagram_profile"
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Discord Target Channel</label>
                      <select
                        value={instaChan}
                        onChange={(e) => setInstaChan(e.target.value)}
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                      >
                        <option value="">Select Channel...</option>
                        {channels.filter(c => c.type === 0).map(c => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={addInstagram}
                      className="bg-accentRed hover:bg-accentRedHover text-white text-xs py-2 rounded-lg font-gaming font-black tracking-wider transition-all"
                    >
                      ADD INSTAGRAM ALERT
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    {settings.notifications.instagram.length === 0 ? (
                      <span className="text-xs text-textGray italic block">No Instagram alert pipelines configured.</span>
                    ) : (
                      settings.notifications.instagram.map((insta, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-2 rounded text-xs">
                          <div>
                            <span className="text-white block font-semibold">{insta.username}</span>
                            <span className="text-[10px] text-textGray">Announces in #{channels.find(c => c.id === insta.alertChannelId)?.name || 'unknown'}</span>
                          </div>
                          <button onClick={() => removeInstagram(idx)} className="text-textGray hover:text-accentRed transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              {/* SERVER LOGS CHANNEL CARD */}
              <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center space-x-3">
                    <List className="w-5 h-5 text-accentRed" />
                    <h3 className="font-gaming font-bold text-white uppercase text-md">Server Logs</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleServerLogsChange('enabled', !(settings.serverLogs?.enabled))}
                    className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${
                      settings.serverLogs?.enabled ? 'bg-accentRed' : 'bg-white/10'
                    }`}
                  >
                    <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-all duration-300 ${
                      settings.serverLogs?.enabled ? 'translate-x-5.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {settings.serverLogs?.enabled && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-textGray uppercase mb-1.5 font-gaming">Server Logs Channel</label>
                      <select
                        value={settings.serverLogs?.channelId || ''}
                        onChange={(e) => handleServerLogsChange('channelId', e.target.value)}
                        className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-sm p-2.5 focus:outline-none focus:border-accentRed"
                      >
                        <option value="">Select Channel...</option>
                        {channels.filter(c => c.type === 0).map(c => (
                          <option key={c.id} value={c.id}># {c.name}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-textGray mt-1.5 leading-relaxed">
                        This channel is where server logs are going to be sent. Server logs are mostly all actions made in the server, for example: channel created, role edited, member joined, etc.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div>
                        <h4 className="text-sm font-semibold text-white font-gaming">Select Channel for Each Event</h4>
                        <p className="text-[10px] text-textGray mt-1">Whether to select a channel for each event or use the same channel for all events.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleServerLogsChange('splitEvents', !(settings.serverLogs?.splitEvents))}
                        className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${
                          settings.serverLogs?.splitEvents ? 'bg-accentRed' : 'bg-white/10'
                        }`}
                      >
                        <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-all duration-300 ${
                          settings.serverLogs?.splitEvents ? 'translate-x-5.5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {settings.serverLogs?.enabled && (
                <>
                  {/* CHANNEL-SPECIFIC LOGS */}
                  <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                    <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                      <MessageSquare className="w-5 h-5 text-accentRed" />
                      <h3 className="font-gaming font-bold text-white uppercase text-md">Channel-Specific Logs</h3>
                    </div>
                    <p className="text-xs text-textGray">
                      Configure dedicated log channels for specific source channels. Events from mapped channels will only be sent to their dedicated log channel.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Source Channel</label>
                        <select
                          value={specSourceChan}
                          onChange={(e) => setSpecSourceChan(e.target.value)}
                          className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                        >
                          <option value="">Select Source...</option>
                          {channels.filter(c => c.type === 0).map(c => (
                            <option key={c.id} value={c.id}># {c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Target Log Channel</label>
                        <div className="flex space-x-2">
                          <select
                            value={specTargetChan}
                            onChange={(e) => setSpecTargetChan(e.target.value)}
                            className="w-full bg-white/5 border border-borderColor text-white rounded-xl text-xs p-2 focus:outline-none focus:border-accentRed"
                          >
                            <option value="">Select Target...</option>
                            {channels.filter(c => c.type === 0).map(c => (
                              <option key={c.id} value={c.id}># {c.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addChannelSpecificLog}
                            className="bg-accentRed hover:bg-accentRedHover text-white px-4 rounded-lg flex items-center justify-center transition-all shadow-neonGlow"
                          >
                            <Plus className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      {(settings.serverLogs?.channelSpecific || []).length === 0 ? (
                        <span className="text-xs text-textGray italic block">No channel-specific logs mapped.</span>
                      ) : (
                        (settings.serverLogs?.channelSpecific || []).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-2 rounded text-xs">
                            <div>
                              <span className="text-white">Events in </span>
                              <span className="font-semibold text-accentRed">#{channels.find(c => c.id === item.sourceChannelId)?.name || 'unknown'}</span>
                              <span className="text-white"> log to </span>
                              <span className="font-semibold text-accentRed">#{channels.find(c => c.id === item.targetChannelId)?.name || 'unknown'}</span>
                            </div>
                            <button onClick={() => removeChannelSpecificLog(item.sourceChannelId)} className="text-textGray hover:text-accentRed transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* EVENTS SELECTION CARD */}
                  <div className="glass-card p-6 rounded-xl border-borderColor/20 space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div className="flex items-center space-x-3">
                        <Shield className="w-5 h-5 text-accentRed" />
                        <h3 className="font-gaming font-bold text-white uppercase text-md">Events to Log</h3>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <label className="text-[10px] text-textGray font-semibold uppercase">Enable All</label>
                        <input
                          type="checkbox"
                          onChange={(e) => handleToggleAllEvents(e.target.checked)}
                          checked={
                            [
                              'messageDelete', 'messageEdit', 'messageDeleteBulk',
                              'trackInvites', 'messagePin', 'messageUnpin',
                              'memberJoin', 'memberLeave', 'roleGiven', 'roleRemoved'
                            ].every(k => settings.serverLogs?.events?.[k])
                          }
                          className="w-4 h-4 accent-accentRed rounded border-borderColor bg-white/5 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Message Events Group */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-textGray uppercase tracking-wider pb-1 border-b border-white/5">Message Events</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: 'messageDelete', label: 'Message Deleted' },
                          { key: 'messageEdit', label: 'Message Edited' },
                          { key: 'messageDeleteBulk', label: 'Bulk Messages Delete' },
                          { key: 'trackInvites', label: 'Track Posted Invites' },
                          { key: 'messagePin', label: 'Message Pinned' },
                          { key: 'messageUnpin', label: 'Message Unpinned' },
                        ].map(evt => (
                          <div key={evt.key} className="flex flex-col bg-white/5 p-3 rounded-lg border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white">{evt.label}</span>
                              <input
                                type="checkbox"
                                checked={!!settings.serverLogs?.events?.[evt.key]}
                                onChange={() => handleEventToggle(evt.key)}
                                className="w-4 h-4 accent-accentRed rounded border-borderColor cursor-pointer"
                              />
                            </div>
                            {settings.serverLogs?.splitEvents && settings.serverLogs?.events?.[evt.key] && (
                              <select
                                value={settings.serverLogs?.eventChannels?.[evt.key] || ''}
                                onChange={(e) => handleEventChannelChange(evt.key, e.target.value)}
                                className="w-full bg-white/5 border border-borderColor text-white rounded-lg text-[10px] p-1.5 focus:outline-none"
                              >
                                <option value="">Use Default Channel</option>
                                {channels.filter(c => c.type === 0).map(c => (
                                  <option key={c.id} value={c.id}># {c.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Member Events Group */}
                    <div className="space-y-4 pt-4">
                      <h4 className="text-xs font-bold text-textGray uppercase tracking-wider pb-1 border-b border-white/5">Member Events</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: 'memberJoin', label: 'Member Joined' },
                          { key: 'memberLeave', label: 'Member Left' },
                          { key: 'roleGiven', label: 'Role Given' },
                          { key: 'roleRemoved', label: 'Role Removed' },
                        ].map(evt => (
                          <div key={evt.key} className="flex flex-col bg-white/5 p-3 rounded-lg border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white">{evt.label}</span>
                              <input
                                type="checkbox"
                                checked={!!settings.serverLogs?.events?.[evt.key]}
                                onChange={() => handleEventToggle(evt.key)}
                                className="w-4 h-4 accent-accentRed rounded border-borderColor cursor-pointer"
                              />
                            </div>
                            {settings.serverLogs?.splitEvents && settings.serverLogs?.events?.[evt.key] && (
                              <select
                                value={settings.serverLogs?.eventChannels?.[evt.key] || ''}
                                onChange={(e) => handleEventChannelChange(evt.key, e.target.value)}
                                className="w-full bg-white/5 border border-borderColor text-white rounded-lg text-[10px] p-1.5 focus:outline-none"
                              >
                                <option value="">Use Default Channel</option>
                                {channels.filter(c => c.type === 0).map(c => (
                                  <option key={c.id} value={c.id}># {c.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
