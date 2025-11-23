
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { AppSettings, UserRole, User } from '../types';
import { Save, CalendarCheck, UserPlus, Clock, LogOut, X, Trash2, CreditCard, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.GESTOR
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const s = await db.settings.get();
      const u = await db.users.getAll();
      setSettings(s);
      setUsers(u);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    if (settings) {
      await db.settings.save(settings);
      alert('Configurações salvas com sucesso!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tonapista_auth');
    navigate('/login', { replace: true });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newUser.name || !newUser.email || !newUser.password) return;

    const user: User = {
      id: uuidv4(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      passwordHash: newUser.password 
    };

    await db.users.create(user);
    setUsers(await db.users.getAll());
    setShowUserModal(false);
    setNewUser({ name: '', email: '', password: '', role: UserRole.GESTOR });
    alert('Usuário adicionado com sucesso!');
  };

  const handleDeleteUser = async (id: string) => {
    if(window.confirm('Tem certeza que deseja remover este usuário?')) {
      await db.users.delete(id);
      setUsers(await db.users.getAll());
    }
  };

  if (isLoading || !settings) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue"/></div>;

  const hoursOptions = Array.from({ length: 25 }, (_, i) => i); // 0 to 24

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 md:pb-0 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Configurações</h1>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition"
        >
          <LogOut size={18} />
          <span>Sair do Sistema</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-medium transition whitespace-nowrap ${activeTab === 'general' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:text-white'}`}
        >
          Geral e Pistas
        </button>
        <button 
           onClick={() => setActiveTab('integrations')}
           className={`px-6 py-3 font-medium transition whitespace-nowrap ${activeTab === 'integrations' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:text-white'}`}
        >
          Integrações
        </button>
        <button 
           onClick={() => setActiveTab('team')}
           className={`px-6 py-3 font-medium transition whitespace-nowrap ${activeTab === 'team' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:text-white'}`}
        >
          Equipe
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
             <h3 className="text-xl font-bold text-white mb-4">Dados da Casa</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-slate-400 mb-1 text-sm">Nome do Estabelecimento</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                    value={settings.establishmentName}
                    onChange={e => setSettings({...settings, establishmentName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 text-sm">Telefone</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                    value={settings.phone}
                    onChange={e => setSettings({...settings, phone: e.target.value})}
                  />
                </div>
             </div>
             
             <div className="pt-6 border-t border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">Configuração de Pistas</h3>
                <div className="flex items-center gap-4">
                   <label className="text-slate-300">Quantidade de Pistas Ativas:</label>
                   <input 
                    type="number" 
                    min="1" max="20"
                    className="w-20 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-center font-bold"
                    value={settings.activeLanes}
                    onChange={e => setSettings({...settings, activeLanes: parseInt(e.target.value)})}
                  />
                </div>
             </div>

             <div className="pt-6 border-t border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="text-neon-orange" size={20}/>
                  <h3 className="text-xl font-bold text-white">Horários de Funcionamento</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                     <p className="text-neon-blue font-bold mb-3">Terça a Sexta</p>
                     <div className="flex items-center gap-4">
                        <div>
                           <label className="block text-xs text-slate-500 mb-1">Abertura</label>
                           <select 
                              className="bg-slate-800 border border-slate-600 rounded p-2 text-white"
                              value={settings.weekDayStart}
                              onChange={e => setSettings({...settings, weekDayStart: parseInt(e.target.value)})}
                           >
                              {hoursOptions.map(h => <option key={h} value={h}>{h}:00</option>)}
                           </select>
                        </div>
                        <span className="text-slate-400 mt-4">até</span>
                        <div>
                           <label className="block text-xs text-slate-500 mb-1">Fechamento</label>
                           <select 
                              className="bg-slate-800 border border-slate-600 rounded p-2 text-white"
                              value={settings.weekDayEnd}
                              onChange={e => setSettings({...settings, weekDayEnd: parseInt(e.target.value)})}
                           >
                              <option value={0}>00:00 (Meia noite)</option>
                              {hoursOptions.map(h => h !== 0 && <option key={h} value={h}>{h}:00</option>)}
                           </select>
                        </div>
                     </div>
                  </div>

                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                     <p className="text-neon-orange font-bold mb-3">Sábado, Domingo e Feriados</p>
                     <div className="flex items-center gap-4">
                        <div>
                           <label className="block text-xs text-slate-500 mb-1">Abertura</label>
                           <select 
                              className="bg-slate-800 border border-slate-600 rounded p-2 text-white"
                              value={settings.weekendStart}
                              onChange={e => setSettings({...settings, weekendStart: parseInt(e.target.value)})}
                           >
                              {hoursOptions.map(h => <option key={h} value={h}>{h}:00</option>)}
                           </select>
                        </div>
                        <span className="text-slate-400 mt-4">até</span>
                        <div>
                           <label className="block text-xs text-slate-500 mb-1">Fechamento</label>
                           <select 
                              className="bg-slate-800 border border-slate-600 rounded p-2 text-white"
                              value={settings.weekendEnd}
                              onChange={e => setSettings({...settings, weekendEnd: parseInt(e.target.value)})}
                           >
                              <option value={0}>00:00 (Meia noite)</option>
                              {hoursOptions.map(h => h !== 0 && <option key={h} value={h}>{h}:00</option>)}
                           </select>
                        </div>
                     </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* INTEGRATIONS TAB */}
        {activeTab === 'integrations' && (
          <div className="space-y-8 animate-fade-in">
             
             {/* Google Calendar Section */}
             <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-slate-700 rounded-lg text-white">
                    <CalendarCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Google Calendar</h3>
                    <p className="text-slate-400 text-sm">Sincronize reservas automaticamente.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                  <input 
                    type="checkbox" 
                    id="gcal-active"
                    className="w-5 h-5 accent-neon-blue rounded cursor-pointer"
                    checked={settings.googleCalendarEnabled}
                    onChange={e => setSettings({...settings, googleCalendarEnabled: e.target.checked})}
                  />
                  <label htmlFor="gcal-active" className="text-white font-medium cursor-pointer">Ativar Integração</label>
                </div>

                {settings.googleCalendarEnabled && (
                  <div className="space-y-4 pl-8 border-l-2 border-slate-700">
                    <div>
                        <label className="block text-slate-400 mb-1 text-sm">ID da Agenda Principal (Calendar ID)</label>
                        <input 
                          type="text" 
                          placeholder="ex: meu_boliche@group.calendar.google.com"
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                          value={settings.calendarId}
                          onChange={e => setSettings({...settings, calendarId: e.target.value})}
                        />
                        <p className="text-xs text-slate-500 mt-1">Encontrado nas configurações da sua agenda Google &gt; Integrar agenda.</p>
                    </div>
                  </div>
                )}
             </div>

             {/* Mercado Pago Section */}
             <div className="space-y-4 pt-6 border-t border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-slate-700 rounded-lg text-white">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Mercado Pago</h3>
                    <p className="text-slate-400 text-sm">Receba pagamentos online no momento da reserva.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                  <input 
                    type="checkbox" 
                    id="mp-active"
                    className="w-5 h-5 accent-neon-green rounded cursor-pointer"
                    checked={settings.onlinePaymentEnabled}
                    onChange={e => setSettings({...settings, onlinePaymentEnabled: e.target.checked})}
                  />
                  <label htmlFor="mp-active" className="text-white font-medium cursor-pointer">Ativar Pagamentos Online</label>
                </div>

                {settings.onlinePaymentEnabled && (
                   <div className="space-y-4 pl-8 border-l-2 border-slate-700">
                      <div>
                        <label className="block text-slate-400 mb-1 text-sm">Public Key</label>
                        <input 
                          type="text" 
                          placeholder="APP_USR-..."
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                          value={settings.mercadopagoPublicKey || ''}
                          onChange={e => setSettings({...settings, mercadopagoPublicKey: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1 text-sm">Access Token</label>
                        <input 
                          type="password" 
                          placeholder="APP_USR-..."
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                          value={settings.mercadopagoAccessToken || ''}
                          onChange={e => setSettings({...settings, mercadopagoAccessToken: e.target.value})}
                        />
                      </div>
                   </div>
                )}
             </div>

          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-white">Usuários do Sistema</h3>
               <button 
                onClick={() => setShowUserModal(true)}
                className="text-sm bg-neon-blue hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 font-bold"
               >
                 <UserPlus size={16} /> Adicionar
               </button>
            </div>
            
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Função</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                   {users.map(user => (
                     <tr key={user.id} className="hover:bg-slate-700/30">
                       <td className="p-3 text-white font-medium">{user.name}</td>
                       <td className="p-3">{user.email}</td>
                       <td className="p-3">
                         <span className={`px-2 py-1 rounded-full text-xs ${user.role === UserRole.ADMIN ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                           {user.role}
                         </span>
                       </td>
                       <td className="p-3">
                         <button 
                           onClick={() => handleDeleteUser(user.id)}
                           className="text-slate-500 hover:text-red-400 transition"
                           title="Remover"
                          >
                           <Trash2 size={16} />
                         </button>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={handleSaveSettings}
          className="bg-neon-orange hover:bg-orange-500 text-white font-bold px-8 py-3 rounded-lg shadow-lg flex items-center gap-2 transition transform hover:scale-105"
        >
          <Save size={20} /> Salvar Alterações
        </button>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in">
             <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Adicionar Usuário</h3>
                <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
             </div>
             <form onSubmit={handleAddUser} className="p-6 space-y-4">
               <div>
                 <label className="block text-slate-400 mb-1 text-sm">Nome Completo</label>
                 <input 
                   required
                   type="text" 
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none"
                   value={newUser.name}
                   onChange={e => setNewUser({...newUser, name: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-slate-400 mb-1 text-sm">E-mail de Login</label>
                 <input 
                   required
                   type="email" 
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none"
                   value={newUser.email}
                   onChange={e => setNewUser({...newUser, email: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-slate-400 mb-1 text-sm">Senha</label>
                 <input 
                   required
                   type="password" 
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none"
                   value={newUser.password}
                   onChange={e => setNewUser({...newUser, password: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-slate-400 mb-1 text-sm">Função (Role)</label>
                 <select 
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none"
                   value={newUser.role}
                   onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                 >
                   <option value={UserRole.GESTOR}>Gestor (Operacional)</option>
                   <option value={UserRole.ADMIN}>Administrador (Acesso Total)</option>
                 </select>
               </div>
               <div className="pt-4">
                 <button type="submit" className="w-full bg-neon-blue hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition">
                   Salvar Usuário
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
