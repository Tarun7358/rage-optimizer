import React from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UserPlus, Shield, Ticket, Lock, Bell, Settings,
  ChevronRight, ExternalLink
} from 'lucide-react';
import { useAuth, BOT_INVITE_URL } from '../context/AuthContext';

export default function Sidebar() {
  const { guildId } = useParams();
  const { user, guilds } = useAuth();
  const navigate = useNavigate();

  const currentGuild = guilds.find(g => g.id === guildId);

  const links = [
    { name: 'Overview', path: `/dashboard/${guildId}`, icon: LayoutDashboard },
    { name: 'Welcome & DM', path: `/welcome/${guildId}`, icon: UserPlus },
    { name: 'Auto Moderation', path: `/moderation/${guildId}`, icon: Shield },
    { name: 'Ticket System', path: `/tickets/${guildId}`, icon: Ticket },
    { name: 'Security & Anti-Nuke', path: `/security/${guildId}`, icon: Lock },
    { name: 'Media Notifications', path: `/notifications/${guildId}`, icon: Bell },
  ];

  return (
    <aside className="w-64 bg-[#0a0a12]/95 border-r border-white/6 h-[calc(100vh-4rem)] fixed left-0 top-16 z-40 flex flex-col">
      {/* Guild Info Header */}
      {currentGuild && (
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center space-x-3 p-3 bg-white/4 rounded-xl">
            {currentGuild.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`}
                className="w-10 h-10 rounded-lg border border-white/5"
                alt={currentGuild.name}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-accentRed/15 border border-accentRed/20 flex items-center justify-center text-accentRed font-gaming font-black text-base">
                {currentGuild.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">{currentGuild.name}</div>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] text-emerald-400 font-semibold">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav Links */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="px-3 mb-3 mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-textGray/50">
          Configuration
        </div>
        <div className="space-y-0.5">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === `/dashboard/${guildId}`}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
                    isActive
                      ? 'bg-accentRed/12 text-white border border-accentRed/20'
                      : 'text-textGray hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-accentRed' : 'text-textGray/70 group-hover:text-textGray'}`} />
                      <span className="font-medium">{link.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-accentRed/70" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Admin section */}
        {user?.isAdmin && (
          <>
            <div className="px-3 mb-3 mt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-textGray/50">
              Admin
            </div>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-all group border ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'text-textGray hover:text-white hover:bg-white/5 border-transparent'
                }`
              }
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium">Admin Panel</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom: Add Bot CTA */}
      <div className="p-3 border-t border-white/5">
        <a
          href={BOT_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full bg-accentRed/8 hover:bg-accentRed/15 border border-accentRed/15 hover:border-accentRed/30 text-accentRed rounded-xl px-4 py-3 text-xs font-bold tracking-wider transition-all"
        >
          <span>Add to Another Server</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </aside>
  );
}
