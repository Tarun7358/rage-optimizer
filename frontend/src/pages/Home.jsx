import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Ticket, Lock, Terminal, Activity, ArrowRight, Play, Bot, Users, Server, Clock, Wifi, Plus, ChevronRight, Star, CheckCircle } from 'lucide-react';
import { useAuth, BOT_INVITE_URL } from '../context/AuthContext';

export default function Home() {
  const { user, login, mockLogin, backendUrl } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    servers: 0, members: 0, activeTickets: 0, ticketsOpened: 0,
    warningsIssued: 0, uptimeSeconds: 0, ping: 0, status: 'Connecting...', botTag: '...', isLive: false
  });
  const [activeTab, setActiveTab] = useState('moderation');
  const [statsLoaded, setStatsLoaded] = useState(false);
  const eventSourceRef = useRef(null);

  // Live stats via SSE stream
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${backendUrl}/api/stats/live`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStats(data);
          setStatsLoaded(true);
        } catch {}
      };

      es.onerror = () => {
        es.close();
        // Retry after 5s if connection drops
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [backendUrl]);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const features = [
    {
      icon: Shield,
      title: 'Auto Moderation',
      desc: 'Eliminate toxic posts, spam, scam domains, and illegal links instantly with automated filters.',
      badge: 'AI Powered'
    },
    {
      icon: Ticket,
      title: 'Ticket Support',
      desc: 'Deploy category-based tickets (sensi, optimization, shop, support) with claim timers & auto-transcripts.',
      badge: 'Multi-Category'
    },
    {
      icon: Lock,
      title: 'Anti-Nuke Security',
      desc: 'Secure channels, roles, and webhooks against rogue staff. Prevent server raid and wipe attempts.',
      badge: 'Real-time'
    },
  ];

  const commands = {
    moderation: [
      { name: '/warn', desc: 'Log an infraction and DM warning reasons directly to a server member.', color: 'text-orange-400' },
      { name: '/timeout', desc: 'Temporarily mute users for specific periods (1m – 28d) to defuse arguments.', color: 'text-yellow-400' },
      { name: '/purge', desc: 'Clear up to 100 messages in any text channel with advanced filters.', color: 'text-red-400' }
    ],
    tickets: [
      { name: '/ticketpanel', desc: 'Post the multi-category interactive button selection card in any channel.', color: 'text-blue-400' },
      { name: '/claim', desc: 'Assign yourself as the active handler for the current support ticket.', color: 'text-green-400' },
      { name: '/close', desc: 'Close ticket, archive chat records, compile transcripts, and delete the channel.', color: 'text-purple-400' }
    ],
    security: [
      { name: '/backup', desc: 'Capture full configuration snapshots of server permissions, roles, and channels.', color: 'text-cyan-400' },
      { name: '/restore', desc: 'Instantly restore channels and roles structure after a rogue administrator abuse.', color: 'text-emerald-400' }
    ]
  };

  const handleCTA = () => {
    if (user) navigate('/servers');
    else login();
  };

  const statCards = [
    { icon: Server, label: 'Active Guilds', value: statsLoaded ? stats.servers.toLocaleString() + '+' : '—', color: 'text-accentRed' },
    { icon: Users, label: 'Users Guarded', value: statsLoaded ? stats.members.toLocaleString() + '+' : '—', color: 'text-blue-400' },
    { icon: Ticket, label: 'Support Tickets', value: statsLoaded ? stats.ticketsOpened.toLocaleString() : '—', color: 'text-purple-400' },
    { icon: Wifi, label: 'Bot Latency', value: statsLoaded ? `${stats.ping}ms` : '—', color: stats.ping < 100 ? 'text-emerald-400' : 'text-yellow-400' },
  ];

  return (
    <div className="min-h-screen pt-16 bg-[#08080c] relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accentRed/8 rounded-full blur-[160px] animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-accentRed/5 rounded-full blur-[140px] animate-pulse-glow pointer-events-none" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-blue-500/3 rounded-full blur-[120px] pointer-events-none" />

      {/* ── HERO ── */}
      <section className="container mx-auto px-6 pt-20 pb-12 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center space-x-2 bg-accentRed/10 border border-accentRed/25 text-accentRed px-4 py-2 rounded-full mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-accentRed animate-ping" />
          <Bot className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {stats.isLive ? `${stats.botTag} • ONLINE` : 'PREMIUM DISCORD UTILITY BOT'}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-7xl md:text-8xl font-gaming font-black tracking-tight leading-none mb-6"
        >
          DOMINATE YOUR<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accentRed via-white to-accentRed neon-text-glow">
            DISCORD SERVER
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-textGray max-w-2xl mx-auto text-base sm:text-lg mb-10 leading-relaxed"
        >
          The ultimate gaming and esports moderation, ticket, and anti-nuke bot. Empower your gaming community with a premium interactive web dashboard.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-center items-center gap-4"
        >
          <button
            onClick={handleCTA}
            className="w-full sm:w-auto bg-accentRed hover:bg-accentRedHover text-white px-8 py-4 rounded-xl font-gaming font-black tracking-wider flex items-center justify-center space-x-3 transition-all shadow-neonGlow hover:shadow-neonHover hover:scale-[1.02]"
          >
            <span>ACCESS DASHBOARD</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <a
            href={BOT_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-white/8 hover:bg-white/12 text-white border border-white/15 px-8 py-4 rounded-xl font-gaming font-black tracking-wider flex items-center justify-center space-x-3 transition-all hover:border-accentRed/40"
          >
            <Plus className="w-5 h-5 text-accentRed" />
            <span>ADD TO SERVER</span>
          </a>

          <button
            onClick={async () => {
              const success = await mockLogin();
              if (success) navigate('/servers');
            }}
            className="w-full sm:w-auto bg-white/5 hover:bg-white/8 text-textGray hover:text-white border border-white/8 px-6 py-4 rounded-xl font-gaming font-bold tracking-wider flex items-center justify-center space-x-2 transition-all text-sm"
          >
            <Play className="w-4 h-4" />
            <span>DEV DEMO</span>
          </button>
        </motion.div>
      </section>

      {/* ── LIVE STATS STRIP ── */}
      <section className="container mx-auto px-6 pb-16 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="glass-card p-5 rounded-2xl text-center group hover:border-accentRed/25 transition-all"
              >
                <Icon className={`w-5 h-5 ${card.color} mx-auto mb-2 opacity-70`} />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={card.value}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className={`block text-2xl font-gaming font-black tracking-wider mb-1 ${card.color}`}
                  >
                    {card.value}
                  </motion.span>
                </AnimatePresence>
                <span className="text-textGray text-[10px] font-semibold uppercase tracking-widest">{card.label}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Uptime bar */}
        {statsLoaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center mt-4"
          >
            <div className="inline-flex items-center space-x-3 bg-emerald-500/8 border border-emerald-500/20 rounded-full px-4 py-2 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <Clock className="w-3.5 h-3.5" />
              <span>Uptime: <strong>{formatUptime(stats.uptimeSeconds)}</strong></span>
              <span className="text-emerald-500/50">•</span>
              <span>Ping: <strong>{stats.ping}ms</strong></span>
            </div>
          </motion.div>
        )}
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="container mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-xs text-accentRed font-bold uppercase tracking-widest">Why Choose Us</span>
          <h2 className="text-3xl sm:text-5xl font-gaming font-black text-white tracking-tight mt-3">
            REVOLUTIONARY SYSTEMS
          </h2>
          <p className="text-textGray text-sm max-w-md mx-auto mt-3">
            Engineered specifically to support esports communities, shop tickets, and security audits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card glass-card-hover p-8 rounded-2xl relative overflow-hidden group"
              >
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-bold bg-accentRed/15 text-accentRed border border-accentRed/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {feat.badge}
                  </span>
                </div>
                <div className="w-14 h-14 bg-accentRed/10 border border-accentRed/20 text-accentRed rounded-xl flex items-center justify-center mb-6 group-hover:shadow-neonGlow transition-all">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-gaming font-bold text-white mb-3">{feat.title}</h3>
                <p className="text-textGray text-sm leading-relaxed">{feat.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── COMMANDS PREVIEW ── */}
      <section className="container mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs text-accentRed font-bold uppercase tracking-widest">Slash Commands</span>
            <h2 className="text-3xl sm:text-4xl font-gaming font-black text-white tracking-tight mt-3 mb-5">
              COMPLETE SLASH<br />COMMAND SUITE
            </h2>
            <p className="text-textGray text-sm mb-8 leading-relaxed">
              We leverage Discord v14 slash interface to compile robust interactive embeds, multiple-choice polls, and automated warning logs.
            </p>

            <div className="flex space-x-2 mb-3">
              {['moderation', 'tickets', 'security'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-gaming font-black uppercase tracking-wider rounded-lg border transition-all ${
                    activeTab === tab
                      ? 'bg-accentRed border-accentRed text-white shadow-neonGlow'
                      : 'bg-white/5 border-white/10 text-textGray hover:text-white hover:border-white/20'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#0c0c14] border border-white/8 p-6 rounded-2xl space-y-3 shadow-2xl"
          >
            <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="text-[10px] text-textGray/50 ml-2 font-mono">rage-optimizer / {activeTab}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {commands[activeTab].map((cmd, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/4 border border-white/5 flex items-start space-x-4 hover:border-accentRed/20 transition-all">
                    <Terminal className={`w-4 h-4 ${cmd.color} mt-0.5 shrink-0`} />
                    <div>
                      <div className="text-sm font-bold font-mono text-white mb-1">{cmd.name}</div>
                      <div className="text-xs text-textGray leading-relaxed">{cmd.desc}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="container mx-auto px-6 py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden glass-card rounded-3xl p-12 text-center border-accentRed/15"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accentRed/8 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-accentRed/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-5xl font-gaming font-black text-white mb-4">
              READY TO RAGE?
            </h2>
            <p className="text-textGray mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Join hundreds of gaming communities already using RAGE OPTIMIZER to dominate their servers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={BOT_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accentRed hover:bg-accentRedHover text-white px-8 py-4 rounded-xl font-gaming font-black tracking-wider flex items-center justify-center space-x-3 transition-all shadow-neonGlow hover:shadow-neonHover hover:scale-[1.02]"
              >
                <Plus className="w-5 h-5" />
                <span>ADD BOT TO SERVER</span>
              </a>
              <button
                onClick={handleCTA}
                className="bg-white/8 hover:bg-white/12 text-white border border-white/15 px-8 py-4 rounded-xl font-gaming font-black tracking-wider flex items-center justify-center space-x-3 transition-all hover:border-accentRed/40"
              >
                <span>OPEN DASHBOARD</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 bg-[#040406]/95 py-10 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-accentRed flex items-center justify-center shadow-neonGlow">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-gaming font-black text-white tracking-wider">RAGE OPTIMIZER</span>
          </div>
          <div className="flex items-center space-x-6 text-textGray text-xs">
            <a href={BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-accentRed transition-colors">Add Bot</a>
            <span className="text-white/10">|</span>
            <span>© {new Date().getFullYear()} RAGE OPTIMIZER</span>
            <span className="text-white/10">|</span>
            <span>dashboard.ragefps.in</span>
          </div>
          {statsLoaded && (
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Bot Online • {stats.ping}ms</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
