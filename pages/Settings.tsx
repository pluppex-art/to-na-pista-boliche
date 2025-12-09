


import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/mockBackend';
import { AppSettings, UserRole, User, DayConfig } from '../types';
import { PERMISSION_KEYS } from '../constants';
import { Save, UserPlus, Clock, LogOut, X, Trash2, CreditCard, Loader2, DollarSign, MapPin, Upload, Camera, CheckCircle, AlertTriangle, Key, Link2, ShieldCheck, ChevronDown, Lock, Pencil, Shield, CalendarOff, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Blocked Date Input State
  const [newBlockedDate, setNewBlockedDate] = useState('');

  // Current User from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  
  // Deletion State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado do formulário de usuário com propriedades explícitas
  const [userForm, setUserForm] = useState<Partial<User>>({
    id: '',
    name: '',
    email: '',
    passwordHash: '',
    role: UserRole.GESTOR,
    // Permissões padrão
    perm_view_agenda: false,
    perm_view_financial: false,
    perm_view_crm: false,
    perm_create_reservation: false,
    perm_edit_reservation: false,
    perm_delete_reservation: false,
    perm_edit_client: false,
    perm_receive_payment: false
  });

  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const hoursOptions = Array.from({ length: 25 }, (_, i) => i);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const stored = localStorage.getItem('tonapista_auth');
      if (stored) setCurrentUser(JSON.parse(stored));

      setUsers([]); // Clear local state to force refresh
      const s = await db.settings.get();
      const u = await db.users.getAll();
      setSettings(s);
      setUsers(u);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Update permissions logic when role changes in form
  useEffect(() => {
      // Se for Admin, garante todas as permissões como true na UI (apenas visual, pois backend/app ignora)
      if (userForm.role === UserRole.ADMIN) {
          setUserForm(prev => ({
              ...prev,
              perm_view_agenda: true,
              perm_view_financial: true,
              perm_view_crm: true,
              perm_create_reservation: true,
              perm_edit_reservation: true,
              perm_delete_reservation: true,
              perm_edit_client: true,
              perm_receive_payment: true
          }));
      }
  }, [userForm.role]);

  const showSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const showError = (msg: string) => {
    setSaveError(msg);
  };

  const handleSaveGeneral = async () => {
    if (settings) {
      setIsSavingGeneral(true);
      setSaveSuccess(false);
      setSaveError('');
      try {
        await db.settings.saveGeneral(settings);
        showSuccess();
      } catch (error: any) {
        console.error("Erro capturado no frontend:", error);
        showError(error.message || "Erro desconhecido ao salvar dados gerais.");
      } finally {
        setIsSavingGeneral(false);
      }
    }
  };

  const handleSaveHours = async () => {
    if (settings) {
      setIsSavingHours(true);
      setSaveSuccess(false);
      setSaveError('');
      try {
        await db.settings.saveHours(settings);
        showSuccess();
      } catch (error: any) {
        console.error("Erro capturado no frontend:", error);
        showError(error.message || "Erro desconhecido ao salvar horários.");
      } finally {
        setIsSavingHours(false);
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settings) {
      if (file.size > 1024 * 1024) {
          alert("A imagem é muito grande! Por favor, use uma imagem menor que 1MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleLogout = () => {
    localStorage.removeItem('tonapista_auth');
    navigate('/login', { replace: true });
  };

  const addBlockedDate = () => {
      if (!settings || !newBlockedDate) return;
      if (settings.blockedDates?.includes(newBlockedDate)) {
          alert("Data já bloqueada.");
          return;
      }
      const updated = [...(settings.blockedDates || []), newBlockedDate];
      setSettings({ ...settings, blockedDates: updated });
      setNewBlockedDate('');
  };

  const removeBlockedDate = (date: string) => {
      if (!settings) return;
      const updated = (settings.blockedDates || []).filter(d => d !== date);
      setSettings({ ...settings, blockedDates: updated });
  };

  const openAddUser = () => {
      setUserForm({
        id: '',
        name: '',
        email: '',
        passwordHash: '',
        role: UserRole.GESTOR,
        perm_view_agenda: false,
        perm_view_financial: false,
        perm_view_crm: false,
        perm_create_reservation: false,
        perm_edit_reservation: false,
        perm_delete_reservation: false,
        perm_edit_client: false,
        perm_receive_payment: false
      });
      setIsEditingUser(false);
      setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
      setUserForm({
          ...user,
          passwordHash: '' // Reset senha visual
      });
      setIsEditingUser(true);
      setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!userForm.name || !userForm.email) return;
    if(!isEditingUser && !userForm.passwordHash) {
        alert("Senha é obrigatória para novos usuários.");
        return;
    }

    // Monta objeto completo garantindo os booleanos
    const payload: User = {
      id: isEditingUser ? (userForm.id || '') : uuidv4(),
      name: userForm.name,
      email: userForm.email,
      role: userForm.role || UserRole.GESTOR,
      passwordHash: userForm.passwordHash || '',
      perm_view_agenda: !!userForm.perm_view_agenda,
      perm_view_financial: !!userForm.perm_view_financial,
      perm_view_crm: !!userForm.perm_view_crm,
      perm_create_reservation: !!userForm.perm_create_reservation,
      perm_edit_reservation: !!userForm.perm_edit_reservation,
      perm_delete_reservation: !!userForm.perm_delete_reservation,
      perm_edit_client: !!userForm.perm_edit_client,
      perm_receive_payment: !!userForm.perm_receive_payment
    };

    try {
        if (isEditingUser) {
            await db.users.update(payload);
        } else {
            await db.users.create(payload);
        }
        
        // REFRESH LIST FROM DB
        setUsers(await db.users.getAll());
        setShowUserModal(false);
        alert(isEditingUser ? 'Usuário atualizado!' : 'Usuário criado!');
    } catch (e: any) {
        console.error(e);
        alert(`Erro ao salvar usuário: ${e.message || 'Erro desconhecido'}`);
    }
  };

  const handleRequestDelete = (user: User) => {
    if (user.id === currentUser?.id) {
        alert("Você não pode excluir seu próprio usuário.");
        return;
    }
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
      if (!userToDelete) return;
      setIsDeleting(true);
      try {
          await db.users.delete(userToDelete.id);
          const updatedList = await db.users.getAll();
          setUsers(updatedList);
          setUserToDelete(null);
      } catch (e: any) {
          console.error(e);
          alert(`Erro ao excluir: ${e.message || 'Erro de conexão'}`);
      } finally {
          setIsDeleting(false);
      }
  };

  const togglePermission = (key: keyof User) => {
      if (userForm.role === UserRole.ADMIN) return; 
      
      setUserForm(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
  };

  const updateDayConfig = (index: number, field: keyof DayConfig, value: any) => {
      if(!settings) return;
      const newHours = [...settings.businessHours];
      newHours[index] = { ...newHours[index], [field]: value };
      setSettings({ ...settings, businessHours: newHours });
  };

  if (isLoading || !settings) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue"/></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0 relative px-2 md:px-0">
      
      {/* Notifications */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down w-[90%] md:w-auto">
          <div className="bg-green-500/20 border border-green-500 text-green-100 px-4 py-3 md:px-6 md:py-4 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <CheckCircle size={20} className="text-green-500" />
            <div><h4 className="font-bold">Sucesso!</h4><p className="text-sm">Alterações salvas.</p></div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down w-[90%] md:w-auto">
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 md:px-6 md:py-4 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <X size={20} className="text-red-500" />
            <div><h4 className="font-bold">Erro</h4><p className="text-sm">{saveError}</p></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Configurações</h1>
        <button 
          onClick={handleLogout}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition"
        >
          <LogOut size={18} />
          <span>Sair do Sistema</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
        <button onClick={() => setActiveTab('general')} className={`px-4 py-3 rounded-md font-medium transition text-sm ${activeTab === 'general' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Geral</button>
        <button onClick={() => setActiveTab('integrations')} className={`px-4 py-3 rounded-md font-medium transition text-sm ${activeTab === 'integrations' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Pagamentos</button>
        <button onClick={() => setActiveTab('team')} className={`px-4 py-3 rounded-md font-medium transition text-sm ${activeTab === 'team' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Equipe</button>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700 shadow-lg">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
             <div className="text-center py-6 md:py-10">
                 <div className="space-y-8 animate-fade-in text-left">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Logo Upload */}
                        <div className="flex flex-col items-center gap-4">
                            <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                            <div onClick={triggerFileInput} className="w-32 h-32 rounded-full bg-slate-900 border-2 border-dashed border-slate-600 hover:border-neon-blue cursor-pointer flex items-center justify-center overflow-hidden group transition">
                                {settings.logoUrl ? (
                                    <img src={settings.logoUrl} className="w-full h-full object-contain p-2"/>
                                ) : (
                                    <Upload className="text-slate-500 group-hover:text-neon-blue transition"/>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">Clique para alterar logo</p>
                        </div>

                        {/* Basic Info */}
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <MapPin size={20} className="text-neon-blue"/> Dados do Estabelecimento
                            </h3>
                            
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Nome Fantasia</label>
                                    <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.establishmentName} onChange={e => setSettings({...settings, establishmentName: e.target.value})} placeholder="Nome Fantasia"/>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Endereço Completo</label>
                                    <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Telefone</label>
                                    <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} placeholder="Telefone"/>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Link WhatsApp</label>
                                    <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.whatsappLink} onChange={e => setSettings({...settings, whatsappLink: e.target.value})} placeholder="https://wa.me/..."/>
                                </div>
                            </div>
                        </div>
                     </div>

                     <div className="h-px bg-slate-700"></div>

                     {/* Operational Config */}
                     <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <DollarSign size={20} className="text-neon-green"/> Configuração Operacional
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Pistas Ativas (Total)</label>
                                <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-bold" value={settings.activeLanes} onChange={e => setSettings({...settings, activeLanes: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Preço Hora (Seg-Qui)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-500">R$</span>
                                    <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 pl-8 text-white" value={settings.weekdayPrice} onChange={e => setSettings({...settings, weekdayPrice: parseFloat(e.target.value)})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Preço Hora (Sex-Dom)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-500">R$</span>
                                    <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 pl-8 text-white" value={settings.weekendPrice} onChange={e => setSettings({...settings, weekendPrice: parseFloat(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                     </div>
                     
                     <div className="h-px bg-slate-700"></div>

                     {/* Blocked Dates Config */}
                     <div className="space-y-4">
                         <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <CalendarOff size={20} className="text-red-400"/> Bloqueio de Datas Específicas
                         </h3>
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                             <div className="flex gap-2 mb-4">
                                 <input 
                                    type="date" 
                                    className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-white focus:border-red-500 outline-none flex-1" 
                                    value={newBlockedDate} 
                                    onChange={e => setNewBlockedDate(e.target.value)}
                                 />
                                 <button 
                                    onClick={addBlockedDate}
                                    disabled={!newBlockedDate}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     <Plus size={18}/> Bloquear
                                 </button>
                             </div>
                             
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto">
                                 {settings.blockedDates && settings.blockedDates.length > 0 ? (
                                     settings.blockedDates.sort().map(date => (
                                         <div key={date} className="bg-slate-800 border border-slate-700 p-2 rounded flex justify-between items-center text-sm">
                                             <span className="text-slate-300 font-medium">{date.split('-').reverse().join('/')}</span>
                                             <button onClick={() => removeBlockedDate(date)} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button>
                                         </div>
                                     ))
                                 ) : (
                                     <p className="text-slate-500 text-sm italic col-span-full">Nenhuma data específica bloqueada.</p>
                                 )}
                             </div>
                         </div>
                     </div>

                     <div className="flex justify-end pt-2">
                         <button onClick={handleSaveGeneral} className="bg-neon-orange hover:bg-orange-500 text-white px-8 py-3 rounded-lg font-bold flex gap-2 transition shadow-lg">
                             {isSavingGeneral ? <Loader2 className="animate-spin"/> : <Save size={20}/>}
                             {isSavingGeneral ? 'Salvando...' : 'Salvar Configurações'}
                         </button>
                     </div>
                     
                     <div className="h-px bg-slate-700"></div>
                     
                     {/* Hours Config */}
                     <div className="space-y-4">
                         <h3 className="text-xl font-bold text-white flex items-center gap-2"><Clock size={20} className="text-neon-blue"/> Horários de Funcionamento</h3>
                         <div className="bg-slate-900/50 p-2 sm:p-4 rounded-lg border border-slate-700 space-y-2">
                            {settings.businessHours.map((h, i) => (
                                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-slate-700/50 last:border-0">
                                    {/* Header: Day + Toggle */}
                                    <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                                        <span className="text-sm font-bold text-slate-300 w-auto sm:w-24">{daysOfWeek[i]}</span>
                                        
                                        <label className="flex items-center gap-2 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={h.isOpen} 
                                                onChange={e => updateDayConfig(i, 'isOpen', e.target.checked)} 
                                                className="w-4 h-4 accent-neon-blue rounded cursor-pointer"
                                            />
                                            <span className={`text-xs font-bold ${h.isOpen ? 'text-neon-blue' : 'text-slate-500'}`}>
                                                {h.isOpen ? 'Aberto' : 'Fechado'}
                                            </span>
                                        </label>
                                    </div>

                                    {/* Time Selectors */}
                                    {h.isOpen && (
                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end bg-slate-800/50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                                            <span className="text-xs text-slate-500 sm:hidden font-medium">Horário:</span>
                                            <div className="flex items-center gap-2">
                                                <select value={h.start} onChange={e => updateDayConfig(i, 'start', parseInt(e.target.value))} className="bg-slate-800 border-slate-600 text-white rounded p-1.5 text-sm focus:border-neon-blue outline-none min-w-[70px]">
                                                    {hoursOptions.map(o => <option key={o} value={o}>{o === 0 ? '00:00' : `${o}:00`}</option>)}
                                                </select>
                                                <span className="text-slate-500 font-bold">-</span>
                                                <select value={h.end} onChange={e => updateDayConfig(i, 'end', parseInt(e.target.value))} className="bg-slate-800 border-slate-600 text-white rounded p-1.5 text-sm focus:border-neon-blue outline-none min-w-[70px]">
                                                    <option value={0}>00:00</option>
                                                    {hoursOptions.filter(o=>o>0).map(o => <option key={o} value={o}>{o}:00</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                         </div>
                         <div className="flex justify-end"><button onClick={handleSaveHours} className="bg-neon-blue hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition">Atualizar Horários</button></div>
                     </div>
                 </div>
             </div>
        )}

        {/* INTEGRATIONS TAB */}
        {activeTab === 'integrations' && (
             <div className="space-y-6 animate-fade-in py-6">
                 <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                     <input type="checkbox" checked={settings.onlinePaymentEnabled} onChange={e => setSettings({...settings, onlinePaymentEnabled: e.target.checked})} className="w-5 h-5 accent-neon-green cursor-pointer"/>
                     <span className="text-white font-bold flex items-center gap-2"><CreditCard size={20} className="text-neon-green"/> Ativar Pagamentos Online (Mercado Pago)</span>
                 </div>
                 
                 {settings.onlinePaymentEnabled && (
                     <div className="space-y-6 p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 font-bold">Public Key</label>
                                <div className="relative">
                                    <Key size={14} className="absolute left-3 top-3 text-slate-500"/>
                                    <input className="w-full bg-slate-800 border border-slate-600 rounded p-3 pl-9 text-white font-mono text-sm focus:border-neon-green outline-none" placeholder="APP_USR-..." value={settings.mercadopagoPublicKey} onChange={e => setSettings({...settings, mercadopagoPublicKey: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 font-bold">Access Token</label>
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-3 text-slate-500"/>
                                    <input className="w-full bg-slate-800 border border-slate-600 rounded p-3 pl-9 text-white font-mono text-sm focus:border-neon-green outline-none" type="password" placeholder="APP_USR-..." value={settings.mercadopagoAccessToken} onChange={e => setSettings({...settings, mercadopagoAccessToken: e.target.value})} />
                                </div>
                            </div>
                            
                            {/* Campos Restaurados: Client ID & Secret */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 font-bold">Client ID</label>
                                <div className="relative">
                                    <UserPlus size={14} className="absolute left-3 top-3 text-slate-500"/>
                                    <input className="w-full bg-slate-800 border border-slate-600 rounded p-3 pl-9 text-white font-mono text-sm focus:border-neon-green outline-none" value={settings.mercadopagoClientId || ''} onChange={e => setSettings({...settings, mercadopagoClientId: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 font-bold">Client Secret</label>
                                <div className="relative">
                                    <ShieldCheck size={14} className="absolute left-3 top-3 text-slate-500"/>
                                    <input className="w-full bg-slate-800 border border-slate-600 rounded p-3 pl-9 text-white font-mono text-sm focus:border-neon-green outline-none" type="password" value={settings.mercadopagoClientSecret || ''} onChange={e => setSettings({...settings, mercadopagoClientSecret: e.target.value})} />
                                </div>
                            </div>
                         </div>
                         
                         <div className="flex justify-end border-t border-slate-700 pt-4">
                             <button onClick={handleSaveGeneral} className="bg-neon-green hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition">
                                 <Save size={18}/> Salvar Integração
                             </button>
                         </div>
                     </div>
                 )}
                 {!settings.onlinePaymentEnabled && (
                     <div className="p-8 text-center text-slate-500 bg-slate-900/20 rounded border border-slate-800 border-dashed">
                         <CreditCard size={48} className="mx-auto mb-4 opacity-20"/>
                         <p>Ative a integração para configurar suas chaves de API.</p>
                     </div>
                 )}
             </div>
        )}

        {/* TEAM TAB - UPDATED */}
        {activeTab === 'team' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <h3 className="text-xl font-bold text-white">Usuários do Sistema</h3>
               <button 
                onClick={openAddUser}
                className="w-full sm:w-auto text-sm bg-neon-blue hover:bg-blue-600 text-white px-4 py-3 sm:py-2 rounded flex items-center justify-center gap-2 font-bold"
               >
                 <UserPlus size={16} /> Adicionar Usuário
               </button>
            </div>
            
            <div className="border border-slate-700 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300 min-w-[500px]">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Função</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                   {users.map(user => (
                     <tr key={user.id} className="hover:bg-slate-700/30">
                       <td className="p-3 text-white font-medium">{user.name}</td>
                       <td className="p-3">{user.email}</td>
                       <td className="p-3">
                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === UserRole.ADMIN ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                           {user.role === UserRole.ADMIN ? 'Admin Master' : 'Usuário'}
                         </span>
                       </td>
                       <td className="p-3 text-right">
                         <div className="flex justify-end gap-2">
                            <button onClick={() => openEditUser(user)} className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"><Pencil size={14} /></button>
                            <button onClick={() => handleRequestDelete(user)} className="p-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/20 rounded transition"><Trash2 size={14} /></button>
                         </div>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* User Modal (Add/Edit) */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in my-auto">
             <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">{isEditingUser ? 'Editar Usuário' : 'Adicionar Usuário'}</h3>
                <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
             </div>
             
             <form onSubmit={handleSaveUser} className="p-6 space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-slate-400 mb-1 text-sm">Nome Completo</label>
                        <input required type="text" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-slate-400 mb-1 text-sm">E-mail de Login</label>
                        <input required type="email" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                    </div>
               </div>

               <div>
                 <label className="block text-slate-400 mb-1 text-sm">Senha {isEditingUser && <span className="text-xs text-slate-500">(Deixe em branco para manter)</span>}</label>
                 <input required={!isEditingUser} type="password" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" value={userForm.passwordHash} onChange={e => setUserForm({...userForm, passwordHash: e.target.value})} />
               </div>

               <div>
                 <label className="block text-slate-400 mb-1 text-sm">Função do Usuário</label>
                 <div className="grid grid-cols-2 gap-3">
                    <label className={`cursor-pointer border rounded-lg p-3 flex items-center gap-3 transition ${userForm.role === UserRole.ADMIN ? 'bg-purple-900/20 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                        <input type="radio" name="role" className="hidden" checked={userForm.role === UserRole.ADMIN} onChange={() => setUserForm({...userForm, role: UserRole.ADMIN})}/>
                        <Lock size={16} className={userForm.role === UserRole.ADMIN ? 'text-purple-400' : 'text-slate-500'} />
                        <span className="font-bold text-sm">Admin Master</span>
                    </label>

                    <label className={`cursor-pointer border rounded-lg p-3 flex items-center gap-3 transition ${userForm.role === UserRole.GESTOR ? 'bg-blue-900/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                        <input type="radio" name="role" className="hidden" checked={userForm.role === UserRole.GESTOR} onChange={() => setUserForm({...userForm, role: UserRole.GESTOR})}/>
                        <Shield size={16} className={userForm.role === UserRole.GESTOR ? 'text-blue-400' : 'text-slate-500'} />
                        <span className="font-bold text-sm">Usuário</span>
                    </label>
                 </div>
               </div>
               
               {/* Permissions Selector with Boolean Checkboxes */}
               <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-bold text-slate-300">Permissões de Acesso</label>
                      {userForm.role === UserRole.ADMIN && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Total (Bloqueado)</span>}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {PERMISSION_KEYS.map(perm => {
                          const isSelected = !!userForm[perm.key];
                          const isAdmin = userForm.role === UserRole.ADMIN;
                          
                          return (
                              <label key={perm.key} className={`flex items-center gap-2 p-2 rounded border text-xs select-none transition ${isAdmin ? 'opacity-50 cursor-not-allowed bg-slate-800 border-slate-700' : 'cursor-pointer hover:bg-slate-800 border-slate-700'}`}>
                                  <input 
                                    type="checkbox" 
                                    disabled={isAdmin}
                                    checked={isSelected}
                                    onChange={() => togglePermission(perm.key)}
                                    className={`rounded w-4 h-4 ${isAdmin ? 'accent-purple-500' : 'accent-neon-blue'}`}
                                  />
                                  <span className={isSelected ? 'text-white font-medium' : 'text-slate-400'}>
                                      {perm.label}
                                  </span>
                              </label>
                          );
                      })}
                  </div>
               </div>

               <div className="pt-4">
                 <button type="submit" className="w-full bg-neon-blue hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition shadow-lg">
                   {isEditingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Confirmation Deletion Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-xl shadow-2xl animate-scale-in p-6">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={32} className="text-red-500"/>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Excluir Usuário?</h3>
                    <p className="text-slate-400 text-sm">
                        Tem certeza que deseja remover <strong>{userToDelete.name}</strong>? Esta ação não pode ser desfeita.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setUserToDelete(null)}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDeleteUser}
                        disabled={isDeleting}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition font-bold flex items-center justify-center gap-2"
                    >
                        {isDeleting ? <Loader2 className="animate-spin" size={18}/> : 'Sim, Excluir'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;