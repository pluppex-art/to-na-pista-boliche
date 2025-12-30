
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { AppSettings, UserRole, User, DayConfig } from '../types';
import { PERMISSION_KEYS } from '../constants';
import { Save, UserPlus, Clock, LogOut, X, Trash2, Loader2, DollarSign, MapPin, Upload, CheckCircle, Eye, EyeOff, Pencil, Shield, CalendarOff, Plus, Key, Mail, User as UserIcon, Calendar, Phone, Link as LinkIcon, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de carregamento por seção
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [userPassword, setUserPassword] = useState('');

  const initialUserForm: Partial<User> = {
    id: '', name: '', email: '', role: UserRole.GESTOR,
    perm_view_agenda: true, perm_view_financial: false, perm_view_crm: false,
    perm_create_reservation: false, perm_edit_reservation: false, perm_delete_reservation: false,
    perm_edit_client: false, perm_receive_payment: false, perm_create_reservation_no_contact: false
  };

  const [userForm, setUserForm] = useState<Partial<User>>(initialUserForm);

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const fetchTeam = async () => {
      try {
          const u = await db.users.getAll();
          setUsers(u);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const stored = localStorage.getItem('tonapista_auth');
      if (stored) setCurrentUser(JSON.parse(stored));
      const s = await db.settings.get();
      setSettings(s);
      await fetchTeam();
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const triggerSuccess = (section: string) => { 
    setSaveSuccess(section); 
    setTimeout(() => setSaveSuccess(null), 3000); 
  };
  
  const showError = (msg: string) => { 
    setSaveError(msg); 
    setTimeout(() => setSaveError(''), 5000); 
  };

  const handleSaveSection = async (section: 'IDENTIFICATION' | 'BUSINESS' | 'HOURS' | 'EXCEPTIONS' | 'PAYMENTS') => {
    if (!settings) return;
    setLoadingSection(section);
    setSaveError('');
    
    try {
      if (section === 'HOURS') {
          await db.settings.saveHours(settings);
      } else {
          // Todas as outras seções salvam na tabela principal
          await db.settings.saveGeneral(settings);
      }
      triggerSuccess(section);
    } catch (error: any) { 
      showError(error.message || "Falha ao salvar seção.");
    } finally { 
      setLoadingSection(null); 
    }
  };

  const handleOpenNewUser = () => {
      setUserForm(initialUserForm);
      setUserPassword('');
      setIsEditingUser(false);
      setShowUserModal(true);
  };

  const handleOpenEditUser = (user: User) => {
      setUserForm({ ...user });
      setUserPassword(''); 
      setIsEditingUser(true);
      setShowUserModal(true);
  };

  const handleSaveUser = async () => {
      if (!userForm.name || !userForm.email) {
          alert("Nome e E-mail são obrigatórios.");
          return;
      }
      setLoadingSection('USER_MODAL');
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const action = isEditingUser ? 'UPDATE' : 'CREATE';
          const { data, error } = await supabase.functions.invoke('manage-staff', {
              body: { action, userData: { ...userForm, password: userPassword } },
              headers: { Authorization: `Bearer ${session?.access_token}` }
          });
          if (error || data?.error) throw new Error(error?.message || data?.error);
          await fetchTeam();
          setShowUserModal(false);
          triggerSuccess('TEAM');
      } catch (e: any) {
          alert("Erro: " + e.message);
      } finally {
          setLoadingSection(null);
      }
  };

  const handleDeleteUser = async (user: User) => {
      if (user.id === currentUser?.id) {
          alert("Você não pode excluir seu próprio usuário.");
          return;
      }
      if (!window.confirm(`Remover acesso de ${user.name}?`)) return;
      setLoadingSection('TEAM');
      try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('manage-staff', {
              body: { action: 'DELETE', userData: { id: user.id } },
              headers: { Authorization: `Bearer ${session?.access_token}` }
          });
          await fetchTeam();
          triggerSuccess('TEAM');
      } catch (e: any) {
          alert("Erro: " + e.message);
      } finally {
          setLoadingSection(null);
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
      const sanitizedValue = (field === 'start' || field === 'end') ? (isNaN(parseInt(value)) ? 0 : parseInt(value)) : value;
      newHours[index] = { ...newHours[index], [field]: sanitizedValue };
      setSettings({ ...settings, businessHours: newHours });
  };

  if (isLoading || !settings) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48}/></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8 px-2 md:px-0">
      
      {saveError && (
        <div className="fixed top-4 right-4 z-[100] animate-notification">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col gap-1 text-xs font-bold border border-red-400">
            <div className="flex items-center gap-2 uppercase tracking-widest"><X size={16} /> Falha ao Salvar</div>
            <p className="opacity-90 font-mono text-[10px]">{saveError}</p>
          </div>
        </div>
      )}

      <div className="px-1">
        <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">Configurações</h1>
        <p className="text-slate-500 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-1">Gestão Estratégica do Sistema</p>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-slate-900/50 p-1 rounded-2xl border border-slate-700 shadow-inner">
        {[
          { id: 'general', label: 'Geral', icon: Shield },
          { id: 'integrations', label: 'Pagos', icon: Key },
          { id: 'team', label: 'Equipe', icon: UserPlus }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center justify-center gap-2 py-2.5 md:py-3 rounded-xl font-black transition-all text-[9px] md:text-[10px] uppercase tracking-widest ${activeTab === tab.id ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <tab.icon size={12} className="md:w-[14px] md:h-[14px]"/> <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-10 border border-slate-700 shadow-2xl overflow-hidden min-h-[500px]">
        {activeTab === 'general' && (
             <div className="animate-fade-in space-y-12 md:space-y-16">
                 
                 {/* SEÇÃO: IDENTIFICAÇÃO */}
                 <div className="space-y-6">
                    <div className="flex justify-between items-center border-l-4 border-neon-green pl-4">
                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Identificação Pública</h3>
                        <button 
                            onClick={() => handleSaveSection('IDENTIFICATION')} 
                            disabled={loadingSection === 'IDENTIFICATION'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${saveSuccess === 'IDENTIFICATION' ? 'bg-green-600 text-white' : 'bg-neon-green hover:bg-green-600 text-black shadow-lg'}`}
                        >
                            {loadingSection === 'IDENTIFICATION' ? <Loader2 size={14} className="animate-spin"/> : saveSuccess === 'IDENTIFICATION' ? <CheckCircle size={14}/> : <Save size={14}/>}
                            {saveSuccess === 'IDENTIFICATION' ? 'Salvo' : 'Salvar'}
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12">
                        <div className="flex flex-col items-center gap-2">
                            <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 md:w-40 md:h-40 rounded-[2rem] bg-slate-900 border-2 border-dashed border-slate-700 hover:border-neon-orange cursor-pointer flex items-center justify-center overflow-hidden transition-all group shadow-inner">
                                {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain p-4"/> : <Upload size={32} className="text-slate-600 group-hover:text-neon-orange"/>}
                            </div>
                            <span className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-widest">Logo da Empresa</span>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setSettings(prev => prev ? {...prev, logoUrl: reader.result as string} : null);
                                    reader.readAsDataURL(file);
                                }
                            }}/>
                        </div>
                        
                        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 focus-within:border-neon-blue transition shadow-inner">
                                <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-1">Nome Comercial</label>
                                <input className="w-full bg-transparent text-white font-bold outline-none text-xs md:text-sm" value={settings.establishmentName} onChange={e => setSettings({...settings, establishmentName: e.target.value})} placeholder="Ex: Tô Na Pista Boliche"/>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 focus-within:border-neon-blue transition shadow-inner">
                                <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-1">Telefone Fixo / SAC</label>
                                <input className="w-full bg-transparent text-white font-bold outline-none text-xs md:text-sm" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} placeholder="(00) 0000-0000"/>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 focus-within:border-neon-blue transition shadow-inner md:col-span-2">
                                <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-1">Endereço Operacional</label>
                                <input className="w-full bg-transparent text-white font-bold outline-none text-xs md:text-sm" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} placeholder="Rua, Número, Bairro - Cidade/UF"/>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 focus-within:border-neon-blue transition shadow-inner md:col-span-2">
                                <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-1">Link Direto WhatsApp</label>
                                <input className="w-full bg-transparent text-white font-bold outline-none text-[10px] md:text-xs font-mono" value={settings.whatsappLink} onChange={e => setSettings({...settings, whatsappLink: e.target.value})} placeholder="https://wa.me/55..."/>
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* SEÇÃO: PARÂMETROS DE NEGÓCIO */}
                 <div className="space-y-6">
                    <div className="flex justify-between items-center border-l-4 border-neon-green pl-4">
                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Parâmetros de Negócio</h3>
                        <button 
                            onClick={() => handleSaveSection('BUSINESS')} 
                            disabled={loadingSection === 'BUSINESS'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${saveSuccess === 'BUSINESS' ? 'bg-green-600 text-white' : 'bg-neon-green hover:bg-green-600 text-black shadow-lg'}`}
                        >
                            {loadingSection === 'BUSINESS' ? <Loader2 size={14} className="animate-spin"/> : saveSuccess === 'BUSINESS' ? <CheckCircle size={14}/> : <Save size={14}/>}
                            {saveSuccess === 'BUSINESS' ? 'Salvo' : 'Salvar'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                        <div className="bg-slate-900/80 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-700 shadow-inner">
                            <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-2">Pistas Ativas</label>
                            <input 
                                type="number" 
                                className="w-full bg-transparent text-white text-lg md:text-2xl font-black outline-none" 
                                value={isNaN(settings.activeLanes) ? '' : settings.activeLanes} 
                                onChange={e => setSettings({...settings, activeLanes: parseInt(e.target.value)})} 
                            />
                        </div>
                        <div className="bg-slate-900/80 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-700 shadow-inner">
                            <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-2">Preço Semana (H)</label>
                            <div className="flex items-center gap-2 text-white font-black text-lg md:text-2xl">
                                <span className="text-neon-green text-[10px] md:text-xs">R$</span>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent outline-none" 
                                    value={isNaN(settings.weekdayPrice) ? '' : settings.weekdayPrice} 
                                    onChange={e => setSettings({...settings, weekdayPrice: parseFloat(e.target.value)})} 
                                />
                            </div>
                        </div>
                        <div className="bg-slate-900/80 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-700 shadow-inner">
                            <label className="block text-[8px] md:text-[9px] text-slate-500 font-black uppercase mb-2">Preço Weekend (H)</label>
                            <div className="flex items-center gap-2 text-white font-black text-lg md:text-2xl">
                                <span className="text-neon-green text-[10px] md:text-xs">R$</span>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent outline-none" 
                                    value={isNaN(settings.weekendPrice) ? '' : settings.weekendPrice} 
                                    onChange={e => setSettings({...settings, weekendPrice: parseFloat(e.target.value)})} 
                                />
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* SEÇÃO: CALENDÁRIO SEMANAL */}
                 <div className="space-y-6">
                    <div className="flex justify-between items-center border-l-4 border-neon-green pl-4">
                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Calendário Semanal</h3>
                        <button 
                            onClick={() => handleSaveSection('HOURS')} 
                            disabled={loadingSection === 'HOURS'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${saveSuccess === 'HOURS' ? 'bg-green-600 text-white' : 'bg-neon-green hover:bg-green-600 text-black shadow-lg'}`}
                        >
                            {loadingSection === 'HOURS' ? <Loader2 size={14} className="animate-spin"/> : saveSuccess === 'HOURS' ? <CheckCircle size={14}/> : <Save size={14}/>}
                            {saveSuccess === 'HOURS' ? 'Horários Salvos' : 'Salvar'}
                        </button>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        {settings.businessHours.map((day, idx) => (
                            <div key={idx} className={`p-3 md:p-5 rounded-xl md:rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4 transition-all ${day.isOpen ? 'bg-slate-900/60 border-slate-700 shadow-lg' : 'bg-slate-950/20 border-slate-800 opacity-60'}`}>
                                <div className="flex items-center gap-3 md:gap-4">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={day.isOpen} onChange={e => updateDayConfig(idx, 'isOpen', e.target.checked)} className="sr-only peer" />
                                        <div className="w-10 h-5 md:w-11 md:h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-neon-blue"></div>
                                    </label>
                                    <span className={`text-[10px] md:text-sm font-black uppercase tracking-widest ${day.isOpen ? 'text-white' : 'text-slate-600'}`}>{daysOfWeek[idx]}</span>
                                </div>
                                {day.isOpen && (
                                    <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
                                        <div className="flex-1 sm:flex-none">
                                            <label className="block text-[7px] md:text-[8px] text-slate-500 font-black uppercase mb-1">Abertura</label>
                                            <input type="number" min="0" max="23" className="w-full sm:w-16 md:w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 md:p-2.5 text-white font-black text-center text-xs md:text-base shadow-inner focus:border-neon-blue outline-none" value={day.start} onChange={e => updateDayConfig(idx, 'start', e.target.value)} />
                                        </div>
                                        <div className="flex-1 sm:flex-none">
                                            <label className="block text-[7px] md:text-[8px] text-slate-500 font-black uppercase mb-1">Fechamento</label>
                                            <input type="number" min="0" max="23" className="w-full sm:w-16 md:w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 md:p-2.5 text-white font-black text-center text-xs md:text-base shadow-inner focus:border-neon-blue outline-none" value={day.end} onChange={e => updateDayConfig(idx, 'end', e.target.value)} />
                                        </div>
                                        <span className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase mt-3 md:mt-4">H</span>
                                    </div>
                                )}
                                {!day.isOpen && <span className="text-[8px] md:text-[10px] font-black text-red-500/50 uppercase tracking-widest border border-red-500/20 px-3 py-1 rounded-full bg-red-900/5">Loja Fechada</span>}
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* SEÇÃO: EXCEÇÕES DE AGENDA */}
                 <div className="space-y-6">
                    <div className="flex justify-between items-center border-l-4 border-red-500 pl-4">
                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Exceções de Agenda</h3>
                        <button 
                            onClick={() => handleSaveSection('EXCEPTIONS')} 
                            disabled={loadingSection === 'EXCEPTIONS'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${saveSuccess === 'EXCEPTIONS' ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg'}`}
                        >
                            {loadingSection === 'EXCEPTIONS' ? <Loader2 size={14} className="animate-spin"/> : saveSuccess === 'EXCEPTIONS' ? <CheckCircle size={14}/> : <Save size={14}/>}
                            {saveSuccess === 'EXCEPTIONS' ? 'Bloqueios Salvos' : 'Salvar Bloqueios'}
                        </button>
                    </div>

                    <div className="bg-slate-900 p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-700 space-y-6 md:space-y-8 shadow-2xl">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18}/>
                                <input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white font-black outline-none focus:border-red-500 transition text-xs md:text-sm shadow-inner" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} />
                            </div>
                            <button onClick={handleAddBlockedDate} className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.15em] transition active:scale-95 flex items-center justify-center gap-2"><Plus size={16}/> Adicionar à Lista</button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2">
                            {settings.blockedDates.length === 0 ? (
                                <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl w-full text-center">
                                    <p className="text-[8px] md:text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">Nenhuma data bloqueada manualmente</p>
                                </div>
                            ) : settings.blockedDates.map(date => (
                                <div key={date} className="bg-slate-800 border border-slate-700 pl-4 pr-1.5 py-1.5 md:py-2.5 rounded-2xl flex items-center gap-2 md:gap-4 group animate-scale-in hover:border-red-500/50 transition-colors shadow-lg">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] md:text-[10px] font-black text-white">{date.split('-').reverse().join('/')}</span>
                                        <span className="text-[6px] md:text-[7px] text-slate-500 font-black uppercase">Bloqueado</span>
                                    </div>
                                    <button onClick={() => handleRemoveBlockedDate(date)} className="p-2 text-slate-500 hover:text-white hover:bg-red-600 rounded-xl transition-all"><X size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
             </div>
        )}

        {activeTab === 'integrations' && (
             <div className="space-y-6 md:space-y-10 animate-fade-in py-2">
                 <div className="p-5 md:p-8 bg-slate-900/50 rounded-2xl md:rounded-[2rem] border border-slate-700 flex items-center justify-between group shadow-xl">
                     <div className="flex items-center gap-3 md:gap-6">
                        <div className={`p-4 md:p-5 rounded-2xl border transition-all shadow-inner ${settings.onlinePaymentEnabled ? 'bg-neon-green/10 border-neon-green text-neon-green shadow-green-500/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}><DollarSign size={28}/></div>
                        <div>
                            <span className="text-white font-black text-xs md:text-base uppercase tracking-widest block leading-none mb-1.5">Checkout Integrado</span>
                            <span className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Mercado Pago (Gateways de Pagamento)</span>
                        </div>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer scale-110 md:scale-125">
                        <input type="checkbox" checked={settings.onlinePaymentEnabled} onChange={e => setSettings({...settings, onlinePaymentEnabled: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-green"></div>
                    </label>
                 </div>
                 
                 {settings.onlinePaymentEnabled && (
                     <div className="space-y-5 md:space-y-8 p-6 md:p-12 bg-slate-900 border border-slate-700 rounded-2xl md:rounded-[3rem] animate-scale-in shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 pointer-events-none -rotate-12"><Key size={100} className="md:w-32 md:h-32"/></div>
                         <div className="flex justify-between items-center border-b border-slate-800 pb-6 mb-2">
                            <div>
                                <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Credenciais de Produção</h4>
                                <p className="text-[8px] text-slate-600 font-bold uppercase">Configure suas chaves API com segurança</p>
                            </div>
                            <button onClick={() => setShowSecrets(!showSecrets)} className="text-[9px] md:text-[10px] text-neon-blue font-black uppercase tracking-[0.2em] flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 hover:text-white transition-all">
                                {showSecrets ? <EyeOff size={14}/> : <Eye size={14}/>} <span>{showSecrets ? 'Esconder Tokens' : 'Revelar Tokens'}</span>
                            </button>
                         </div>
                         <div className="space-y-4 md:space-y-6">
                            <div className="space-y-2">
                                <label className="text-[7px] md:text-[9px] text-slate-500 font-black uppercase ml-1 tracking-widest">Public Key (Identificador)</label>
                                <input className="w-full bg-slate-950 border border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-[10px] md:text-[13px] text-white font-mono shadow-inner outline-none focus:border-neon-blue transition" value={settings.mercadopagoPublicKey} onChange={e => setSettings({...settings, mercadopagoPublicKey: e.target.value})} placeholder="APP_USR-XXXX-XXXX-XXXX-XXXX"/>
                            </div>
                            {showSecrets && (
                                <div className="space-y-2 animate-fade-in">
                                    <label className="text-[7px] md:text-[9px] text-slate-500 font-black uppercase ml-1 tracking-widest">Access Token (Senha Privada)</label>
                                    <input className="w-full bg-slate-950 border border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-[10px] md:text-[13px] text-white font-mono shadow-inner outline-none focus:border-neon-blue transition" type="password" value={settings.mercadopagoAccessToken} onChange={e => setSettings({...settings, mercadopagoAccessToken: e.target.value})} placeholder="TEST-XXXX-XXXX-XXXX-XXXX"/>
                                </div>
                            )}
                         </div>
                         <button onClick={() => handleSaveSection('PAYMENTS')} className="w-full py-5 md:py-6 bg-neon-green hover:bg-green-600 text-black rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-[0.4em] shadow-xl shadow-green-900/30 transition-all active:scale-95 border-t border-white/20">
                            {loadingSection === 'PAYMENTS' ? <Loader2 className="animate-spin mx-auto"/> : 'Sincronizar Mercado Pago'}
                         </button>
                     </div>
                 )}
             </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6 md:space-y-10 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1 border-b border-slate-700 pb-8">
               <div>
                   <h3 className="text-sm md:text-xl font-black text-white uppercase tracking-widest leading-none mb-1.5">Membros da Equipe</h3>
                   <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Permissões e acessos ao console</p>
               </div>
               <button onClick={handleOpenNewUser} className="w-full sm:w-auto bg-neon-blue hover:bg-blue-600 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] md:text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/30 transition-all active:scale-95"><UserPlus size={18} /> Novo Membro</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {users.map(user => (
                    <div key={user.id} className="bg-slate-900/60 p-4 md:p-6 rounded-[2rem] border border-slate-700 flex justify-between items-center group hover:border-slate-500 transition-all shadow-lg hover:shadow-2xl">
                        <div className="flex items-center gap-4 md:gap-5 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0 rounded-2xl md:rounded-[1.5rem] bg-slate-800 flex items-center justify-center text-neon-blue font-black text-xl md:text-2xl border border-slate-700 shadow-inner uppercase">{user.name.charAt(0)}</div>
                            <div className="min-w-0">
                                <h4 className="text-sm md:text-lg font-black text-white leading-none mb-1.5 md:mb-2 uppercase tracking-tight truncate">{user.name}</h4>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 md:gap-3">
                                    <span className={`w-fit text-[7px] md:text-[9px] font-black px-2 py-0.5 md:py-1 rounded-full border ${user.role === UserRole.ADMIN ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-blue-900/30 text-blue-400 border-blue-500/30'} uppercase tracking-widest`}>{user.role}</span>
                                    <span className="text-[9px] md:text-[11px] text-slate-600 font-mono truncate">{user.email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1 md:gap-2 flex-shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEditUser(user)} className="p-2 md:p-3 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all shadow-md"><Pencil size={18}/></button>
                            <button onClick={() => handleDeleteUser(user)} className="p-2 md:p-3 text-slate-400 hover:text-red-400 bg-slate-800 rounded-xl transition-all shadow-md"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {showUserModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-[2rem] md:rounded-[3rem] shadow-2xl animate-scale-in flex flex-col max-h-[95vh] overflow-hidden">
                  <div className="p-6 md:p-10 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                      <div className="flex items-center gap-3 md:gap-6">
                          <div className="w-10 h-10 md:w-16 md:h-16 bg-neon-blue/10 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center text-neon-blue border border-neon-blue/30 shadow-inner"><UserIcon size={24} className="md:w-8 md:h-8"/></div>
                          <div>
                              <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1">{isEditingUser ? 'Editar Perfil' : 'Novo Acesso'}</h3>
                              <p className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest">Níveis de segurança e cargos</p>
                          </div>
                      </div>
                      <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white p-2 transition-colors"><X size={28} className="md:w-[32px] md:h-[32px]"/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 md:space-y-10 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                          <div className="space-y-1.5">
                              <label className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase ml-1">Nome Completo</label>
                              <input className="w-full bg-slate-900 border border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-xs md:text-sm text-white font-bold outline-none focus:border-neon-blue transition shadow-inner" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="Ex: João Silva"/>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase ml-1">E-mail Profissional</label>
                              <input className="w-full bg-slate-900 border border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-xs md:text-sm text-white font-bold outline-none focus:border-neon-blue transition shadow-inner" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="joao@tonapista.com.br"/>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase ml-1">Cargo Hierárquico</label>
                              <select className="w-full bg-slate-900 border border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-xs md:text-sm text-white font-black outline-none focus:border-neon-blue transition shadow-inner appearance-none" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}>
                                  <option value={UserRole.GESTOR}>GESTOR (RECEPÇÃO)</option>
                                  <option value={UserRole.ADMIN}>ADMINISTRADOR (MASTER)</option>
                                  <option value={UserRole.COMUM}>COMUM (SUPORTE)</option>
                              </select>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase ml-1">{isEditingUser ? 'Trocar Senha (opcional)' : 'Senha de Acesso'}</label>
                              <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-xs md:text-sm text-white font-bold outline-none focus:border-neon-blue transition shadow-inner" value={userPassword} onChange={e => setUserPassword(e.target.value)} placeholder={isEditingUser ? "Mudar senha?" : "Min. 6 caracteres"}/>
                          </div>
                      </div>

                      <div className="pt-6 md:pt-10 border-t border-slate-700 space-y-6 md:space-y-8">
                          <h4 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3"><Shield size={18} className="text-neon-orange"/> Chaves de Permissão</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">
                              {PERMISSION_KEYS.map((perm) => (
                                  <label key={perm.key} className={`flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all cursor-pointer group shadow-lg ${userForm[perm.key as keyof User] ? 'bg-neon-blue/10 border-neon-blue/50 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em]">{perm.label}</span>
                                      <input type="checkbox" className="w-5 h-5 md:w-6 md:h-6 accent-neon-blue" checked={!!userForm[perm.key as keyof User]} onChange={e => setUserForm({...userForm, [perm.key]: e.target.checked})}/>
                                  </label>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 md:p-10 bg-slate-900 border-t border-slate-700 flex flex-col sm:flex-row gap-3 md:gap-6">
                      <button onClick={() => setShowUserModal(false)} className="order-2 sm:order-1 flex-1 py-4 md:py-6 bg-slate-800 text-slate-400 rounded-xl md:rounded-[1.5rem] font-black uppercase text-[10px] md:text-xs tracking-[0.2em] hover:bg-slate-700 transition">Cancelar</button>
                      <button onClick={handleSaveUser} disabled={loadingSection === 'USER_MODAL'} className="order-1 sm:order-2 flex-[2] py-4 md:py-6 bg-neon-blue hover:bg-blue-600 text-white rounded-xl md:rounded-[1.5rem] font-black uppercase text-[10px] md:text-xs tracking-[0.3em] shadow-xl shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                          {loadingSection === 'USER_MODAL' ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                          Salvar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
