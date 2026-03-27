import { useEffect, useState } from 'react';
import { useParams, Redirect } from 'react-router-dom';
import { getClientByCode } from '../utils/api';
// import { Loader2 } from 'lucide-react';
import { CenterSpinnerSkeleton } from './Skeletons';

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
    return <CenterSpinnerSkeleton />;
  }

  // Only redirect if no clientCode provided
  if (!isValid || !clientCode) {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
