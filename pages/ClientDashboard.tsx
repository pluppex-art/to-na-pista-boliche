
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Reservation, LoyaltyTransaction } from '../types';
import { db } from '../services/mockBackend';
import { useApp } from '../contexts/AppContext';
import { LogOut, User, Gift, Clock, Calendar, MapPin, Coins, Loader2, MessageCircle } from 'lucide-react';

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_client_auth');
    if (!stored) {
      navigate('/login');
      return;
    }
    const clientData = JSON.parse(stored);
    
    const loadData = async () => {
        setLoading(true);
        // Refresh client data
        const freshClient = await db.clients.getById(clientData.id);
        if (freshClient) setClient(freshClient);
        else setClient(clientData); // Fallback

        // Load History
        const allRes = await db.reservations.getAll();
        const myRes = allRes.filter(r => r.clientId === clientData.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(myRes);

        // Load Loyalty
        const pts = await db.loyalty.getHistory(clientData.id);
        setLoyalty(pts);
        
        setLoading(false);
    };
    loadData();
  }, [navigate]);

  const handleLogout = () => {
      localStorage.removeItem('tonapista_client_auth');
      navigate('/login');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48}/></div>;
  if (!client) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
        {/* Header Mobile-First */}
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20">
            <div className="max-w-md mx-auto flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">Minha Conta</h1>
                <button onClick={handleLogout} className="text-slate-400 hover:text-white"><LogOut size={20}/></button>
            </div>
        </header>

        <main className="max-w-md mx-auto p-4 space-y-6">
            
            {/* User Welcome */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 text-neon-blue">
                    <User size={24}/>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">Olá, {client.name.split(' ')[0]}!</h2>
                    <p className="text-sm text-slate-400">Bom te ver por aqui.</p>
                </div>
            </div>

            {/* Loyalty Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-neon-orange/30 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-orange/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold text-neon-orange uppercase tracking-wider bg-orange-900/20 px-2 py-1 rounded">Fidelidade</span>
                        <Gift className="text-neon-orange" size={24}/>
                    </div>
                    <div className="mb-2">
                        <span className="text-4xl font-bold text-white">{client.loyaltyBalance || 0}</span>
                        <span className="text-sm text-slate-400 ml-1">pontos</span>
                    </div>
                    <p className="text-xs text-slate-500">Cada R$ 1,00 gasto vale 1 ponto.</p>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navigate('/agendamento')} className="bg-neon-blue hover:bg-blue-600 text-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center gap-2 transition">
                    <Calendar size={24}/>
                    <span className="font-bold text-sm">Novo Agendamento</span>
                </button>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-center gap-2 opacity-75">
                    <Coins size={24} className="text-slate-500"/>
                    <span className="font-bold text-sm text-slate-400">Trocar Pontos</span>
                    <span className="text-[10px] text-slate-500">Em breve</span>
                </div>
            </div>

            {/* History Tabs (Recent vs Loyalty) */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-slate-400"/> Atividades Recentes</h3>
                
                {history.length === 0 ? (
                    <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800 border-dashed text-slate-500">
                        Nenhum agendamento ainda.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.slice(0, 5).map(res => (
                            <div key={res.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                <div>
                                    <p className="text-white font-medium">{new Date(res.date).toLocaleDateString('pt-BR')} às {res.time}</p>
                                    <p className="text-xs text-slate-500">{res.eventType} • {res.laneCount} Pista(s)</p>
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded uppercase ${res.status === 'Confirmada' ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                    {res.status}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </main>

        {/* Floating WhatsApp Button */}
        {settings && (
            <a
                href={settings.whatsappLink || `https://wa.me/55${settings.phone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128c7e] text-white p-3 md:p-4 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white/10"
                aria-label="Fale conosco no WhatsApp"
            >
                <MessageCircle size={28} className="md:w-8 md:h-8" />
            </a>
        )}
    </div>
  );
};

export default ClientDashboard;
