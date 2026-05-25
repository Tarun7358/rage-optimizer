import React, { useState, useEffect } from 'react';
import { useAuth, BOT_INVITE_URL } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Server, Plus, ArrowRight, ExternalLink, Search, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Servers() {
  const { user, guilds, setSelectedGuildId, loading, refreshGuilds } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshGuilds();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh guilds on mount
  useEffect(() => {
    if (user) {
      refreshGuilds().catch(console.error);
    }
  }, []);

  // Refresh guilds when tab/window is focused (e.g. after adding bot in new tab)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        refreshGuilds().catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, refreshGuilds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-white/5 rounded-full" />
            <div className="w-16 h-16 border-t-2 border-accentRed rounded-full animate-spin absolute inset-0" />
          </div>
          <span className="text-textGray text-sm font-semibold tracking-wider">Syncing Guilds...</span>
        </div>
      </div>
    );
  }

  // Admin guilds: owner or has Administrator (0x8) permission
  const adminGuilds = guilds.filter(g => {
    const permInt = parseInt(g.permissions);
    return g.owner || (permInt & 0x8) === 0x8;
  });

  const joinedGuilds = adminGuilds.filter(g => g.botJoined);
  const notJoinedGuilds = adminGuilds.filter(g => !g.botJoined);

  const handleGuildSelect = (guildId, isJoined) => {
    if (isJoined) {
      setSelectedGuildId(guildId);
      navigate(`/dashboard/${guildId}`);
    } else {
      const inviteUrl = `${BOT_INVITE_URL}&guild_id=${guildId}&disable_guild_select=true`;
      window.open(inviteUrl, '_blank');
    }
  };

  const GuildCard = ({ guild, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -3 }}
      className={`glass-card p-5 rounded-2xl flex flex-col justify-between border transition-all ${
        guild.botJoined
          ? 'hover:border-accentRed/30 hover:shadow-neonGlow'
          : 'hover:border-white/20'
      }`}
    >
      <div className="flex items-center space-x-4 mb-5">
        {guild.icon ? (
          <img
            src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
            className="w-14 h-14 rounded-xl border border-white/8 shadow-lg"
            alt={guild.name}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-accentRed/10 border border-accentRed/20 flex items-center justify-center text-accentRed font-gaming font-black text-xl shadow-inner">
            {guild.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="font-gaming font-bold text-white text-base truncate mb-1" title={guild.name}>
            {guild.name}
          </h4>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {guild.owner ? (
              <span className="text-[8px] font-gaming font-black tracking-wider bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/15">OWNER</span>
            ) : (
              <span className="text-[8px] font-gaming font-black tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/15">ADMIN</span>
            )}
            {guild.botJoined ? (
              <span className="text-[8px] font-gaming font-black tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/15">ACTIVE</span>
            ) : (
              <span className="text-[8px] font-gaming font-black tracking-wider bg-zinc-500/10 text-zinc-400 px-2 py-0.5 rounded border border-zinc-500/15">NOT IN</span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => handleGuildSelect(guild.id, guild.botJoined)}
        className={`w-full text-xs px-4 py-2.5 rounded-xl font-gaming font-black tracking-wider flex items-center justify-center space-x-2 transition-all ${
          guild.botJoined
            ? 'bg-accentRed hover:bg-accentRedHover text-white shadow-neonGlow hover:shadow-neonHover'
            : 'bg-white/6 border border-white/12 hover:bg-white/10 hover:border-white/20 text-white'
        }`}
      >
        {guild.botJoined ? (
          <><span>CONFIGURE</span><ArrowRight className="w-3.5 h-3.5" /></>
        ) : (
          <><span>ADD BOT</span><Plus className="w-3.5 h-3.5" /></>
        )}
      </button>
    </motion.div>
  );

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#08080c] px-6 relative overflow-hidden">
      {/* Background blob */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-accentRed/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-xs text-accentRed font-bold uppercase tracking-widest mb-3"
          >
            Server Selection
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl font-gaming font-black text-white uppercase tracking-wider"
          >
            Select a Server
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-textGray text-sm mt-2"
          >
            You can only configure servers where you hold Administrator or Owner privileges.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex justify-center"
          >
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl border text-xs font-gaming font-bold tracking-wider transition-all duration-300 ${
                refreshing
                  ? 'bg-white/5 border-white/10 text-textGray cursor-not-allowed'
                  : 'bg-accentRed/10 border-accentRed/30 hover:border-accentRed text-white hover:bg-accentRed/25 hover:shadow-neonGlow'
              }`}
            >
              <RefreshCw className={`w-4 h-4 text-accentRed ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'SYNCING SERVERS...' : 'SYNC SERVERS'}</span>
            </button>
          </motion.div>
        </div>

        {adminGuilds.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-12 rounded-2xl text-center max-w-md mx-auto"
          >
            <ShieldAlert className="w-14 h-14 text-accentRed mx-auto mb-4 opacity-70" />
            <h4 className="text-lg font-gaming font-bold text-white mb-3">No Manageable Servers</h4>
            <p className="text-textGray text-xs leading-relaxed mb-6">
              You do not have Administrator or Owner privileges on any server. Make sure you're logged in with the correct account.
            </p>
            <a
              href={BOT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accentRed hover:bg-accentRedHover text-white px-6 py-3 rounded-xl font-gaming font-black text-xs tracking-wider inline-flex items-center space-x-2 transition-all shadow-neonGlow"
            >
              <Plus className="w-4 h-4" />
              <span>ADD BOT TO A SERVER</span>
            </a>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {/* Guilds with bot */}
            {joinedGuilds.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest">
                    🟢 Bot Active — {joinedGuilds.length} Server{joinedGuilds.length !== 1 ? 's' : ''}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {joinedGuilds.map((guild, i) => (
                    <GuildCard key={guild.id} guild={guild} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Guilds without bot */}
            {notJoinedGuilds.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">
                    ⚫ Bot Not Added — {notJoinedGuilds.length} Server{notJoinedGuilds.length !== 1 ? 's' : ''}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {notJoinedGuilds.map((guild, i) => (
                    <GuildCard key={guild.id} guild={guild} index={joinedGuilds.length + i} />
                  ))}
                </div>
              </div>
            )}

            {/* General Add Bot CTA */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card border-dashed border-white/10 rounded-2xl p-8 text-center"
            >
              <Server className="w-8 h-8 text-textGray/30 mx-auto mb-3" />
              <p className="text-textGray text-sm mb-4">Don't see a server? Add the bot to get started.</p>
              <a
                href={BOT_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/6 hover:bg-white/10 border border-white/12 hover:border-accentRed/30 text-white px-6 py-2.5 rounded-xl font-gaming font-bold text-xs tracking-wider inline-flex items-center space-x-2 transition-all"
              >
                <Plus className="w-4 h-4 text-accentRed" />
                <span>ADD RAGE OPTIMIZER TO SERVER</span>
                <ExternalLink className="w-3.5 h-3.5 text-textGray" />
              </a>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
