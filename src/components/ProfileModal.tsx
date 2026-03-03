import { useRef, useState } from 'react';
import { IonButton } from '@ionic/react';
import { X, Camera, Save, Trash2, User, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { useHistory } from 'react-router-dom';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const history = useHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasAvatar = !!avatarUrl;
  const userName = user?.email?.split('@')[0] || '';

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    history.push('/admin/login');
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    if (avatarUrl) {
      URL.revokeObjectURL(avatarUrl);
    }
    setAvatarUrl(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div
                className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-green-400 to-green-600 p-1 shadow-xl cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-full h-full rounded-[36px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  {hasAvatar ? (
                    <img src={avatarUrl!} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                      {userName ? (
                        <span className="text-3xl font-bold text-green-500">{getInitials(userName)}</span>
                      ) : (
                        <User size={48} strokeWidth={1.5} />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <IonButton
                fill="clear"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 text-green-500 m-0 w-10 h-10"
                style={{
                  '--border-radius': '16px',
                  '--padding-start': '0',
                  '--padding-end': '0'
                } as any}
              >
                <span slot="icon-only"><Camera size={20} /></span>
              </IonButton>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <p className="text-xs text-gray-500 mt-4 uppercase font-bold tracking-widest">
              {hasAvatar ? 'Toca para cambiar' : 'Toca para agregar foto'}
            </p>
            {hasAvatar && (
              <IonButton
                fill="clear"
                size="small"
                onClick={handleRemoveAvatar}
                className="mt-2 text-red-500 hover:text-red-600 font-medium text-xs normal-case m-0 h-auto min-h-0"
                style={{
                  '--padding-start': '0',
                  '--padding-end': '0',
                  '--ripple-color': '#ef4444'
                } as any}
              >
                <span slot="start" style={{ marginRight: '6px' }}><Trash2 size={14} /></span>
                Eliminar foto
              </IonButton>
            )}
          </div>

          {/* User info */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                Nombre Completo
              </label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/50 text-gray-900 dark:text-white transition-all font-medium"
                value={user?.email || ''}
                readOnly
                placeholder="Tu nombre"
              />
            </div>
          </div>

          {/* Save button */}
          <div className="pt-2">
            <IonButton
              onClick={onClose}
              expand="block"
              className="font-bold"
              style={{
                '--background': '#3eaa76',
                '--background-activated': '#16a34a',
                '--color': 'white',
                '--border-radius': '16px',
                '--padding-top': '16px',
                '--padding-bottom': '16px',
              } as any}
            >
              <div className="flex items-center gap-2">
                <Save size={20} />
                GUARDAR CAMBIOS
              </div>
            </IonButton>
          </div>

          {/* Theme & Logout */}
          <div className="flex gap-3 pt-1">
            <IonButton
              onClick={toggleTheme}
              fill="clear"
              className="flex-1 m-0 h-auto normal-case transition-all active:scale-95 text-sm font-semibold"
              style={{
                '--background': theme === 'light' ? '#f3f4f6' : '#1f2937',
                '--color': theme === 'light' ? '#4b5563' : '#d1d5db',
                '--border-radius': '16px',
                '--padding-top': '12px',
                '--padding-bottom': '12px',
                'minHeight': 'unset'
              } as any}
            >
              <div className="flex items-center justify-center gap-2">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
              </div>
            </IonButton>
            <IonButton
              fill="clear"
              onClick={handleLogout}
              className="flex-1 m-0 h-auto normal-case transition-all active:scale-95 text-sm font-semibold"
              style={{
                '--background': theme === 'light' ? '#fef2f2' : 'rgba(127, 29, 29, 0.2)',
                '--color': '#ef4444',
                '--border-radius': '16px',
                '--padding-top': '12px',
                '--padding-bottom': '12px',
                'minHeight': 'unset'
              } as any}
            >
              <div className="flex items-center justify-center gap-2">
                <LogOut size={18} />
                Cerrar sesión
              </div>
            </IonButton>
          </div>
        </div>
      </div>
    </div>
  );
}
