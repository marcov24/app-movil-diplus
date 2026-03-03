import { useEffect, useState } from 'react';
import { getMqttConfig, updateMqttConfig } from '../utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast, ToastContainer } from '@/components/ui/toast';

export default function Config() {
  const { toasts, error: showError, success: showSuccess, remove: removeToast } = useToast();
  const [config, setConfig] = useState({
    brokerUrl: 'mqtt://localhost:1883',
    rootTopic: 'monitoring',
    username: '',
    password: '',
    clientId: 'monitoring_server',
    isActive: false,
    isConnected: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await getMqttConfig();
      setConfig(response.data);
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
    try {
      setSaving(true);
      setMessage(null);
      const response = await updateMqttConfig(config);
      // Update config with response (includes isConnected status)
      setConfig(prev => ({ ...prev, ...response.data }));
      showSuccess('Configuración guardada exitosamente', 3000);
      // Reload config after a short delay to get updated connection status
      setTimeout(() => {
        loadConfig();
      }, 2000);
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
        <h2 className="text-3xl font-bold tracking-tight text-[#3eaa76]">
          Configuración MQTT
        </h2>
        <p className="text-muted-foreground mt-2">
          Configure la conexión al broker MQTT para recibir datos de sensores
        </p>
      </div>

      {message && (
        <Card className={cn(
          "border-2",
          message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <p className={cn(
                "font-medium",
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              )}>
                {message.text}
              </p>
            </div>
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
            <CardTitle className="text-2xl">Configuración del Broker</CardTitle>
          </div>
          <CardDescription>
            Establezca los parámetros de conexión MQTT
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
                  required
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
                  required
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground">
                  El sistema se suscribirá a: <span className="font-mono bg-muted px-2 py-1 rounded">{config.rootTopic}/#</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId" className="text-base font-semibold">
                  ID del Cliente
                </Label>
                <Input
                  id="clientId"
                  name="clientId"
                  value={config.clientId}
                  onChange={handleChange}
                  placeholder="monitoring_server"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-base font-semibold">
                  Usuario (opcional)
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={config.username}
                  onChange={handleChange}
                  className="h-11"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="password" className="text-base font-semibold">
                  Contraseña (opcional)
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={config.password}
                  onChange={handleChange}
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg border">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={config.isActive}
                onChange={handleChange}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isActive" className="text-base font-semibold cursor-pointer">
                Activar conexión MQTT
              </Label>
              {config.isActive && (
                <span className={cn(
                  "ml-auto flex items-center space-x-1 text-sm",
                  config.isConnected ? "text-green-600" : "text-yellow-600"
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    config.isConnected ? "bg-green-600 animate-pulse" : "bg-yellow-600"
                  )}></div>
                  <span>{config.isConnected ? "Conectado" : "Desconectado"}</span>
                </span>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#3eaa76] hover:bg-[#3eaa76]/90 text-white min-w-[150px]"
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
