import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useClient } from '@/hooks/useClient';
import { getActiveTopics, getClientByCode } from '../utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Radio, ArrowLeft } from 'lucide-react';

export default function Topics() {
  const history = useHistory();
  const { clientCode } = useClient();
  const [clientName, setClientName] = useState<string>('');
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientCode) {
      loadTopics();
      // Refresh topics every 30 seconds
      const interval = setInterval(loadTopics, 30000);
      return () => clearInterval(interval);
    }
  }, [clientCode]);

  const loadTopics = async () => {
    if (!clientCode) return;

    try {
      setLoading(true);
      const [response, clientRes] = await Promise.all([
        getActiveTopics(clientCode),
        getClientByCode(clientCode)
      ]);
      setTopics(response.data.topics || []);
      setClientName(clientRes.data.name);
    } catch (error) {
      console.error('Error loading topics:', error);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 flex flex-col h-full w-full">
      {/* Header - Full Width */}
      <div className="w-screen bg-background relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        {clientCode && (
          <div className="w-full flex items-center gap-2 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-2 pb-3 border-b border-border">
            <button
              onClick={() => history.push('/config')}
              className="p-1 -ml-1 rounded-lg text-[#3eaa76] hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
              title="Volver a los clientes"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-[#3eaa76] capitalize">
              {clientName || clientCode}
            </h1>
          </div>
        )}

        <div className="w-full flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-3 pb-3">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-none">
            Tópicos MQTT Activos
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Lista de tópicos MQTT que han recibido datos en los últimos 5 minutos
          </p>
        </div>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-[#51E8D4]/10 border-b">
          <CardTitle className="text-2xl">Tópicos Activos</CardTitle>
          <CardDescription>
            {topics.length > 0
              ? `${topics.length} tópico${topics.length !== 1 ? 's' : ''} activo${topics.length !== 1 ? 's' : ''}`
              : 'No hay tópicos activos en este momento'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {topics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left p-3 font-semibold text-sm">#</th>
                    <th className="text-left p-3 font-semibold text-sm">Tópico MQTT</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic, index) => (
                    <tr
                      key={topic}
                      className="border-b border-muted/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 text-muted-foreground">{index + 1}</td>
                      <td className="p-3 font-mono text-sm break-all flex items-center gap-2">
                        <Radio className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>{topic}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No hay tópicos activos</p>
              <p className="text-sm mt-2">
                Los tópicos aparecerán aquí cuando se reciban datos MQTT
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
