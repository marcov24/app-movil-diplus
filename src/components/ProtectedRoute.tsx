import { Redirect, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// import { Loader2 } from 'lucide-react';
import { CenterSpinnerSkeleton } from './Skeletons';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <CenterSpinnerSkeleton />;
  }

  if (!isAuthenticated) {
    return <Redirect to={{ pathname: '/admin/login', state: { from: location } }} />;
  }

  return <>{children}</>;
}
