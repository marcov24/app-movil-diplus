import { Redirect, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// import { Loader2 } from 'lucide-react';
import { CenterSpinnerSkeleton } from './Skeletons';

export default function AuthRedirect() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <CenterSpinnerSkeleton />;
  }

  // If authenticated and trying to access login, redirect to config
  if (isAuthenticated && location.pathname === '/admin/login') {
    return <Redirect to="/config" />;
  }

  // If authenticated and on root, redirect to config
  if (isAuthenticated && location.pathname === '/') {
    return <Redirect to="/config" />;
  }

  // If not authenticated and not on login, redirect to login
  if (!isAuthenticated && location.pathname !== '/admin/login') {
    return <Redirect to="/admin/login" />;
  }

  return null;
}
