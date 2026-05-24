import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Activity, ShieldCheck, Database, HardDrive, Terminal, Server } from 'lucide-react';

export default function AdminPanel() {
  const { backendUrl, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/stats/global`);
        if (res.data.success) {
          setStats(res.data.stats);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to load stats', err);
        setLoading(false);
      }
    };
    fetchStats();

    // Mock live system logs stream
    const interval = setInterval(() => {
      const messages = [
        '[Database] Cleaned up 3 expired user sessions.',
        '[Discord Bot] Heartbeat acknowledged (ping 34ms).',
        '[Socket API] Established sync session connection for guild mock_guild_id_1.',
        '[Security Engine] Completed scheduled dangerous permissions scan.',
        '[Alerts Worker] Checked Twitch streaming nodes - all silent.',
        '[Express API] GET /api/stats/global - 200 OK'
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const logLine = `[${new Date().toLocaleTimeString()}] ${randomMsg}`;
      setLogs(prev => [logLine, ...prev.slice(0, 15)]);
    }, 4000);

    return () => clearInterval(interval);
  }, [backendUrl]);

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-2xl font-gaming font-black text-accentRed tracking-wider uppercase mb-2">ACCESS RESTRICTED</h2>
          <p className="text-textGray text-sm">You must hold global Administrator credentials to view the Bot Control Panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] pt-24 pb-12 px-6">
      <Navbar />
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="border-b border-white/5 pb-6 mb-8">
          <span className="text-xs text-amber-500 font-semibold uppercase tracking-widest">Global Master Node</span>
          <h2 className="text-3xl font-gaming font-black text-white mt-1 uppercase tracking-wider">SYSTEM MONITORING</h2>
        </div>

        {loading || !stats ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-t-2 border-accentRed rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Active Guilds', value: stats.servers, icon: Server, color: 'text-blue-400' },
                { label: 'Users Covered', value: stats.members.toLocaleString(), icon: ShieldCheck, color: 'text-emerald-400' },
                { label: 'Tickets Count', value: stats.ticketsOpened, icon: Database, color: 'text-accentRed' },
                { label: 'Bot Latency', value: `${stats.ping}ms`, icon: Activity, color: 'text-amber-400' }
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="glass-card p-5 rounded-xl border-borderColor/15">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-textGray font-semibold uppercase tracking-wider">{card.label}</span>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <span className="text-2xl font-gaming font-black text-white tracking-wider">
                      {card.value}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Middle Section: Node stats + Logs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Host specs widget */}
              <div className="glass-card p-6 rounded-xl border-borderColor/15 space-y-6">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                  <HardDrive className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Node Metrics</h3>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-textGray">System Status</span>
                    <span className="text-emerald-400 font-semibold uppercase">Healthy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textGray">Node.js Uptime</span>
                    <span className="text-white font-mono">{Math.floor(stats.uptimeSeconds / 3600)}h {Math.floor((stats.uptimeSeconds % 3600) / 60)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textGray">Memory Overhead</span>
                    <span className="text-white font-mono">142 MB / 512 MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textGray">WebSocket gateway</span>
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </div>
                </div>
              </div>

              {/* System Console Logs Terminal */}
              <div className="md:col-span-2 glass-card p-6 rounded-xl border-borderColor/15 flex flex-col h-[280px]">
                <div className="flex items-center space-x-3 pb-3 border-b border-white/5 mb-4">
                  <Terminal className="w-5 h-5 text-accentRed" />
                  <h3 className="font-gaming font-bold text-white uppercase text-md">Live Node Console</h3>
                </div>

                <div className="bg-[#040406] p-4 rounded-lg flex-1 overflow-y-auto font-mono text-[10px] text-textGray leading-relaxed space-y-1">
                  {logs.length === 0 ? (
                    <div className="text-textGray/45 italic">Awaiting console streams...</div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className={`${log.includes('[Security') ? 'text-amber-400' : log.includes('Error') ? 'text-accentRed' : 'text-textGray'}`}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
