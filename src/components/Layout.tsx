import { useLocation, useHistory } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';
import { IonPage, IonContent, IonFooter } from '@ionic/react';
import {
  Activity, Bell, ChevronLeft, ChevronRight, Sun, Moon, LogOut,
  Radio, Map, Users, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { useClient } from '@/hooks/useClient';
import { getClientByCode } from '../utils/api';
import ProfileModal from './ProfileModal';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const history = useHistory();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const { clientCode } = useClient();
  const [_clientName, setClientName] = useState<string | null>(null);

  const isAdminView = !clientCode && isAuthenticated;

  // Load client name
  useEffect(() => {
    if (clientCode) {
      const loadClientName = async () => {
        try {
          const response = await getClientByCode(clientCode);
          setClientName(response.data.name);
        } catch (error) {
          console.error('Error loading client name:', error);
          setClientName(null);
        }
      };
      loadClientName();
    } else {
      setClientName(null);
    }
  }, [clientCode]);

  // Client view nav items
  const clientNavItems = [
    { path: clientCode ? `/${clientCode}/dashboard` : '/', label: 'Dashboard', icon: Activity, id: 'dashboard' },
    { path: clientCode ? `/${clientCode}/mapa` : '/mapa', label: 'Mapa', icon: Map, id: 'map' },
    { path: clientCode ? `/${clientCode}/topics` : '/topics', label: 'Tópicos', icon: Radio, id: 'topics' },
    { path: clientCode ? `/${clientCode}/alerts` : '/alerts', label: 'Alertas', icon: Bell, id: 'alerts' },
  ];

  // Admin view nav items
  const adminNavItems = [
    { path: '/config', label: 'Clientes', icon: Users, id: 'clients' },
    // { path: '/areas', label: 'Áreas', icon: MapPin, id: 'areas' },
  ];

  const navItems = isAdminView ? adminNavItems : clientNavItems;

  const isActive = (path: string) => location?.pathname === path;


  const handleLogout = () => {
    logout();
    history.push('/admin/login');
  };

  const navigateTo = (path: string) => {
    history.push(path);
  };

  return (
    <IonPage>
      <IonContent>
        <div className="flex h-full">
          {/* ─── Desktop Sidebar ─── */}
          <div className={cn(
            "hidden md:flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex-shrink-0",
            isSidebarCollapsed ? "w-16" : "w-64"
          )}>
            {/* Sidebar Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Alternar Tema"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 py-6 space-y-2 overflow-y-auto px-3">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.path)}
                    className={cn(
                      "w-full flex items-center transition-all duration-200 relative min-h-[44px] rounded-lg group px-3",
                      active
                        ? "bg-[#3eaa76]/10 text-[#3eaa76] dark:text-green-400 font-semibold shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                    )}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <div className={cn(
                      "flex items-center justify-center transition-colors",
                      active ? "text-[#3eaa76] dark:text-green-400" : "group-hover:text-gray-900 dark:group-hover:text-gray-100"
                    )}>
                      <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                    </div>
                    <span className={cn(
                      "ml-3 text-sm transition-all duration-200",
                      isSidebarCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                    )}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
              {!isAdminView && clientCode && (
                <button
                  onClick={() => navigateTo('/config')}
                  className={cn(
                    "w-full flex items-center p-2 rounded-md transition-colors text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800",
                    isSidebarCollapsed && "justify-center"
                  )}
                >
                  <LogOut size={20} className="rotate-180" />
                  <span className={cn("ml-3 text-sm", isSidebarCollapsed ? "hidden" : "block")}>
                    Lista de Clientes
                  </span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className={cn(
                  "w-full flex items-center p-2 rounded-md transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10",
                  isSidebarCollapsed && "justify-center"
                )}
              >
                <LogOut size={20} />
                <span className={cn("ml-3 text-sm font-medium", isSidebarCollapsed ? "hidden" : "block")}>
                  Cerrar Sesión
                </span>
              </button>
            </div>
          </div>

          {/* ─── Main Content ─── */}
          <div className="flex-1 overflow-y-auto">
            <div className={cn(
              "w-full mx-auto py-4 md:py-8 px-3 sm:px-4 md:px-6 lg:px-8",
              location.pathname?.includes('/mapa') ? "max-w-none" : "max-w-7xl"
            )}>
              {children}
            </div>
          </div>
        </div>
      </IonContent>

      {/* ─── Mobile Bottom Tab Bar ─── */}
      <IonFooter className="md:hidden">
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="flex h-16 justify-around items-center pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 min-h-[48px] flex-1",
                    active
                      ? "text-[#3eaa76]"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={cn(
                    "text-xs leading-tight",
                    active ? "font-bold" : "font-medium"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}

            {/* Perfil action button (Hidden on client views) */}
            {!clientCode && (
              <button
                onClick={() => setIsProfileOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 min-h-[48px] flex-1 text-gray-400 dark:text-gray-500"
              >
                <User size={22} strokeWidth={1.8} />
                <span className="text-xs leading-tight font-medium">Perfil</span>
              </button>
            )}
          </div>
        </div>
      </IonFooter>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </IonPage>
  );
}
