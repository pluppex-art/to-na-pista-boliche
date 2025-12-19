
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/mockBackend';
import { AppSettings, UserRole, User, DayConfig } from '../types';
import { PERMISSION_KEYS } from '../constants';
import { Save, UserPlus, Clock, LogOut, X, Trash2, CreditCard, Loader2, DollarSign, MapPin, Upload, Camera, CheckCircle, AlertTriangle, Key, Link2, ShieldCheck, ChevronDown, Lock, Pencil, Shield, CalendarOff, Plus, Eye, EyeOff, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const [userForm, setUserForm] = useState<Partial<User>>({
    id: '', name: '', email: '', passwordHash: '', role: UserRole.GESTOR,
    perm_view_agenda: false, perm_view_financial: false, perm_view_crm: false,
    perm_create_reservation: false, perm_edit_reservation: false, perm_delete_reservation: false,
    perm_edit_client: false, perm_receive_payment: false, perm_create_reservation_no_contact: false
  });

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hoursOptions = Array.from({ length: 25 }, (_, i) => i);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const stored = localStorage.getItem('tonapista_auth');
      if (stored) setCurrentUser(JSON.parse(stored));
      const s = await db.settings.get();
      const u = await db.users.getAll();
      setSettings(s);
      setUsers(u);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const showSuccess = () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); };
  const showError = (msg: string) => { setSaveError(msg); setTimeout(() => setSaveError(''), 4000); };

  const handleSaveGeneral = async () => {
    if (settings) {
      setIsSavingGeneral(true);
      try {
        await db.settings.saveGeneral(settings);
        showSuccess();
      } catch (error: any) { showError(error.message || "Erro ao salvar."); }
      finally { setIsSavingGeneral(false); }
    }
  };

  const handleSaveHours = async () => {
    if (settings) {
      setIsSavingHours(true);
      try {
        await db.settings.saveHours(settings);
        showSuccess();
      } catch (error: any) { showError(error.message || "Erro ao salvar."); }
      finally { setIsSavingHours(false); }
    }
  };

  const handleAddBlockedDate = () => {
      if (!newBlockedDate || !settings) return;
      if (settings.blockedDates.includes(newBlockedDate)) return;
      setSettings({ ...settings, blockedDates: [...settings.blockedDates, newBlockedDate].sort() });
      setNewBlockedDate('');
  };

  const handleRemoveBlockedDate = (date: string) => {
      if (!settings) return;
      setSettings({ ...settings, blockedDates: settings.blockedDates.filter(d => d !== date) });
  };

  const updateDayConfig = (index: number, field: keyof DayConfig, value: any) => {
      if(!settings) return;
      const newHours = [...settings.businessHours];
      newHours[index] = { ...newHours[index], [field]: value };
      setSettings({ ...settings, businessHours: newHours });
  };

  const handleLogout = async () => {
    localStorage.removeItem('tonapista_auth');
    await db.users.logout();
    navigate('/login', { replace: true });
  };

  if (isLoading || !settings) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue"/></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8 px-4 md:px-0">
      
      {/* Toast Notifier - Compacto no Mobile */}
      {saveSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 animate-bounce">
          <div className="bg-green-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold">
            <CheckCircle size={16} /> Salvo com sucesso
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">Configurações</h1>
        <button onClick={handleLogout} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm hover:bg-red-500/20 transition">
          <LogOut size={16} /> <span>Sair</span>
        </button>
      </div>

      {/* Tabs Responsivas */}
      <div className="grid grid-cols-3 gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
        {['general', 'integrations', 'team'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)} 
            className={`py-2 md:py-3 rounded-lg font-bold transition text-[10px] md:text-xs uppercase tracking-wider ${activeTab === tab ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab === 'general' ? 'Geral' : tab === 'integrations' ? 'Pagos' : 'Time'}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 md:p-6 border border-slate-700 shadow-xl overflow-hidden">
        {activeTab === 'general' && (
             <div className="animate-fade-in space-y-6 md:space-y-8">
                 {/* Header Estabelecimento */}
                 <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-900 border-2 border-dashed border-slate-600 hover:border-neon-blue cursor-pointer flex items-center justify-center overflow-hidden transition group">
                            {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain p-2"/> : <Upload className="text-slate-500 group-hover:text-neon-blue"/>}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Logotipo</p>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = () => setSettings({...settings, logoUrl: reader.result as string});
                                 reader.readAsDataURL(file);
                             }
                        }}/>
                    </div>
                    
                    <div className="flex-1 w-full space-y-4">
                        <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 uppercase tracking-widest text-slate-400">
                           <MapPin size={16} className="text-neon-blue"/> Identificação
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-neon-blue outline-none transition" value={settings.establishmentName} onChange={e => setSettings({...settings, establishmentName: e.target.value})} placeholder="Nome do Boliche"/>
                            <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-neon-blue outline-none transition" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} placeholder="Endereço completo"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-neon-blue outline-none transition" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} placeholder="Telefone"/>
                            <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-neon-blue outline-none transition" value={settings.whatsappLink} onChange={e => setSettings({...settings, whatsappLink: e.target.value})} placeholder="Link WhatsApp"/>
                        </div>
                    </div>
                 </div>

                 {/* Preços e Pistas */}
                 <div className="pt-4 border-t border-slate-700 space-y-4">
                    <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 uppercase tracking-widest text-slate-400">
                       <DollarSign size={16} className="text-neon-green"/> Valores & Pistas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Pistas Ativas</label>
                            <input type="number" className="w-full bg-transparent text-white font-bold outline-none text-sm" value={settings.activeLanes} onChange={e => setSettings({...settings, activeLanes: parseInt(e.target.value)})} />
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Preço Seg-Qui (Hora)</label>
                            <input type="number" className="w-full bg-transparent text-white font-bold outline-none text-sm" value={settings.weekdayPrice} onChange={e => setSettings({...settings, weekdayPrice: parseFloat(e.target.value)})} />
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Preço Sex-Dom (Hora)</label>
                            <input type="number" className="w-full bg-transparent text-white font-bold outline-none text-sm" value={settings.weekendPrice} onChange={e => setSettings({...settings, weekendPrice: parseFloat(e.target.value)})} />
                        </div>
                    </div>
                 </div>

                 {/* Datas Bloqueadas */}
                 <div className="pt-4 border-t border-slate-700 space-y-4">
                    <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 uppercase tracking-widest text-slate-400">
                       <CalendarOff size={16} className="text-red-400"/> Datas Bloqueadas
                    </h3>
                    <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-700 space-y-3">
                        <div className="flex gap-2">
                            <input type="date" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-blue" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)}/>
                            <button onClick={handleAddBlockedDate} className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-slate-600 transition flex items-center gap-2"><Plus size={14}/> Bloquear</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {settings.blockedDates.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-2">Nenhuma data bloqueada manualmente.</p>
                            ) : (
                                settings.blockedDates.map(date => (
                                    <div key={date} className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-md flex items-center gap-2 text-[10px] font-bold">
                                        {date.split('-').reverse().join('/')}
                                        <button onClick={() => handleRemoveBlockedDate(date)} className="hover:text-white"><X size={12}/></button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                 </div>

                 <button onClick={handleSaveGeneral} disabled={isSavingGeneral} className="w-full py-4 bg-neon-orange hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-sm uppercase tracking-widest">
                    {isSavingGeneral ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    Salvar Dados Gerais
                 </button>

                 {/* Horários de Funcionamento */}
                 <div className="pt-8 border-t border-slate-700 space-y-4">
                     <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 uppercase tracking-widest text-slate-400">
                        <Clock size={16} className="text-neon-blue"/> Horários Semanais
                     </h3>
                     <div className="space-y-1">
                        {settings.businessHours.map((h, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-900/20 rounded-lg hover:bg-slate-900/40 transition">
                                <span className="text-[11px] font-bold text-slate-400 w-8 md:w-12">{daysOfWeek[i]}</span>
                                <label className="relative inline-flex items-center cursor-pointer scale-75">
                                    <input type="checkbox" checked={h.isOpen} onChange={e => updateDayConfig(i, 'isOpen', e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-blue"></div>
                                </label>
                                <div className={`flex items-center gap-1 transition-opacity ${h.isOpen ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                                    <select value={h.start} onChange={e => updateDayConfig(i, 'start', parseInt(e.target.value))} className="bg-slate-800 text-white rounded px-1.5 py-1 text-[10px] font-bold border border-slate-700">{hoursOptions.map(o => <option key={o} value={o}>{o}:00</option>)}</select>
                                    <span className="text-slate-600 text-[10px]">até</span>
                                    <select value={h.end} onChange={e => updateDayConfig(i, 'end', parseInt(e.target.value))} className="bg-slate-800 text-white rounded px-1.5 py-1 text-[10px] font-bold border border-slate-700">{hoursOptions.map(o => <option key={o} value={o}>{o}:00</option>)}</select>
                                </div>
                            </div>
                        ))}
                     </div>
                     <button onClick={handleSaveHours} disabled={isSavingHours} className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-95 text-sm uppercase tracking-widest">
                        {isSavingHours ? <Loader2 className="animate-spin" size={18}/> : <Clock size={18}/>}
                        Atualizar Grade de Horários
                     </button>
                 </div>
             </div>
        )}

        {activeTab === 'integrations' && (
             <div className="space-y-6 animate-fade-in py-4">
                 <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                     <input type="checkbox" checked={settings.onlinePaymentEnabled} onChange={e => setSettings({...settings, onlinePaymentEnabled: e.target.checked})} className="w-5 h-5 accent-neon-green cursor-pointer"/>
                     <div>
                        <span className="text-white font-bold text-sm block">Pagamentos Online</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Ativar Mercado Pago no Checkout</span>
                     </div>
                 </div>
                 
                 {settings.onlinePaymentEnabled && (
                     <div className="space-y-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700 animate-scale-in">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Credenciais MP</span>
                            <button onClick={() => setShowSecrets(!showSecrets)} className="text-[10px] text-neon-blue font-bold flex items-center gap-1">{showSecrets ? <EyeOff size={12}/> : <Eye size={12}/>} {showSecrets ? 'Ocultar' : 'Ver Chaves'}</button>
                         </div>
                         <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Public Key</label>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-[11px] text-white font-mono" value={settings.mercadopagoPublicKey} onChange={e => setSettings({...settings, mercadopagoPublicKey: e.target.value})} />
                            </div>
                            {showSecrets && (
                                <div className="animate-fade-in">
                                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Access Token</label>
                                    <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-[11px] text-white font-mono" type="password" value={settings.mercadopagoAccessToken} onChange={e => setSettings({...settings, mercadopagoAccessToken: e.target.value})} />
                                </div>
                            )}
                         </div>
                         <button onClick={handleSaveGeneral} className="w-full py-4 bg-neon-green hover:bg-green-600 text-black rounded-xl font-bold text-sm uppercase tracking-widest transition shadow-lg active:scale-95">Salvar Integração</button>
                     </div>
                 )}
             </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center px-1">
               <h3 className="text-sm font-bold text-white uppercase tracking-widest text-slate-400">Equipe Ativa</h3>
               <button className="text-[10px] bg-neon-blue text-white px-3 py-1.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-tighter shadow-sm"><UserPlus size={12} /> Novo Membro</button>
            </div>
            <div className="space-y-2">
                {users.map(user => (
                    <div key={user.id} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-neon-blue font-bold text-xs border border-slate-700 group-hover:border-neon-blue transition">{user.name.charAt(0)}</div>
                            <div>
                                <h4 className="text-xs font-bold text-white leading-none mb-1">{user.name}</h4>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${user.role === UserRole.ADMIN ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{user.role === UserRole.GESTOR ? 'USUÁRIO' : user.role}</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button className="p-2 text-slate-500 hover:text-white transition"><Pencil size={14}/></button>
                            <button className="p-2 text-slate-500 hover:text-red-400 transition"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
