import React, { useEffect, useRef, useState } from 'react';
import { useAuth, BOT_INVITE_URL } from '../context/AuthContext';
import { Shield, LogOut, ArrowLeft, Plus, Wifi, Clock, ChevronDown, Sun, Moon, Menu, Search, Bell } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { 
    user, selectedGuild, logout, guilds, setSelectedGuildId, backendUrl,
    theme, toggleTheme, sidebarOpen, setSidebarOpen 
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [botPing, setBotPing] = useState(null);
  const [botOnline, setBotOnline] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Mock Notifications for Premium Feel
  const notifications = [
    { id: 1, title: 'Bot Update', desc: 'RAGE bot migrated to Discord API v10.', time: '2h ago' },
    { id: 2, title: 'Backup Successful', desc: 'Auto-backup captured for active guild.', time: '1d ago' },
    { id: 3, title: 'Security Alert', desc: 'Anti-Nuke safeguard threshold updated.', time: '3d ago' }
  ];

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
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

  const isConfigPage = ['/dashboard/', '/welcome/', '/moderation/', '/tickets/', '/security/', '/notifications/', '/cloner/']
    .some(p => location.pathname.includes(p));

  const pingColor = botPing === null ? 'text-textGray' : botPing < 80 ? 'text-emerald-400' : botPing < 150 ? 'text-yellow-400' : 'text-red-400';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/5 dark:bg-[#06060a]/75 backdrop-blur-xl border-b border-borderColor z-50 flex items-center justify-between px-4 sm:px-6 transition-colors duration-300">
      {/* Left: Hamburger + Logo + Guild Switcher */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {isConfigPage && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-textGray hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5 text-textGray hover:text-white" />
          </button>
        )}

        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden border border-white/10 shadow-neonGlow transition-transform group-hover:scale-105">
            <img src="/logo.jpeg" alt="Rage Optimizer Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-gaming font-black text-sm sm:text-base tracking-wider text-white hidden xs:block">
            RAGE <span className="text-accentRed">OPTIMIZER</span>
          </span>
        </Link>

        {isConfigPage && (
          <div className="flex items-center space-x-2 pl-3 border-l border-borderColor">
            <button
              onClick={() => navigate('/servers')}
              className="text-textGray hover:text-white flex items-center space-x-1 text-xs bg-white/5 hover:bg-white/8 px-2.5 py-1.5 rounded-lg transition-all border border-borderColor hover:border-accentRed/35"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Servers</span>
            </button>

            <select
              value={selectedGuild ? selectedGuild.id : ''}
              onChange={handleGuildChange}
              className="bg-cardBgSolid border border-borderColor text-white rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-accentRed cursor-pointer max-w-[130px] sm:max-w-none"
            >
              <option value="all">Switch server...</option>
              {guilds.filter(g => {
                const permInt = parseInt(g.permissions || '0');
                const isAdmin = g.owner || (permInt & 0x8) === 0x8;
                return g.botJoined && isAdmin;
              }).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Center Search (Premium UI element) */}
      <div className="hidden md:flex items-center relative max-w-xs w-full mx-4">
        <Search className="w-4 h-4 text-textGray absolute left-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 dark:bg-[#0c0c14]/40 border border-borderColor rounded-xl text-xs pl-9 pr-4 py-2 text-white focus:outline-none focus:border-accentRed/50 placeholder-textGray/55"
        />
      </div>

      {/* Right: Status + Theme Switcher + Notifications + Add Bot + User */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Live Bot Status Badge */}
        <div className={`hidden sm:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
          botOnline
            ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20'
            : 'bg-white/5 text-textGray border-white/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${botOnline ? 'bg-emerald-400 animate-ping' : 'bg-textGray'}`} />
          <Wifi className={`w-3 h-3 ${pingColor}`} />
          <span className="font-gaming font-bold text-[10px] tracking-wider">
            {botOnline ? `ONLINE` : 'OFFLINE'}
            {botPing !== null && <span className={`ml-1 ${pingColor}`}>• {botPing}ms</span>}
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 bg-white/5 hover:bg-white/10 text-textGray hover:text-white border border-borderColor rounded-xl transition-all"
          title={theme === 'dark' ? 'Switch to Light Blue' : 'Switch to Dark'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
        </button>

        {/* Notifications Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 bg-white/5 hover:bg-white/10 text-textGray hover:text-white border border-borderColor rounded-xl transition-all relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accentRed rounded-full animate-pulse" />
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-72 bg-cardBgSolid border border-borderColor rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-borderColor flex items-center justify-between">
                  <span className="font-gaming font-black text-xs text-white uppercase tracking-wider">Notifications</span>
                  <span className="text-[10px] text-accentRed font-bold hover:underline cursor-pointer">Clear all</span>
                </div>
                <div className="divide-y divide-borderColor/60 max-h-64 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="p-3.5 hover:bg-white/4 transition-colors">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-xs font-bold text-white">{n.title}</span>
                        <span className="text-[9px] text-textGray">{n.time}</span>
                      </div>
                      <p className="text-[10px] text-textGray leading-relaxed">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Add Bot Link */}
        <a
          href={BOT_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center space-x-1.5 text-xs bg-accentRed/10 hover:bg-accentRed/20 text-accentRed border border-accentRed/20 hover:border-accentRed/40 px-3 py-1.5 rounded-xl font-bold transition-all shadow-neonGlow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Bot</span>
        </a>

        {/* User Menu */}
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center space-x-2 bg-white/5 hover:bg-white/8 border border-borderColor rounded-xl px-2.5 py-1.5 transition-all"
            >
              <img
                src={user.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                  : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                className="w-6 h-6 rounded-full border border-accentRed/30"
                alt="avatar"
                onError={(e) => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
              />
              <span className="hidden md:inline text-xs font-bold text-white">{user.username}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-textGray transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-56 bg-cardBgSolid border border-borderColor rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-borderColor">
                    <div className="flex items-center space-x-3">
                      <img
                        src={user.avatar
                          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                          : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                        className="w-10 h-10 rounded-full border border-accentRed/30"
                        alt="avatar"
                        onError={(e) => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{user.username}</div>
                        <div className="text-[10px] text-textGray truncate">Discord Account</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { navigate('/servers'); setShowUserMenu(false); }}
                      className="w-full text-left text-xs text-textGray hover:text-white hover:bg-white/5 px-3 py-2.5 rounded-xl transition-all"
                    >
                      My Servers
                    </button>
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 px-3 py-2.5 rounded-xl transition-all flex items-center space-x-2 border-t border-borderColor/40 mt-1"
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
            className="bg-accentRed hover:bg-accentRedHover text-white px-4 py-2 rounded-xl font-gaming font-semibold text-xs tracking-wider transition-all shadow-neonGlow hover:shadow-neonHover"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}
