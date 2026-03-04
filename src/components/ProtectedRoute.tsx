import { Redirect, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="relative">
          <div className="absolute inset-0 bg-[#3eaa76]/30 rounded-full blur-xl animate-pulse -m-2"></div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 dark:border-gray-700 relative z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#3eaa76] animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to={{ pathname: '/admin/login', state: { from: location } }} />;
  }

  return <>{children}</>;
}
