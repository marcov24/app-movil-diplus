import { useParams } from 'react-router-dom';

export function useClient() {
  const params = useParams<{ clientCode?: string }>();
  return {
    clientCode: params.clientCode || null,
    isClientView: !!params.clientCode
  };
}
