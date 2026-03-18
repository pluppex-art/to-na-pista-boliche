
import React, { useState, useEffect } from 'react';
import { Users, Kanban as KanbanIcon, LayoutList, BarChart3 } from 'lucide-react';
import ClientList from './ClientList';
import Funnel from './Funnel';
import { db } from '../../services/mockBackend';

const CRM: React.FC = () => {
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN' | 'DASHBOARD'>('KANBAN');
  const [totalClientCount, setTotalClientCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { count } = await db.clients.getAll(0, 1);
        setTotalClientCount(count);
      } catch (e) {
        console.error("Erro ao carregar contagem de clientes", e);
      }
    };
    fetchCount();
  }, []);

  return (
    <div className="h-[calc(100vh-100px)] md:h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      {/* Cabeçalho Unificado do CRM */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 flex-shrink-0 px-1">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">CRM & Clientes</h1>
            <div className="bg-slate-800 border border-slate-700 text-neon-blue px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-inner">
              <Users size={14} />
              <span>{totalClientCount} contatos</span>
            </div>
          </div>

          {/* Seletor de Abas (Dentro de Clientes) */}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-full md:w-auto shadow-lg overflow-x-auto no-scrollbar">
             <button 
                onClick={() => setViewMode('DASHBOARD')} 
                className={`flex-1 md:flex-none px-3 md:px-6 py-2 rounded-lg flex items-center justify-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase transition-all whitespace-nowrap ${viewMode === 'DASHBOARD' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <BarChart3 size={14} className="md:w-4 md:h-4" /> 
                <span>Dashboard</span>
             </button>
             <button 
                onClick={() => setViewMode('KANBAN')} 
                className={`flex-1 md:flex-none px-3 md:px-6 py-2 rounded-lg flex items-center justify-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase transition-all whitespace-nowrap ${viewMode === 'KANBAN' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <KanbanIcon size={14} className="md:w-4 md:h-4" /> 
                <span>Funil</span>
             </button>
             <button 
                onClick={() => setViewMode('LIST')} 
                className={`flex-1 md:flex-none px-3 md:px-6 py-2 rounded-lg flex items-center justify-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase transition-all whitespace-nowrap ${viewMode === 'LIST' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <LayoutList size={14} className="md:w-4 md:h-4" /> 
                <span>Lista</span>
             </button>
          </div>
      </div>

      {/* Renderização Condicional do Conteúdo */}
      <div className="flex-1 min-h-0">
        {viewMode === 'LIST' ? (
          <ClientList />
        ) : (
          <Funnel viewMode={viewMode} />
        )}
      </div>
    </div>
  );
};

export default CRM;
