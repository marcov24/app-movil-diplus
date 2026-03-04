import { useEffect, useState } from 'react';
import { useParams, Redirect } from 'react-router-dom';
import { getClientByCode } from '../utils/api';
import { Loader2 } from 'lucide-react';

interface ClientRouteProps {
  children: React.ReactNode;
}

export default function ClientRoute({ children }: ClientRouteProps) {
  const { clientCode } = useParams<{ clientCode: string }>();
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client routes MUST work without authentication
    // If clientCode exists, allow access immediately
    if (clientCode) {
      // Set valid immediately - don't wait for server validation
      setIsValid(true);
      setLoading(false);

      // Validate client in background (non-blocking, for logging only)
      getClientByCode(clientCode)
        .then(response => {
          if (!response.data || response.data.isActive === false) {
            console.warn('Client found but inactive:', clientCode);
          }
        })
        .catch(error => {
          // Log but don't block - client routes are public
          console.warn('Error validating client (non-blocking):', error.response?.status || error.message);
        });
    } else {
      setIsValid(false);
      setLoading(false);
    }
  }, [clientCode]);

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

  // Only redirect if no clientCode provided
  if (!isValid || !clientCode) {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
