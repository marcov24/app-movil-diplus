import { useEffect, useState } from 'react';
import { useClient } from '@/hooks/useClient';
import { getClientByCode, updateClient } from '../utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast, ToastContainer } from '@/components/ui/toast';

export default function ClientMqttConfig() {
  const { clientCode } = useClient();
  const { toasts, error: showError, success: showSuccess, remove: removeToast } = useToast();
  const [config, setConfig] = useState({
    brokerUrl: '',
    rootTopic: '',
    username: '',
    password: '',
    clientId: '',
    isActive: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (clientCode) {
      loadConfig();
    }
  }, [clientCode]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await getClientByCode(clientCode!);
      const client = response.data;
      setClientId(client._id);
      
      if (client.mqttConfig) {
        setConfig({
          brokerUrl: client.mqttConfig.brokerUrl || '',
          rootTopic: client.mqttConfig.rootTopic || '',
          username: client.mqttConfig.username || '',
          password: client.mqttConfig.password || '',
          clientId: client.mqttConfig.clientId || '',
          isActive: client.mqttConfig.isActive || false
        });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al cargar configuración';
      // Check if it's an MQTT connection/subscription error
      if (errorMessage.toLowerCase().includes('mqtt') || 
          errorMessage.toLowerCase().includes('connection') || 
          errorMessage.toLowerCase().includes('subscription') ||
          errorMessage.toLowerCase().includes('broker')) {
        showError(errorMessage, 7000);
      } else {
        setMessage({ type: 'error', text: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    
    try {
      setSaving(true);
      setMessage(null);
      
      // Validate required fields if isActive is true
      if (config.isActive && !config.brokerUrl) {
        setMessage({ type: 'error', text: 'La URL del broker es requerida cuando MQTT está activo' });
        setSaving(false);
        return;
      }
      
      await updateClient(clientId, {
        mqttConfig: config
      });
      
      // If isActive is true, the server will automatically connect MQTT
      if (config.isActive) {
        showSuccess('Configuración guardada exitosamente. Conectando MQTT...', 3000);
        // Wait a moment for the server to connect, then reload config to get updated status
        setTimeout(() => {
          loadConfig();
          showSuccess('Configuración guardada y MQTT conectado exitosamente', 3000);
        }, 2000);
      } else {
        showSuccess('Configuración guardada exitosamente', 3000);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al guardar configuración';
      // Check if it's an MQTT connection/subscription error
      if (errorMessage.toLowerCase().includes('mqtt') || 
          errorMessage.toLowerCase().includes('connection') || 
          errorMessage.toLowerCase().includes('subscription') ||
          errorMessage.toLowerCase().includes('broker') ||
          errorMessage.toLowerCase().includes('conectar')) {
        showError(errorMessage, 7000);
      } else {
        setMessage({ type: 'error', text: errorMessage });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#3eaa76]">
          Configuración MQTT
        </h2>
        <p className="text-muted-foreground mt-2">
          Configure los parámetros de conexión MQTT para este cliente
        </p>
      </div>

      {message && (
        <Card className={cn(
          "border-2",
          message.type === 'success' ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-red-500 bg-red-50 dark:bg-red-950/30"
        )}>
          <CardContent className="pt-6 flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <p className={cn(
              message.type === 'success' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {message.text}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-[#51E8D4]/10 border-b">
          <div className="flex items-center space-x-2">
            {config.isActive ? (
              <Wifi className="w-5 h-5 text-green-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-gray-400" />
            )}
            <CardTitle className="text-2xl">Configuración del Broker MQTT</CardTitle>
          </div>
          <CardDescription>
            Establezca los parámetros de conexión MQTT para este cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="brokerUrl" className="text-base font-semibold">
                  URL del Broker MQTT
                </Label>
                <Input
                  id="brokerUrl"
                  name="brokerUrl"
                  value={config.brokerUrl}
                  onChange={handleChange}
                  placeholder="mqtt://localhost:1883"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rootTopic" className="text-base font-semibold">
                  Tópico Raíz
                </Label>
                <Input
                  id="rootTopic"
                  name="rootTopic"
                  value={config.rootTopic}
                  onChange={handleChange}
                  placeholder="monitoring"
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground">
                  El sistema se suscribirá a: <span className="font-mono bg-muted px-2 py-1 rounded">{config.rootTopic || 'monitoring'}/#</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-base font-semibold">
                  Usuario (Opcional)
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={config.username}
                  onChange={handleChange}
                  placeholder="Usuario MQTT"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-semibold">
                  Contraseña (Opcional)
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={config.password}
                  onChange={handleChange}
                  placeholder="Contraseña MQTT"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId" className="text-base font-semibold">
                  Client ID (Opcional)
                </Label>
                <Input
                  id="clientId"
                  name="clientId"
                  value={config.clientId}
                  onChange={handleChange}
                  placeholder="monitoring_client"
                  className="h-11"
                />
              </div>

              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={config.isActive}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isActive" className="text-base font-semibold cursor-pointer">
                    Activar conexión MQTT
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#3eaa76] hover:bg-[#3eaa76]/90 text-white min-w-[180px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Configuración'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

