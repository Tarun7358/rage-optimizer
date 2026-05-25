import React from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UserPlus, Shield, Ticket, Lock, Bell, Settings,
  ChevronRight, ExternalLink, RefreshCw, Server, Database, BarChart3, HelpCircle, UserCheck
} from 'lucide-react';
import { useAuth, BOT_INVITE_URL } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
  const { guildId } = useParams();
  const { user, guilds, sidebarOpen, setSidebarOpen } = useAuth();
  const navigate = useNavigate();

  const currentGuild = guilds.find(g => g.id === guildId);

  // Group sections as requested
  const menuSections = [
    {
      title: 'Core Panel',
      items: [
        { name: 'Dashboard', path: `/dashboard/${guildId}`, icon: LayoutDashboard },
        { name: 'Servers List', path: '/servers', icon: Server },
      ]
    },
    {
      title: 'Automation',
      items: [
        { name: 'Welcome & DM', path: `/welcome/${guildId}`, icon: UserPlus },
        { name: 'Moderation', path: `/moderation/${guildId}`, icon: Shield },
        { name: 'Ticket System', path: `/tickets/${guildId}`, icon: Ticket },
        { name: 'Logs & Alerts', path: `/notifications/${guildId}`, icon: Bell },
      ]
    },
    {
      title: 'Advanced Settings',
      items: [
        { name: 'Server Cloner', path: `/cloner/${guildId}`, icon: RefreshCw },
        { name: 'Backup Manager', path: `/security/${guildId}`, icon: Database },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-[#030307]/70 backdrop-blur-xs z-30 lg:hidden top-16"
          />
        )}
      </AnimatePresence>

      <aside className={`w-64 bg-[#06060a]/95 dark:bg-[#07070d]/90 border-r border-borderColor h-[calc(100vh-4rem)] fixed left-0 top-16 z-40 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex-1 flex flex-col min-h-0">
          {/* Guild Info Header */}
          {currentGuild && (
            <div className="p-4 border-b border-borderColor">
              <div className="flex items-center space-x-3 p-2.5 bg-white/4 rounded-2xl border border-borderColor/40 shadow-inner">
                {currentGuild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`}
                    className="w-10 h-10 rounded-xl border border-borderColor shadow-md"
                    alt={currentGuild.name}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-accentRed/10 border border-accentRed/20 flex items-center justify-center text-accentRed font-gaming font-black text-base shadow-neonGlow">
                    {currentGuild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate uppercase tracking-wider">{currentGuild.name}</div>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav Links */}
          <nav className="flex-1 p-3 overflow-y-auto space-y-4">
            {menuSections.map((section, sidx) => (
              <div key={sidx} className="space-y-1">
                <div className="px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-textGray/45 mb-1.5">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((link) => {
                    const Icon = link.icon;
                    const isOverview = link.path === `/dashboard/${guildId}`;
                    return (
                      <NavLink
                        key={link.path}
                        to={link.path}
                        onClick={() => setSidebarOpen(false)}
                        end={isOverview}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group border ${
                            isActive
                              ? 'bg-accentRed/10 text-white border-accentRed/30 shadow-neonGlow'
                              : 'text-textGray hover:text-white hover:bg-white/4 border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className="flex items-center space-x-3">
                              <Icon className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                                isActive ? 'text-accentRed' : 'text-textGray/60 group-hover:text-textGray'
                              }`} />
                              <span>{link.name}</span>
                            </div>
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active-indicator"
                                className="w-1 h-3 rounded-full bg-accentRed"
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Admin Section */}
            {user?.isAdmin && (
              <div className="space-y-1 pt-1">
                <div className="px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-textGray/45 mb-1.5">
                  Management
                </div>
                <NavLink
                  to="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group border ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-neonGlowGreen'
                        : 'text-textGray hover:text-white hover:bg-white/4 border-transparent'
                    }`
                  }
                >
                  <Settings className="w-4 h-4" />
                  <span>Admin Console</span>
                </NavLink>
              </div>
            )}
          </nav>
        </div>

        {/* Bottom User Card / CTA */}
        <div className="p-3 border-t border-borderColor space-y-2 bg-white/2 dark:bg-[#08080e]/40">
          <a
            href={BOT_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-accentRed/8 hover:bg-accentRed/15 border border-accentRed/15 hover:border-accentRed/30 text-accentRed rounded-xl px-3 py-2.5 text-[10px] font-bold tracking-wider transition-all"
          >
            <span>Invite to Server</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {user && (
            <div className="flex items-center space-x-3 p-2 bg-white/3 rounded-xl border border-borderColor/30">
              <img
                src={user.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                  : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                className="w-8 h-8 rounded-full border border-borderColor"
                alt="user avatar"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-white truncate">{user.username}</div>
                <span className="text-[8px] text-accentRed font-semibold tracking-widest uppercase">VIP MEMBER</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
