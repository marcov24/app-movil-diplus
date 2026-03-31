import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useClient } from '@/hooks/useClient';
import { getActiveTopics, getClientByCode } from '../utils/api';
import { ListSkeleton } from '../components/Skeletons';
import { Radio, ArrowLeft, Copy, CheckCheck, Activity, Bell } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import PullToRefresh from '../components/PullToRefresh';

export default function Topics() {
  const history = useHistory();
  const { clientCode } = useClient();
  const [clientName, setClientName] = useState<string>('');
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
  const { toasts, success: showSuccess, remove: removeToast } = useToast();

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
    return <ListSkeleton count={4} />;
  }

  return (
    <PullToRefresh onRefresh={loadTopics}>
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

      {/* Lista de Tarjetas en lugar de la tabla */}
      <div className="space-y-3 pb-6">
        {topics.length > 0 ? (
          topics.map((topic, _index) => {
            const parts = topic.split('/');
            const lastPart = parts.length > 0 ? parts[parts.length - 1] : '';
            const secondToLast = parts.length > 1 ? parts[parts.length - 2] : '';
            const contextParts = parts.length > 2 ? parts.slice(0, parts.length - 2).join(' / ') : '';
            
            // Determinar ícono y color según el tópico
            const isAlarm = topic.toLowerCase().includes('alarma');
            const Icon = isAlarm ? Bell : Activity;
            const iconColor = isAlarm ? 'text-red-500' : 'text-[#3eaa76]';
            const bgColor = isAlarm ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20';
            const pulseColor = isAlarm ? 'bg-red-500' : 'bg-[#3eaa76]';

            return (
              <div 
                key={topic} 
                className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100/60 dark:border-gray-700/50 overflow-hidden"
              >
                {/* Lado Acentuado */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isAlarm ? 'bg-red-500' : 'bg-[#3eaa76]'}`} />
                
                <div className="flex items-center gap-3 p-3.5 sm:p-4 pl-4 sm:pl-5">
                  <div className="relative">
                    <div className={`p-2.5 sm:p-3 rounded-xl ${bgColor} shrink-0`}>
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
                    </div>
                    {/* Animación de pulso indicando actividad reciente en el icono */}
                    <div className="absolute -top-1 -right-1 flex h-3 w-3">
                       <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-75`}></span>
                       <span className={`relative inline-flex rounded-full h-3 w-3 ${pulseColor} border-2 border-white dark:border-gray-800`}></span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center pr-1">
                    {/* Breadcrumbs (contexto superior limpio) */}
                    {contextParts && (
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest truncate mb-0.5">
                        {contextParts.replace(/\//g, ' • ')}
                      </p>
                    )}
                    
                    {/* Nombre del tópico final bien remarcado */}
                    <div className="flex flex-wrap items-baseline gap-1 break-all leading-tight mt-0.5">
                      {secondToLast && (
                        <span className="text-[13px] sm:text-[15px] font-semibold text-gray-500 dark:text-gray-400">
                          {secondToLast} /
                        </span>
                      )}
                      <span className="text-[15px] sm:text-[17px] font-bold text-gray-900 dark:text-white">
                        {lastPart}
                      </span>
                    </div>
                  </div>

                  {/* Acciones: Botón de copiar ghost */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(topic);
                      setCopiedTopic(topic);
                      showSuccess('Tópico copiado', 2000);
                      setTimeout(() => setCopiedTopic(null), 2000);
                    }}
                    className={`shrink-0 flex items-center justify-center p-2.5 sm:px-3 sm:py-2 rounded-full sm:rounded-lg transition-colors active:scale-95 ${
                      copiedTopic === topic 
                        ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800'
                    }`}
                    title="Copiar tópico"
                  >
                    {copiedTopic === topic ? (
                      <>
                        <CheckCheck className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-wider">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-wider">Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 border-dashed">
            <Radio className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No hay tópicos activos</p>
            <p className="text-sm mt-2 text-gray-400">
              Los tópicos aparecerán aquí cuando se reciban datos.
            </p>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
    </PullToRefresh>
  );
}
