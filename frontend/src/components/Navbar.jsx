import React, { useEffect, useRef, useState } from 'react';
import { useAuth, BOT_INVITE_URL } from '../context/AuthContext';
import { Shield, LogOut, ArrowLeft, Plus, Wifi, Clock, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, selectedGuild, logout, guilds, setSelectedGuildId, backendUrl } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [botPing, setBotPing] = useState(null);
  const [botOnline, setBotOnline] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Live ping from SSE stream
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${backendUrl}/api/stats/live`);
      eventSourceRef.current = es;
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setBotPing(data.ping);
          setBotOnline(data.isLive);
        } catch {}
      };
      es.onerror = () => {
        es.close();
        setBotOnline(false);
        setTimeout(connect, 8000);
      };
    };
    connect();
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, [backendUrl]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleGuildChange = (e) => {
    const val = e.target.value;
    if (val === 'all') {
      setSelectedGuildId(null);
      navigate('/servers');
    } else {
      setSelectedGuildId(val);
      navigate(`/dashboard/${val}`);
    }
  };

  const isConfigPage = ['/dashboard/', '/welcome/', '/moderation/', '/tickets/', '/security/', '/notifications/']
    .some(p => location.pathname.includes(p));

  const pingColor = botPing === null ? 'text-textGray' : botPing < 80 ? 'text-emerald-400' : botPing < 150 ? 'text-yellow-400' : 'text-red-400';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#08080c]/85 backdrop-blur-xl border-b border-white/6 z-50 flex items-center justify-between px-5">
      {/* Left: Logo + Guild Switcher */}
      <div className="flex items-center space-x-4">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/10 shadow-neonGlow transition-transform group-hover:scale-105">
            <img src="/logo.jpeg" alt="Rage Optimizer Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-gaming font-black text-lg tracking-wider text-white hidden sm:block">
            RAGE <span className="text-accentRed">OPTIMIZER</span>
          </span>
        </Link>

        {isConfigPage && (
          <div className="flex items-center space-x-2 pl-3 border-l border-white/8">
            <button
              onClick={() => navigate('/servers')}
              className="text-textGray hover:text-white flex items-center space-x-1 text-xs bg-white/5 hover:bg-white/8 px-2.5 py-1.5 rounded-lg transition-all border border-white/8 hover:border-white/15"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Servers</span>
            </button>

            <select
              value={selectedGuild ? selectedGuild.id : ''}
              onChange={handleGuildChange}
              className="bg-[#14141c] border border-white/10 text-white rounded-lg text-xs px-3 py-1.5 focus:outline-none focus:border-accentRed/60 cursor-pointer"
            >
              <option value="all">Switch server...</option>
              {guilds.filter(g => g.botJoined).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Status + Add Bot + User */}
      <div className="flex items-center space-x-3">
        {/* Live Bot Status Badge */}
        <div className={`hidden md:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
          botOnline
            ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20'
            : 'bg-white/5 text-textGray border-white/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${botOnline ? 'bg-emerald-400 animate-ping' : 'bg-textGray'}`} />
          <Wifi className={`w-3 h-3 ${pingColor}`} />
          <span>
            {botOnline ? `ONLINE` : 'OFFLINE'}
            {botPing !== null && <span className={`ml-1 ${pingColor}`}>• {botPing}ms</span>}
          </span>
        </div>

        {/* Add Bot Link */}
        <a
          href={BOT_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center space-x-1.5 text-xs bg-accentRed/10 hover:bg-accentRed/20 text-accentRed border border-accentRed/20 hover:border-accentRed/40 px-3 py-1.5 rounded-lg font-semibold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Bot</span>
        </a>

        {/* User Menu */}
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center space-x-2 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl px-3 py-1.5 transition-all"
            >
              <img
                src={user.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                  : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                className="w-6 h-6 rounded-full border border-accentRed/30"
                alt="avatar"
                onError={(e) => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
              />
              <span className="hidden sm:inline text-xs font-semibold text-white">{user.username}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-textGray transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-white/5">
                    <div className="flex items-center space-x-3">
                      <img
                        src={user.avatar
                          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                          : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                        className="w-9 h-9 rounded-full border border-accentRed/30"
                        alt="avatar"
                        onError={(e) => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-white">{user.username}</div>
                        <div className="text-[10px] text-textGray">Discord Account</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { navigate('/servers'); setShowUserMenu(false); }}
                      className="w-full text-left text-xs text-textGray hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-all"
                    >
                      My Servers
                    </button>
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 px-3 py-2 rounded-lg transition-all flex items-center space-x-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="bg-accentRed hover:bg-accentRedHover text-white px-4 py-1.5 rounded-lg font-gaming font-semibold text-sm transition-all shadow-neonGlow hover:shadow-neonHover"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}
