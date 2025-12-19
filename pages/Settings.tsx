
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/mockBackend';
import { AppSettings, UserRole, User, DayConfig } from '../types';
import { PERMISSION_KEYS } from '../constants';
import { Save, UserPlus, Clock, LogOut, X, Trash2, CreditCard, Loader2, DollarSign, MapPin, Upload, Camera, CheckCircle, AlertTriangle, Key, Link2, ShieldCheck, ChevronDown, Lock, Pencil, Shield, CalendarOff, Plus, Eye, EyeOff } from 'lucide-react';
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

  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
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

  useEffect(() => {
      if (userForm.role === UserRole.ADMIN || userForm.role === UserRole.GESTOR) {
          setUserForm(prev => ({
              ...prev,
              perm_view_agenda: true, perm_view_financial: true, perm_view_crm: true,
              perm_create_reservation: true, perm_edit_reservation: true, perm_delete_reservation: true,
              perm_edit_client: true, perm_receive_payment: true, perm_create_reservation_no_contact: true
          }));
      }
  }, [userForm.role]);

  const showSuccess = () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); };
  const showError = (msg: string) => { setSaveError(msg); setTimeout(() => setSaveError(''), 4000); };

  const handleSaveGeneral = async () => {
    if (settings) {
      setIsSavingGeneral(true);
      setSaveError('');
      try {
        await db.settings.saveGeneral(settings);
        showSuccess();
      } catch (error: any) { showError(error.message || "Erro ao salvar dados."); }
      finally { setIsSavingGeneral(false); }
    }
  };

  const handleSaveHours = async () => {
    if (settings) {
      setIsSavingHours(true);
      setSaveError('');
      try {
        await db.settings.saveHours(settings);
        showSuccess();
      } catch (error: any) { showError(error.message || "Erro ao salvar horários."); }
      finally { setIsSavingHours(false); }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settings) {
      if (file.size > 1024 * 1024) { alert("Imagem muito grande! Máximo 1MB."); return; }
      const reader = new FileReader();
      reader.onloadend = () => { setSettings({ ...settings, logoUrl: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('tonapista_auth');
    await db.users.logout();
    navigate('/login', { replace: true });
  };

  const openAddUser = () => {
      setUserForm({
        id: '', name: '', email: '', passwordHash: '', role: UserRole.GESTOR,
        perm_view_agenda: false, perm_view_financial: false, perm_view_crm: false,
        perm_create_reservation: false, perm_edit_reservation: false, perm_delete_reservation: false,
        perm_edit_client: false, perm_receive_payment: false, perm_create_reservation_no_contact: false
      });
      setIsEditingUser(false);
      setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
      setUserForm({ ...user, passwordHash: '' });
      setIsEditingUser(true);
      setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!userForm.name || !userForm.email) return;
    if(!isEditingUser && !userForm.passwordHash) { alert("Senha é obrigatória."); return; }

    setIsSavingUser(true);
    const payload: User = {
      id: isEditingUser ? (userForm.id || '') : '',
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
      perm_receive_payment: !!userForm.perm_receive_payment,
      perm_create_reservation_no_contact: !!userForm.perm_create_reservation_no_contact
    };

    try {
        if (isEditingUser) await db.users.update(payload);
        else await db.users.create(payload);
        
        setUsers(await db.users.getAll());
        setShowUserModal(false);
        showSuccess();
    } catch (e: any) { showError(e.message || 'Erro ao processar usuário.'); }
    finally { setIsSavingUser(false); }
  };

  const confirmDeleteUser = async () => {
      if (!userToDelete) return;
      setIsDeleting(true);
      try {
          await db.users.delete(userToDelete.id);
          setUsers(await db.users.getAll());
          setUserToDelete(null);
          showSuccess();
      } catch (e: any) { showError(e.message || 'Erro ao excluir.'); }
      finally { setIsDeleting(false); }
  };

  const togglePermission = (key: keyof User) => {
      if (userForm.role === UserRole.ADMIN) return; 
      setUserForm(prev => ({ ...prev, [key]: !prev[key] }));
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
      
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down w-[90%] md:w-auto">
          <div className="bg-green-500/20 border border-green-500 text-green-100 px-4 py-3 md:px-6 md:py-4 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <CheckCircle size={20} className="text-green-500" />
            <div><h4 className="font-bold">Sucesso!</h4><p className="text-sm">Alterações aplicadas.</p></div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down w-[90%] md:w-auto">
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 md:px-6 md:py-4 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <AlertTriangle size={20} className="text-red-500" />
            <div><h4 className="font-bold">Atenção</h4><p className="text-sm">{saveError}</p></div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Configurações</h1>
        <button onClick={handleLogout} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition"><LogOut size={18} /><span>Sair do Sistema</span></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
        <button onClick={() => setActiveTab('general')} className={`px-4 py-3 rounded-md font-medium transition text-sm ${activeTab === 'general' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Geral</button>
        <button onClick={() => setActiveTab('integrations')} className={`px-4 py-3 rounded-md font-medium transition text-sm ${activeTab === 'integrations' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Pagamentos</button>
        <button onClick={() => setActiveTab('team')} className={`px-4 py-3 rounded-md font-medium transition text-sm ${activeTab === 'team' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Equipe</button>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 md:p-6 border border-slate-700 shadow-lg">
        {activeTab === 'general' && (
             <div className="text-center py-6 md:py-10 animate-fade-in text-left space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                        <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full bg-slate-900 border-2 border-dashed border-slate-600 hover:border-neon-blue cursor-pointer flex items-center justify-center overflow-hidden group transition">
                            {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain p-2"/> : <Upload className="text-slate-500 group-hover:text-neon-blue"/>}
                        </div>
                        <p className="text-xs text-slate-500">Logo do Boliche</p>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2"><MapPin size={20} className="text-neon-blue"/> Dados do Estabelecimento</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.establishmentName} onChange={e => setSettings({...settings, establishmentName: e.target.value})} placeholder="Nome Fantasia"/>
                            <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} placeholder="Endereço"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} placeholder="Telefone"/>
                            <input className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue outline-none" value={settings.whatsappLink} onChange={e => setSettings({...settings, whatsappLink: e.target.value})} placeholder="Link WhatsApp"/>
                        </div>
                    </div>
                 </div>
                 <div className="h-px bg-slate-700"></div>
                 <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><DollarSign size={20} className="text-neon-green"/> Preços e Pistas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs text-slate-400 mb-1">Pistas Ativas</label><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-bold" value={settings.activeLanes} onChange={e => setSettings({...settings, activeLanes: parseInt(e.target.value)})} /></div>
                        <div><label className="block text-xs text-slate-400 mb-1">Preço Seg-Qui (Hora)</label><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" value={settings.weekdayPrice} onChange={e => setSettings({...settings, weekdayPrice: parseFloat(e.target.value)})} /></div>
                        <div><label className="block text-xs text-slate-400 mb-1">Preço Sex-Dom (Hora)</label><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" value={settings.weekendPrice} onChange={e => setSettings({...settings, weekendPrice: parseFloat(e.target.value)})} /></div>
                    </div>
                 </div>
                 <div className="flex justify-end pt-2"><button onClick={handleSaveGeneral} disabled={isSavingGeneral} className="bg-neon-orange hover:bg-orange-500 text-white px-8 py-3 rounded-lg font-bold flex gap-2 transition shadow-lg">{isSavingGeneral ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Salvar Dados Gerais</button></div>
                 <div className="h-px bg-slate-700"></div>
                 <div className="space-y-4">
                     <h3 className="text-xl font-bold text-white flex items-center gap-2"><Clock size={20} className="text-neon-blue"/> Horários de Funcionamento</h3>
                     <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-2">
                        {settings.businessHours.map((h, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-slate-700/50 last:border-0">
                                <span className="text-sm font-bold text-slate-300 w-24">{daysOfWeek[i]}</span>
                                <input type="checkbox" checked={h.isOpen} onChange={e => updateDayConfig(i, 'isOpen', e.target.checked)} className="w-5 h-5 accent-neon-blue" />
                                {h.isOpen && (
                                    <div className="flex gap-2">
                                        <select value={h.start} onChange={e => updateDayConfig(i, 'start', parseInt(e.target.value))} className="bg-slate-800 text-white rounded p-1 text-sm">{hoursOptions.map(o => <option key={o} value={o}>{o}:00</option>)}</select>
                                        <select value={h.end} onChange={e => updateDayConfig(i, 'end', parseInt(e.target.value))} className="bg-slate-800 text-white rounded p-1 text-sm">{hoursOptions.map(o => <option key={o} value={o}>{o}:00</option>)}</select>
                                    </div>
                                )}
                            </div>
                        ))}
                     </div>
                     <div className="flex justify-end"><button onClick={handleSaveHours} disabled={isSavingHours} className="bg-neon-blue hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition">{isSavingHours ? <Loader2 className="animate-spin"/> : 'Atualizar Horários'}</button></div>
                 </div>
             </div>
        )}

        {activeTab === 'integrations' && (
             <div className="space-y-6 animate-fade-in py-6">
                 <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                     <input type="checkbox" checked={settings.onlinePaymentEnabled} onChange={e => setSettings({...settings, onlinePaymentEnabled: e.target.checked})} className="w-5 h-5 accent-neon-green"/>
                     <span className="text-white font-bold flex items-center gap-2"><CreditCard size={20} className="text-neon-green"/> Ativar Pagamentos Online</span>
                 </div>
                 {settings.onlinePaymentEnabled && (
                     <div className="space-y-6 p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                         <div className="grid grid-cols-1 gap-6">
                            <button onClick={() => setShowSecrets(!showSecrets)} className="text-xs text-neon-blue flex items-center gap-2 self-end">{showSecrets ? <EyeOff size={14}/> : <Eye size={14}/>} Mostrar Chaves MP</button>
                            <input className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white font-mono text-sm" placeholder="MP Public Key" value={settings.mercadopagoPublicKey} onChange={e => setSettings({...settings, mercadopagoPublicKey: e.target.value})} />
                            {showSecrets && <input className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white font-mono text-sm" type="password" placeholder="MP Access Token" value={settings.mercadopagoAccessToken} onChange={e => setSettings({...settings, mercadopagoAccessToken: e.target.value})} />}
                         </div>
                         <button onClick={handleSaveGeneral} className="bg-neon-green hover:bg-green-500 text-black px-6 py-3 rounded-lg font-bold shadow-lg transition">Salvar Integração</button>
                     </div>
                 )}
             </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-white">Equipe de Atendimento</h3>
               <button onClick={openAddUser} className="text-sm bg-neon-blue hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 font-bold"><UserPlus size={16} /> Adicionar Membro</button>
            </div>
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Nome</th><th className="p-3">Função</th><th className="p-3 text-right">Ações</th></tr></thead>
                <tbody className="divide-y divide-slate-700">
                   {users.map(user => (
                     <tr key={user.id} className="hover:bg-slate-700/30">
                       <td className="p-3 font-medium text-white">{user.name}<br/><span className="text-[10px] text-slate-500">{user.email}</span></td>
                       <td className="p-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.role === UserRole.ADMIN ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>{user.role}</span></td>
                       <td className="p-3 text-right flex justify-end gap-2"><button onClick={() => openEditUser(user)} className="p-2 bg-slate-700 rounded"><Pencil size={14} /></button><button onClick={() => setUserToDelete(user)} className="p-2 bg-red-900/20 text-red-400 rounded"><Trash2 size={14} /></button></td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in my-auto">
             <div className="p-6 border-b border-slate-700 flex justify-between items-center"><h3 className="text-xl font-bold text-white">{isEditingUser ? 'Editar Funcionário' : 'Novo Funcionário'}</h3><button onClick={() => setShowUserModal(false)} className="text-slate-400"><X/></button></div>
             <form onSubmit={handleSaveUser} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                    <input required className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" placeholder="Nome Completo" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                    <input required type="email" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" placeholder="E-mail de Login" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
               </div>
               <input required={!isEditingUser} type="password" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" placeholder={isEditingUser ? "Nova Senha (deixe em branco para manter)" : "Senha de Acesso"} value={userForm.passwordHash} onChange={e => setUserForm({...userForm, passwordHash: e.target.value})} />
               <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setUserForm({...userForm, role: UserRole.ADMIN})} className={`p-3 rounded-lg border font-bold text-xs ${userForm.role === UserRole.ADMIN ? 'bg-purple-900/20 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>ADMIN MASTER</button>
                    <button type="button" onClick={() => setUserForm({...userForm, role: UserRole.GESTOR})} className={`p-3 rounded-lg border font-bold text-xs ${userForm.role === UserRole.GESTOR ? 'bg-blue-900/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>USUÁRIO COMUM</button>
               </div>
               <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-2">
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Permissões Específicas</p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {PERMISSION_KEYS.map(perm => (
                        <label key={perm.key} className="flex items-center gap-2 p-1 text-[10px] text-slate-300">
                          <input type="checkbox" checked={!!(userForm as any)[perm.key]} onChange={() => togglePermission(perm.key)} className="accent-neon-blue" />
                          {perm.label}
                        </label>
                      ))}
                  </div>
               </div>
               <button type="submit" disabled={isSavingUser} className="w-full bg-neon-blue hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                 {isSavingUser ? <Loader2 className="animate-spin"/> : <Save size={18}/>}
                 {isEditingUser ? 'Salvar Alterações' : 'Criar Conta Agora'}
               </button>
             </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-xl p-6 text-center">
                <AlertTriangle size={48} className="text-red-500 mx-auto mb-4"/>
                <h3 className="text-xl font-bold text-white mb-2">Excluir {userToDelete.name}?</h3>
                <p className="text-slate-400 text-sm mb-6">Esta ação removerá o login e o perfil permanentemente.</p>
                <div className="flex gap-3"><button onClick={() => setUserToDelete(null)} className="flex-1 py-2 bg-slate-700 text-white rounded-lg">Cancelar</button><button onClick={confirmDeleteUser} disabled={isDeleting} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">{isDeleting ? <Loader2 className="animate-spin mx-auto"/> : 'Excluir'}</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
