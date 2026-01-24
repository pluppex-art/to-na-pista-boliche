
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { AuditLog, User, UserRole } from '../types';
import { 
  Loader2, Shield, User as UserIcon, Activity, Trash2, Pencil, PlusCircle, 
  DollarSign, Search, Clock, Calendar as CalendarIcon, ChevronDown, CalendarRange, BarChart3 
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Link } from 'react-router-dom';

const DATE_PRESETS = [
    { id: 'CUSTOM', label: 'PERSONALIZADO' },
    { id: 'HOJE', label: 'HOJE' },
    { id: 'ONTEM', label: 'ONTEM' },
    { id: '7D', label: 'ÚLTIMOS 7 DIAS' },
    { id: '30D', label: 'ÚLTIMOS 30 DIAS' },
    { id: '90D', label: 'ÚLTIMOS 90 DIAS' },
    { id: 'YEAR', label: 'ESTE ANO' }
];

const Auditoria: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Alterado para iniciar com os últimos 30 dias para evitar tela vazia no primeiro acesso
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { 
      start: start.toISOString().split('T')[0], 
      end: end.toISOString().split('T')[0] 
    };
  });
  const [currentPreset, setCurrentPreset] = useState<string>('30D');
  const [auditUserFilter, setAuditUserFilter] = useState<string>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  const toLocalISO = (date: Date) => date.toISOString().split('T')[0];

  const refreshLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
        const [users, logs] = await Promise.all([
            db.users.getAll(),
            db.audit.getLogs({ 
                startDate: dateRange.start, 
                endDate: dateRange.end, 
                userId: auditUserFilter,
                actionType: auditActionFilter,
                limit: 300 
            })
        ]);
        setAllUsers(users);
        setAuditLogs(logs);
    } finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => {
    refreshLogs();
    const channel = supabase.channel('auditoria-standalone')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => refreshLogs(true))
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange, auditUserFilter, auditActionFilter]);

  const handlePresetChange = (presetId: string) => {
    setCurrentPreset(presetId);
    if (presetId === 'CUSTOM') return;
    const today = new Date();
    let start = new Date();
    let end = new Date();
    switch(presetId) {
        case 'HOJE': break;
        case 'ONTEM': start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); break;
        case '7D': start.setDate(today.getDate() - 6); break;
        case '30D': start.setDate(today.getDate() - 29); break;
        case '90D': start.setDate(today.getDate() - 89); break;
        case 'YEAR': start = new Date(today.getFullYear(), 0, 1); end = new Date(today.getFullYear(), 11, 31); break;
    }
    setDateRange({ start: toLocalISO(start), end: toLocalISO(end) });
  };

  const getActionIcon = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('DELETE') || t.includes('CANCEL')) return <Trash2 size={16} className="text-red-500" />;
    if (t.includes('CREATE') || t.includes('NEW')) return <PlusCircle size={16} className="text-green-500" />;
    if (t.includes('UPDATE') || t.includes('EDIT')) return <Pencil size={16} className="text-blue-500" />;
    if (t.includes('PAY') || t.includes('CHECKOUT')) return <DollarSign size={16} className="text-yellow-500" />;
    return <Activity size={16} className="text-slate-400" />;
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 md:pb-0">
        
        {/* HEADER E NAVEGAÇÃO INTEGRADA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-800 pb-8">
            <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Shield className="text-neon-orange" size={32}/> Auditoria do Sistema
                </h1>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Rastreamento de Atividades da Equipe</p>
            </div>
            
            {/* SUB-NAV SWITCH */}
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-700 shadow-xl self-stretch md:self-auto">
                <Link to="/financeiro" className="flex-1 md:flex-none px-6 py-2.5 rounded-xl text-slate-500 hover:text-slate-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition">
                    <BarChart3 size={16} /> Indicadores
                </Link>
                <Link to="/auditoria" className="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-slate-700 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                    <Shield size={16} /> Auditoria
                </Link>
            </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="bg-slate-800/60 p-6 md:p-8 rounded-[2rem] border border-slate-700 shadow-2xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                        <CalendarRange size={14} className="text-neon-blue"/> Período
                    </label>
                    <div className="relative">
                        <select value={currentPreset} onChange={e => handlePresetChange(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-black uppercase text-xs outline-none focus:border-neon-blue appearance-none cursor-pointer pr-10">
                            {DATE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18}/>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                        <UserIcon size={14} className="text-neon-orange"/> Responsável
                    </label>
                    <select value={auditUserFilter} onChange={e => setAuditUserFilter(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-xs font-black uppercase outline-none focus:border-neon-orange appearance-none">
                        <option value="ALL">TODOS OS MEMBROS</option>
                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                        <Search size={14} className="text-neon-blue"/> Ação
                    </label>
                    <select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-xs font-black uppercase outline-none focus:border-neon-blue appearance-none">
                        <option value="ALL">TODAS AS AÇÕES</option>
                        <option value="CREATE">CRIAÇÕES</option>
                        <option value="UPDATE">EDIÇÕES</option>
                        <option value="DELETE">EXCLUSÕES</option>
                        <option value="LOGIN">ACESSOS</option>
                    </select>
                </div>
                <div className="bg-slate-900/80 px-6 py-4 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Registros</span>
                        <span className="text-lg text-white font-black">{auditLogs.length}</span>
                    </div>
                    <Activity size={20} className="text-neon-orange animate-pulse" />
                </div>
            </div>
            
            {currentPreset === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-4 animate-scale-in">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Início</label>
                        <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold text-xs" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Fim</label>
                        <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold text-xs" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} />
                    </div>
                </div>
            )}
        </div>

        {/* TIMELINE */}
        <div className="bg-slate-800/40 p-6 md:p-10 rounded-[3rem] border border-slate-700 shadow-2xl min-h-[600px] flex flex-col">
            {loading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>
            ) : auditLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-30">
                    <Shield size={64} className="mb-4" />
                    <h3 className="text-lg font-black uppercase">Vazio no período</h3>
                    <p className="text-xs font-bold">Ajuste os filtros para buscar logs anteriores ou realize ações no sistema.</p>
                </div>
            ) : (
                <div className="relative pl-8 space-y-8 before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-700/50">
                    {auditLogs.map((log) => (
                        <div key={log.id} className="relative animate-fade-in group">
                            <div className="absolute left-[-25px] top-1.5 w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center z-10 group-hover:border-neon-orange transition-colors">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-neon-orange"></div>
                            </div>
                            
                            <div className="bg-slate-900/60 p-5 md:p-8 rounded-[2rem] border border-slate-700/50 group-hover:border-slate-600 transition-all shadow-md">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner">
                                            {getActionIcon(log.actionType)}
                                        </div>
                                        <div>
                                            <h4 className="text-base font-black text-white uppercase tracking-tight">{log.userName}</h4>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{log.actionType.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800">
                                        <Clock size={14} className="text-neon-blue"/>
                                        <span className="text-[11px] font-black">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/50">
                                    <p className="text-sm md:text-base text-slate-300 font-medium leading-relaxed italic">
                                        "{log.details}"
                                    </p>
                                    {log.entityId && (
                                        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-3">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">ID Objeto:</span>
                                            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">{log.entityId}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export default Auditoria;
