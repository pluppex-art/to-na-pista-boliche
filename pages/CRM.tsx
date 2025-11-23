
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Client, Reservation } from '../types';
import { Search, MessageCircle, Calendar, Tag, Plus, Users, Loader2 } from 'lucide-react';

const CRM: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      const data = await db.clients.getAll();
      setClients(data);
      setLoading(false);
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedClient) {
        const allRes = await db.reservations.getAll();
        setClientHistory(allRes.filter(r => r.clientId === selectedClient.id));
      }
    };
    fetchHistory();
  }, [selectedClient]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${clean}`, '_blank');
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      
      {/* List View */}
      <div className={`${selectedClient ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden`}>
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white mb-4">Contatos</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, tel ou tag..."
              className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-blue"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
           {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="animate-spin text-neon-blue"/></div>
           ) : filteredClients.map(client => (
             <div 
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700/50 transition ${selectedClient?.id === client.id ? 'bg-slate-700/80 border-l-4 border-l-neon-blue' : ''}`}
             >
               <div className="flex justify-between items-start">
                 <h3 className="font-bold text-white">{client.name}</h3>
                 {client.tags.includes('VIP') && <span className="text-[10px] bg-neon-orange text-white px-1.5 rounded">VIP</span>}
               </div>
               <p className="text-sm text-slate-400 mt-1">{client.phone}</p>
               <div className="flex flex-wrap gap-1 mt-2">
                 {client.tags.slice(0, 2).map(tag => (
                   <span key={tag} className="text-xs bg-slate-900 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600">
                     {tag}
                   </span>
                 ))}
                 {client.tags.length > 2 && <span className="text-xs text-slate-500">+{client.tags.length - 2}</span>}
               </div>
             </div>
           ))}
        </div>
      </div>

      {/* Detail View */}
      <div className={`${!selectedClient ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden`}>
        {selectedClient ? (
          <>
            <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
              <div>
                <button onClick={() => setSelectedClient(null)} className="md:hidden text-slate-400 text-sm mb-2">&larr; Voltar</button>
                <h2 className="text-2xl font-bold text-white">{selectedClient.name}</h2>
                <p className="text-slate-400">{selectedClient.email || 'Sem e-mail'}</p>
              </div>
              <button 
                onClick={() => openWhatsApp(selectedClient.phone)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-[0_0_10px_rgba(34,197,94,0.3)]"
              >
                <MessageCircle size={18} /> WhatsApp
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                   <p className="text-slate-500 text-xs uppercase font-bold">Telefone</p>
                   <p className="text-white font-mono">{selectedClient.phone}</p>
                 </div>
                 <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                   <p className="text-slate-500 text-xs uppercase font-bold">Cliente desde</p>
                   <p className="text-white">{new Date(selectedClient.createdAt).toLocaleDateString('pt-BR')}</p>
                 </div>
                 <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                   <p className="text-slate-500 text-xs uppercase font-bold">Último contato</p>
                   <p className="text-white">{new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR')}</p>
                 </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Tag size={18} className="text-neon-blue"/> Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedClient.tags.map(t => (
                    <span key={t} className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-3 py-1 rounded-full text-sm">
                      {t}
                    </span>
                  ))}
                  <button className="text-slate-400 hover:text-white text-sm flex items-center gap-1 px-3 py-1 border border-slate-600 border-dashed rounded-full">
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </div>

              {/* History */}
              <div>
                 <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Calendar size={18} className="text-neon-orange"/> Histórico de Reservas</h3>
                 <div className="space-y-2">
                   {clientHistory.length === 0 ? (
                     <p className="text-slate-500 italic">Nenhuma reserva encontrada.</p>
                   ) : (
                     clientHistory.map(h => (
                       <div key={h.id} className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg border border-slate-700">
                         <div>
                           <span className="text-white font-medium">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                           <span className="text-slate-400 mx-2">|</span>
                           <span className="text-slate-300">{h.eventType}</span>
                         </div>
                         <span className={`text-xs px-2 py-1 rounded ${h.status === 'Confirmada' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>
                           {h.status}
                         </span>
                       </div>
                     ))
                   )}
                 </div>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Users size={64} className="mb-4 opacity-20" />
            <p>Selecione um contato para ver detalhes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CRM;
