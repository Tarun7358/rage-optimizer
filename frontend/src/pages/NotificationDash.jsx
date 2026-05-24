import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Save, Bell, Plus, Trash2, Video, Radio, Camera } from 'lucide-react';
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
  
  // Forms inputs
  const [ytUrl, setYtUrl] = useState('');
  const [ytChan, setYtChan] = useState('');
  
  const [twitchName, setTwitchName] = useState('');
  const [twitchChan, setTwitchChan] = useState('');

  const [instaName, setInstaName] = useState('');
  const [instaChan, setInstaChan] = useState('');

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
              <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">Media Alerts</h2>
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
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2 focus:outline-none focus:border-accentRed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Discord Target Channel</label>
                    <select
                      value={ytChan}
                      onChange={(e) => setYtChan(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2 focus:outline-none focus:border-accentRed"
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
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2 focus:outline-none focus:border-accentRed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Discord Target Channel</label>
                    <select
                      value={twitchChan}
                      onChange={(e) => setTwitchChan(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2 focus:outline-none focus:border-accentRed"
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
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2 focus:outline-none focus:border-accentRed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-textGray uppercase mb-1">Discord Target Channel</label>
                    <select
                      value={instaChan}
                      onChange={(e) => setInstaChan(e.target.value)}
                      className="w-full bg-[#08080c] border border-white/10 text-white rounded-lg text-xs p-2 focus:outline-none focus:border-accentRed"
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
        </div>
      </main>
    </div>
  );
}
