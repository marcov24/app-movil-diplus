import { useEffect, useState } from 'react';
import { getClients, createClient, updateClient, deleteClient, getClientMqttStatus, uploadClientMapImage, deleteClientMapImage, sendTestNotification } from '../utils/api';
import { Plus, Edit2, Trash2, ExternalLink, Loader2, Wifi, WifiOff, Activity, AlertCircle, ChevronLeft, ChevronDown, Save } from 'lucide-react';
import { IonButton } from '@ionic/react';
import { cn } from '@/lib/utils';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';

interface Client {
  _id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  phone?: string;
  group?: string;
  notificationTopic?: string;
  mapImage?: string;
  mqttConfig?: {
    brokerUrl?: string;
    rootTopic?: string;
    username?: string;
    password?: string;
    clientId?: string;
    isActive?: boolean;
  };
}

export default function Clients() {
  const { toasts, error: showError, success: showSuccess, remove: removeToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({
    name: '',
    code: '',
    description: '',
    phone: '',
    group: '',
    notificationTopic: '',
    mqttConfig: {
      brokerUrl: '',
      rootTopic: '',
      username: '',
      password: '',
      clientId: '',
      isActive: false
    }
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedMqtt, setExpandedMqtt] = useState<Record<string, boolean>>({});
  const [mqttStatuses, setMqttStatuses] = useState<Record<string, { isConnected: boolean; isActive: boolean }>>({});
  const [connectingMqtt, setConnectingMqtt] = useState<Record<string, boolean>>({});
  const [creatingClient, setCreatingClient] = useState(false);
  const [updatingClient, setUpdatingClient] = useState<Record<string, boolean>>({});
  const [uploadingMap, setUploadingMap] = useState<Record<string, boolean>>({});
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: 'client' | 'map' | null;
    targetId: string | null;
  }>({
    isOpen: false,
    type: null,
    targetId: null
  });

  // Hide Ionic tab bar when form overlays are open
  useEffect(() => {
    if (showNewForm || editingClient !== null) {
      document.body.classList.add('hide-tabs');
    } else {
      document.body.classList.remove('hide-tabs');
    }
    return () => document.body.classList.remove('hide-tabs');
  }, [showNewForm, editingClient]);
  const [testingNotification, setTestingNotification] = useState<Record<string, boolean>>({});
  const [editingMqttConfig, setEditingMqttConfig] = useState<Record<string, {
    brokerUrl: string;
    rootTopic: string;
    username: string;
    password: string;
    clientId: string;
    isActive: boolean;
  }>>({});
  const [editingClientData, setEditingClientData] = useState<Record<string, {
    name: string;
    code: string;
    description: string;
    phone: string;
    group: string;
    notificationTopic: string;
    isActive: boolean;
  }>>({});

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (clients.length > 0) {
      loadMqttStatuses();
      // Refresh status every 30 seconds
      const interval = setInterval(() => loadMqttStatuses(), 30000);
      return () => clearInterval(interval);
    }
  }, [clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await getClients();
      setClients(response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error loading clients:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadMqttStatuses = async (clientsList?: Client[]) => {
    const clientsToCheck = clientsList || clients;
    const statuses: Record<string, { isConnected: boolean; isActive: boolean }> = {};
    for (const client of clientsToCheck) {
      try {
        const response = await getClientMqttStatus(client._id);
        statuses[client._id] = {
          isConnected: response.data.isConnected,
          isActive: response.data.isActive
        };
      } catch (error) {
        statuses[client._id] = { isConnected: false, isActive: false };
      }
    }
    setMqttStatuses(statuses);
  };

  const handleCreateClient = async () => {
    // Activate loading immediately
    setCreatingClient(true);

    try {
      if (!newClient.name || !newClient.code) {
        showError('Nombre y código son requeridos');
        return;
      }

      await createClient(newClient);
      setNewClient({
        name: '',
        code: '',
        description: '',
        phone: '',
        group: '',
        notificationTopic: '',
        mqttConfig: {
          brokerUrl: '',
          rootTopic: '',
          username: '',
          password: '',
          clientId: '',
          isActive: false
        }
      });
      setShowNewForm(false);
      loadClients();
      showSuccess('Cliente creado exitosamente');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Error al crear cliente');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleUpdateClient = async (id: string, data: Partial<Client>) => {
    // Activate loading immediately
    setUpdatingClient(prev => ({ ...prev, [id]: true }));

    try {
      await updateClient(id, data);
      setEditingClient(null);
      const updatedClients = await loadClients();

      // If MQTT config was updated (especially isActive), reload MQTT statuses
      if (data.mqttConfig !== undefined && updatedClients) {
        // Wait a moment for MQTT to connect/disconnect if needed
        setTimeout(() => {
          loadMqttStatuses(updatedClients);
        }, 1000);
      }
      showSuccess('Cliente actualizado exitosamente');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Error al actualizar cliente');
    } finally {
      setUpdatingClient(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await deleteClient(id);
      loadClients();
      showSuccess('Cliente eliminado exitosamente');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Error al eliminar cliente');
    }
  };

  const handleSaveMqttConfig = async (clientId: string) => {
    try {
      setConnectingMqtt(prev => ({ ...prev, [clientId]: true }));

      // Get the MQTT config from editing state
      const mqttConfig = editingMqttConfig[clientId];
      if (!mqttConfig) {
        setConnectingMqtt(prev => ({ ...prev, [clientId]: false }));
        return;
      }

      // Save the MQTT configuration
      await updateClient(clientId, {
        mqttConfig: mqttConfig
      });

      // Reload clients and MQTT statuses
      const updatedClients = await loadClients();

      // Wait a moment for MQTT to connect/disconnect if needed
      setTimeout(() => {
        loadMqttStatuses(updatedClients);
        // Clear editing state
        setEditingMqttConfig(prev => {
          const newState = { ...prev };
          delete newState[clientId];
          return newState;
        });
        setConnectingMqtt(prev => ({ ...prev, [clientId]: false }));
      }, 1500);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al guardar configuración MQTT';
      // Check if it's an MQTT connection/subscription error
      if (errorMessage.toLowerCase().includes('mqtt') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('subscription') ||
        errorMessage.toLowerCase().includes('broker')) {
        showError(errorMessage, 7000);
      } else {
        showError(errorMessage);
      }
      setConnectingMqtt(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const handleMapUpload = async (clientId: string, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Por favor seleccione una imagen válida');
      return;
    }
    try {
      setUploadingMap(prev => ({ ...prev, [clientId]: true }));
      await uploadClientMapImage(clientId, file);
      await loadClients();
      showSuccess('Plano actualizado');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Error al subir el mapa');
    } finally {
      setUploadingMap(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const handleDeleteMapImage = async (clientId: string) => {
    try {
      setUploadingMap(prev => ({ ...prev, [clientId]: true }));
      await deleteClientMapImage(clientId);
      setClients(prev => prev.map(client => (
        client._id === clientId ? { ...client, mapImage: '' } : client
      )));
      await loadClients();
      showSuccess('Plano eliminado');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Error al eliminar el mapa');
    } finally {
      setUploadingMap(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const initializeMqttEditing = (client: Client) => {
    if (!editingMqttConfig[client._id]) {
      setEditingMqttConfig(prev => ({
        ...prev,
        [client._id]: {
          brokerUrl: client.mqttConfig?.brokerUrl || '',
          rootTopic: client.mqttConfig?.rootTopic || '',
          username: client.mqttConfig?.username || '',
          password: client.mqttConfig?.password || '',
          clientId: client.mqttConfig?.clientId || '',
          isActive: client.mqttConfig?.isActive || false
        }
      }));
    }
  };

  const initializeClientEditing = (client: Client) => {
    if (!editingClientData[client._id]) {
      setEditingClientData(prev => ({
        ...prev,
        [client._id]: {
          name: client.name || '',
          code: client.code || '',
          description: client.description || '',
          phone: client.phone || '',
          group: client.group || '',
          notificationTopic: client.notificationTopic || '',
          isActive: client.isActive !== undefined ? client.isActive : true
        }
      }));
    }
  };

  const updateClientEditingField = (clientId: string, field: string, value: string | boolean) => {
    setEditingClientData(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [field]: value
      }
    }));
  };

  const handleSaveClientData = async (clientId: string) => {
    const clientData = editingClientData[clientId];
    if (!clientData) return;

    try {
      setUpdatingClient(prev => ({ ...prev, [clientId]: true }));
      await handleUpdateClient(clientId, {
        name: clientData.name,
        code: clientData.code.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        description: clientData.description,
        phone: clientData.phone,
        group: clientData.group,
        notificationTopic: clientData.notificationTopic,
        isActive: clientData.isActive
      });
      // Clear editing state after successful save
      setEditingClientData(prev => {
        const newState = { ...prev };
        delete newState[clientId];
        return newState;
      });
    } catch (error) {
      // Error is already handled in handleUpdateClient
    } finally {
      setUpdatingClient(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const updateMqttEditingField = (clientId: string, field: string, value: string | boolean) => {
    setEditingMqttConfig(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [field]: value
      }
    }));
  };

  // const getClientUrl = (code: string) => {
  //   const baseUrl = window.location.origin;
  //   // Use hash routing: #/clientCode/dashboard
  //   return `${baseUrl}/#/${code}/dashboard`;
  // };

  const handleOpenClient = (code: string) => {
    // Navigate within the same window using React Router Hash history
    window.location.hash = `/${code}/dashboard`;
  };

  // const handleCopyUrl = async (code: string) => {
  //   const url = getClientUrl(code);
  //   try {
  //     await navigator.clipboard.writeText(url);
  //     setCopiedCode(code);
  //     setTimeout(() => setCopiedCode(null), 2000);
  //   } catch (error) {
  //     console.error('Error copying URL:', error);
  //     // Fallback for older browsers
  //     const textArea = document.createElement('textarea');
  //     textArea.value = url;
  //     document.body.appendChild(textArea);
  //     textArea.select();
  //     document.execCommand('copy');
  //     document.body.removeChild(textArea);
  //     setCopiedCode(code);
  //     setTimeout(() => setCopiedCode(null), 2000);
  //   }
  // };

  const handleTestNotification = async (clientId: string) => {
    try {
      setTestingNotification(prev => ({ ...prev, [clientId]: true }));
      await sendTestNotification(clientId);
      showSuccess('Notificación de prueba enviada correctamente');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Error al enviar notificación de prueba');
    } finally {
      setTestingNotification(prev => ({ ...prev, [clientId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative">
          <div className="absolute inset-0 bg-[#3eaa76]/30 rounded-full blur-xl animate-pulse -m-2"></div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 dark:border-gray-700 relative z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#3eaa76] animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Administración de <span className="text-[#3eaa76]">Clientes</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gestiona los accesos y configuraciones de monitorización.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {clients.length} clientes registrados
        </p>
      </div>

      {/* New Client Button */}
      <div className="mb-4">
        <IonButton
          onClick={() => setShowNewForm(!showNewForm)}
          fill="solid"
          className="w-full md:w-auto text-sm font-semibold h-11"
          style={{
            '--border-radius': '12px',
            '--background': '#3eaa76',
            '--color': '#ffffff',
            'height': '44px',
            'margin': '0'
          }}
        >
          <Plus size={18} className="mr-2" />
          NUEVO CLIENTE
        </IonButton>
      </div>

      {/* New Client Form - Full Page Overlay */}
      {showNewForm && (
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex flex-col">
          {/* Form fields - scrollable */}
          <div className="flex-1 overflow-y-auto pb-28">
            {/* Header */}
            <div className="px-5 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => setShowNewForm(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo Cliente</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 ml-12">
                Configure los detalles para el nuevo cliente.
              </p>
            </div>

            {/* Info banner */}
            <div className="mx-5 mb-6 p-2 bg-green-50 dark:bg-green-950/30 rounded-2xl border border-green-100 dark:border-green-900/50">
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-[#3eaa76] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  El <strong className="text-[#3eaa76]">Código</strong> debe ser único. Una vez creado, podrá configurar MQTT y subir el mapa desde el panel de edición.
                </p>
              </div>
            </div>

            <div className="px-5 space-y-5">
              {/* Nombre */}
              <div className="float-group">
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  onBlur={() => setTouched(p => ({ ...p, name: true }))}
                  placeholder=" "
                  className={`float-input ${touched.name && !newClient.name ? 'border-red-400 dark:border-red-500' : ''}`}
                />
                <label className="float-label">Nombre *</label>
                {touched.name && !newClient.name && (
                  <p className="text-xs text-red-500 mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={12} />Requerido</p>
                )}
              </div>

              {/* Código */}
              <div className="float-group">
                <input
                  type="text"
                  value={newClient.code}
                  onChange={(e) => setNewClient({ ...newClient, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                  onBlur={() => setTouched(p => ({ ...p, code: true }))}
                  placeholder=" "
                  className={`float-input ${touched.code && !newClient.code ? 'border-red-400 dark:border-red-500' : ''}`}
                />
                <label className="float-label">Código *</label>
                {touched.code && !newClient.code ? (
                  <p className="text-xs text-red-500 mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={12} />Requerido</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1.5 ml-1">
                    Ej: julcani, chacua, planta_01 (solo minúsculas, números, - y _)
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div className="float-group">
                <textarea
                  value={newClient.description}
                  onChange={(e) => setNewClient({ ...newClient, description: e.target.value })}
                  placeholder=" "
                  className="float-textarea min-h-[120px] resize-none"
                />
                <label className="float-label">Descripción</label>
              </div>

              {/* Teléfono */}
              <div className="float-group">
                <input
                  type="text"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder=" "
                  className="float-input"
                />
                <label className="float-label">Teléfono</label>
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Número para alertas WhatsApp. Ej: +51987654321
                </p>
              </div>

              {/* Grupo */}
              <div className="float-group">
                <input
                  type="text"
                  value={newClient.group}
                  onChange={(e) => setNewClient({ ...newClient, group: e.target.value })}
                  placeholder=" "
                  className="float-input"
                />
                <label className="float-label">Grupo</label>
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Agrupe clientes. Ej: Monitoreo gases, Ventilación
                </p>
              </div>

              {/* Tópico de Notificaciones */}
              <div className="float-group">
                <input
                  type="text"
                  value={newClient.notificationTopic}
                  onChange={(e) => setNewClient({ ...newClient, notificationTopic: e.target.value })}
                  placeholder=" "
                  className="float-input"
                />
                <label className="float-label">Tópico de Notificaciones</label>
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Tópico MQTT donde se enviarán las notificaciones
                </p>
              </div>
            </div>

            {/* Fixed bottom button */}
            <div className="fixed bottom-0 left-0 right-0 p-5 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 z-[10000]">
              <IonButton
                onClick={handleCreateClient}
                disabled={creatingClient || !newClient.name || !newClient.code}
                fill="solid"
                expand="block"
                style={{ '--background': '#3eaa76', '--border-radius': '12px', 'height': '48px', 'margin': '0' }}
                className="w-full text-sm font-semibold shadow-lg"
              >
                {creatingClient ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> CREANDO...</>
                ) : (
                  <><Plus className="w-5 h-5" /> CREAR CLIENTE</>
                )}
              </IonButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Form - Full Page Overlay */}
      {editingClient && (
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex flex-col">
          {(() => {
            if (!editingMqttConfig[editingClient]) {
              const client = clients.find(c => c._id === editingClient);
              if (client) initializeMqttEditing(client);
            }
            if (!editingClientData[editingClient]) {
              const client = clients.find(c => c._id === editingClient);
              if (client) initializeClientEditing(client);
            }
            return null;
          })()}

          {/* Calculate if there are pending changes */}
          {(() => {
            const client = clients.find(c => c._id === editingClient);
            const currentData = editingClientData[editingClient];
            const currentMqtt = editingMqttConfig[editingClient];

            let hasChanges = false;
            let changesCount = 0;

            if (client && currentData) {
              if (client.name !== currentData.name) changesCount++;
              if (client.code !== currentData.code) changesCount++;
              if ((client.description || '') !== currentData.description) changesCount++;
              if ((client.phone || '') !== currentData.phone) changesCount++;
              if ((client.group || '') !== currentData.group) changesCount++;
              if ((client.notificationTopic || '') !== currentData.notificationTopic) changesCount++;
              if ((client.isActive !== undefined ? client.isActive : true) !== currentData.isActive) changesCount++;

              if (currentMqtt) {
                if ((client.mqttConfig?.brokerUrl || '') !== currentMqtt.brokerUrl) changesCount++;
                if ((client.mqttConfig?.rootTopic || '') !== currentMqtt.rootTopic) changesCount++;
                if ((client.mqttConfig?.username || '') !== currentMqtt.username) changesCount++;
                if ((client.mqttConfig?.password || '') !== currentMqtt.password) changesCount++;
                if ((client.mqttConfig?.clientId || '') !== currentMqtt.clientId) changesCount++;
                if ((client.mqttConfig?.isActive || false) !== currentMqtt.isActive) changesCount++;
              }

              hasChanges = changesCount > 0;
            }

            return (
              <>

                {/* Form fields - scrollable */}
                <div className="flex-1 overflow-y-auto pb-28">
                  {/* Header */}
                  <div className="px-5 pt-6 pb-4">
                    <div className="flex items-center gap-3 mb-1">
                      <button
                        onClick={() => {
                          setEditingClientData(prev => {
                            const s = { ...prev };
                            delete s[editingClient];
                            return s;
                          });
                          setEditingClient(null);
                        }}
                        className="p-2 -ml-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Editar Cliente
                      </h2>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm pl-11">
                      Actualice los detalles y configuración MQTT.
                    </p>
                  </div>

                  {/* Info banner */}
                  <div className="mx-5 mb-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-2xl border border-green-100 dark:border-green-900/50">
                    <div className="flex items-start gap-3">
                      <Activity className="w-5 h-5 text-[#3eaa76] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-800 dark:text-green-300">
                        Puede activar/desactivar el cliente y su conexión MQTT desde esta vista.
                      </p>
                    </div>
                  </div>

                  <div className="px-5 space-y-5">
                    <h3 className="font-bold text-gray-900 dark:text-white mt-6 mb-2">Datos Básicos</h3>

                    {/* Nombre */}
                    <div className="float-group">
                      <input
                        type="text"
                        value={editingClientData[editingClient]?.name || ''}
                        onChange={(e) => updateClientEditingField(editingClient, 'name', e.target.value)}
                        disabled={updatingClient[editingClient]}
                        placeholder=" "
                        className="float-input"
                      />
                      <label className="float-label">Nombre</label>
                    </div>

                    {/* Código */}
                    <div className="float-group">
                      <input
                        type="text"
                        value={editingClientData[editingClient]?.code || ''}
                        onChange={(e) => updateClientEditingField(editingClient, 'code', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        disabled={updatingClient[editingClient]}
                        placeholder=" "
                        className="float-input"
                      />
                      <label className="float-label">Código</label>
                    </div>

                    {/* Descripción */}
                    <div className="float-group">
                      <textarea
                        value={editingClientData[editingClient]?.description || ''}
                        onChange={(e) => updateClientEditingField(editingClient, 'description', e.target.value)}
                        disabled={updatingClient[editingClient]}
                        placeholder=" "
                        className="float-textarea min-h-[100px] resize-none"
                      />
                      <label className="float-label">Descripción</label>
                    </div>

                    {/* Teléfono */}
                    <div className="float-group">
                      <input
                        type="text"
                        value={editingClientData[editingClient]?.phone || ''}
                        onChange={(e) => updateClientEditingField(editingClient, 'phone', e.target.value)}
                        disabled={updatingClient[editingClient]}
                        placeholder=" "
                        className="float-input"
                      />
                      <label className="float-label">Teléfono</label>
                    </div>

                    {/* Grupo */}
                    <div className="float-group">
                      <input
                        type="text"
                        value={editingClientData[editingClient]?.group || ''}
                        onChange={(e) => updateClientEditingField(editingClient, 'group', e.target.value)}
                        disabled={updatingClient[editingClient]}
                        placeholder=" "
                        className="float-input"
                      />
                      <label className="float-label">Grupo</label>
                    </div>

                    {/* Tópico Notificaciones */}
                    <div className="float-group">
                      <input
                        type="text"
                        value={editingClientData[editingClient]?.notificationTopic || ''}
                        onChange={(e) => updateClientEditingField(editingClient, 'notificationTopic', e.target.value)}
                        disabled={updatingClient[editingClient]}
                        placeholder=" "
                        className="float-input"
                      />
                      <label className="float-label">Tópico de Notificaciones</label>
                    </div>

                    {/* Activo switch */}
                    <label className="flex items-center space-x-3 cursor-pointer group w-fit mt-6">
                      <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${(editingClientData[editingClient]?.isActive ?? true) ? 'bg-[#3eaa76]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${(editingClientData[editingClient]?.isActive ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <input
                        type="checkbox"
                        checked={editingClientData[editingClient]?.isActive ?? true}
                        onChange={(e) => updateClientEditingField(editingClient, 'isActive', e.target.checked)}
                        disabled={updatingClient[editingClient]}
                        className="hidden"
                      />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Estado del Cliente: {(editingClientData[editingClient]?.isActive ?? true) ? 'Activo' : 'Inactivo'}
                      </span>
                    </label>

                    {/* Separator - MQTT Settings (Accordion) */}
                    <div className="mt-6 border border-gray-100 dark:border-gray-800 rounded-[10px] overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setExpandedMqtt(prev => ({ ...prev, [editingClient]: !prev[editingClient] }))}
                        className="w-full flex items-center justify-between px-5 py-4 min-h-[45px] bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={`${expandedMqtt[editingClient] ? 'Ocultar' : 'Mostrar'} Configuración MQTT`}
                      >
                        <div className="flex items-center gap-2">
                          <Wifi size={16} className="text-cyan-500" />
                          <span className="text-sm font-semibold text-gray-800 dark:text-white">Configuración MQTT</span>
                          {editingMqttConfig[editingClient] && (
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              editingMqttConfig[editingClient].isActive ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            )}>
                              {editingMqttConfig[editingClient].isActive ? 'ON' : 'OFF'}
                            </span>
                          )}
                        </div>
                        <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform duration-300", expandedMqtt[editingClient] ? "rotate-180" : "")} />
                      </button>

                      <div className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden",
                        expandedMqtt[editingClient] ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                      )}>
                        {editingMqttConfig[editingClient] && (
                          <div className="p-5 space-y-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                            <div className="float-group">
                              <input
                                type="text"
                                value={editingMqttConfig[editingClient].brokerUrl}
                                onChange={(e) => updateMqttEditingField(editingClient, 'brokerUrl', e.target.value)}
                                placeholder=" "
                                className="float-input"
                              />
                              <label className="float-label">BROKER URL</label>
                              <p className="text-xs text-gray-400 mt-1.5 ml-1">Ej: mqtt://mi-broker.com:1883 o mqtts://broker:8883</p>
                            </div>

                            <div className="float-group">
                              <input
                                type="text"
                                value={editingMqttConfig[editingClient].username}
                                onChange={(e) => updateMqttEditingField(editingClient, 'username', e.target.value)}
                                placeholder=" "
                                className="float-input"
                              />
                              <label className="float-label">USUARIO</label>
                              <p className="text-xs text-gray-400 mt-1.5 ml-1">Credencial de autenticación MQTT</p>
                            </div>

                            <div className="float-group">
                              <input
                                type="password"
                                value={editingMqttConfig[editingClient].password}
                                onChange={(e) => updateMqttEditingField(editingClient, 'password', e.target.value)}
                                placeholder=" "
                                className="float-input"
                              />
                              <label className="float-label">CONTRASEÑA</label>
                            </div>

                            <div className="float-group">
                              <input
                                type="text"
                                value={editingMqttConfig[editingClient].rootTopic}
                                onChange={(e) => updateMqttEditingField(editingClient, 'rootTopic', e.target.value)}
                                placeholder=" "
                                className="float-input"
                              />
                              <label className="float-label">ROOT TOPIC</label>
                              <p className="text-xs text-gray-400 mt-1.5 ml-1">Prefijo de todos los tópicos. Ej: yumpag</p>
                            </div>

                            <div className="float-group">
                              <input
                                type="text"
                                value={editingMqttConfig[editingClient].clientId}
                                onChange={(e) => updateMqttEditingField(editingClient, 'clientId', e.target.value)}
                                placeholder=" "
                                className="float-input"
                              />
                              <label className="float-label">CLIENT ID</label>
                              <p className="text-xs text-gray-400 mt-1.5 ml-1">Identificador único del broker. Ej: yumpag_broker</p>
                            </div>

                            <label className="flex items-center space-x-3 cursor-pointer group w-fit mt-6">
                              <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${editingMqttConfig[editingClient].isActive ? 'bg-[#3b82f6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${editingMqttConfig[editingClient].isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input
                                type="checkbox"
                                checked={editingMqttConfig[editingClient].isActive}
                                onChange={(e) => updateMqttEditingField(editingClient, 'isActive', e.target.checked)}
                                className="hidden"
                              />
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                MQTT: {editingMqttConfig[editingClient].isActive ? 'Habilitada' : 'Deshabilitada'}
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Separator - Map Upload */}
                    <div className="pt-6 mt-4">
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-4">Mapa del Cliente</h3>
                      <input
                        id={`map-upload-${editingClient}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleMapUpload(editingClient, e.target.files?.[0])}
                      />
                      <div className="flex flex-col gap-3">
                        <div
                          onClick={() => !clients.find(c => c._id === editingClient)?.mapImage && document.getElementById(`map-upload-${editingClient}`)?.click()}
                          className="relative rounded-2xl overflow-hidden border-[3px] border-dashed border-green-300/60 dark:border-green-800 bg-white dark:bg-gray-950 p-2 min-h-[160px] flex items-center justify-center cursor-pointer hover:border-green-400 dark:hover:border-green-600 transition-colors"
                        >
                          {clients.find(c => c._id === editingClient)?.mapImage ? (
                            <img
                              src={clients.find(c => c._id === editingClient)?.mapImage}
                              alt="Mapa actual"
                              className="w-full object-contain max-h-64"
                            />
                          ) : (
                            <div className="text-center p-6">
                              <p className="text-gray-400 text-sm font-medium">Toca para subir un mapa</p>
                              <p className="text-gray-400 text-xs mt-1">Imágenes recomendadas: PNG o JPG</p>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-gray-400 mt-1 mb-2 px-1">Este mapa se utilizará en la vista de monitoreo para posicionar los sensores en tiempo real.</p>

                        <div className="flex items-center gap-2">
                          <IonButton
                            fill="outline"
                            onClick={() => document.getElementById(`map-upload-${editingClient}`)?.click()}
                            disabled={uploadingMap[editingClient]}
                            className="flex-1 text-xs font-bold"
                            style={{ '--background': 'transparent', '--color': '#3eaa76', '--border-color': '#3eaa76', '--border-radius': '10px', 'height': '40px', 'margin': '0' }}
                          >
                            {uploadingMap[editingClient] ? (
                              <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> SUBIENDO...</span>
                            ) : (
                              clients.find(c => c._id === editingClient)?.mapImage ? 'CAMBIAR MAPA' : 'SUBIR MAPA'
                            )}
                          </IonButton>

                          {clients.find(c => c._id === editingClient)?.mapImage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteModalState({
                                  isOpen: true,
                                  type: 'map',
                                  targetId: editingClient
                                });
                              }}
                              className="w-10 h-10 flex items-center justify-center shrink-0 rounded-xl border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Eliminar Mapa"
                            >
                              <Trash2 className="w-[18px] h-[18px]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fixed bottom button */}
                  <div className="fixed bottom-0 left-0 right-0 p-5 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 z-[10000]">
                    <IonButton
                      onClick={async () => {
                        updateClientEditingField(editingClient, 'name', editingClientData[editingClient].name); // dummy trigger to show loader maybe, wait, handleSaveClientData does it
                        await handleSaveClientData(editingClient);
                        await handleSaveMqttConfig(editingClient);
                        // After saving both, close
                        setEditingClient(null);
                      }}
                      disabled={updatingClient[editingClient] || connectingMqtt[editingClient] || !editingClientData[editingClient]?.name || !hasChanges}
                      fill="solid"
                      expand="block"
                      style={{ '--background': '#3eaa76', '--border-radius': '12px', 'height': '48px', 'margin': '0' }}
                      className="w-full text-sm font-semibold shadow-lg"
                    >
                      {(updatingClient[editingClient] || connectingMqtt[editingClient]) ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> GUARDANDO...</>
                      ) : !hasChanges ? (
                        <><Save className="w-5 h-5 mr-2" /> SIN CAMBIOS</>
                      ) : (
                        <><Edit2 className="w-5 h-5 mr-2" /> GUARDAR {changesCount} CAMBIO{changesCount > 1 ? 'S' : ''}</>
                      )}
                    </IonButton>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Clients List */}
      {clients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No hay clientes registrados</p>
          <p className="text-xs text-gray-400 mt-1">Crea tu primer cliente para comenzar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div
              key={client._id}
              className={cn(
                "bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-all",
                !client.isActive && "opacity-60"
              )}
            >
              {/* Mode: display only. Edit is handled by the full-page overlay. */}
              <div className="p-5">
                {/* Client Header: Icon + Name + MQTT Badge + ID */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-[#3eaa76]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-lg text-gray-900 dark:text-white">{client.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {mqttStatuses[client._id] && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider",
                          mqttStatuses[client._id].isConnected
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        )}>
                          {mqttStatuses[client._id].isConnected ? (
                            <><Wifi className="w-3 h-3" /> MQTT Conectado</>
                          ) : mqttStatuses[client._id].isActive ? (
                            <><WifiOff className="w-3 h-3" /> MQTT Desconectado</>
                          ) : (
                            <><WifiOff className="w-3 h-3" /> MQTT Inactivo</>
                          )}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        ID: {client.code}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit / Delete buttons */}
                <div className="flex justify-end gap-1 mt-2">
                  <button
                    onClick={() => setEditingClient(client._id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 active:scale-95 transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteModalState({
                        isOpen: true,
                        type: 'client',
                        targetId: client._id
                      });
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                </div>

                {/* Description */}
                {client.description && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Descripción</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{client.description}</p>
                  </div>
                )}

                {/* ABRIR MONITOR + Prueba buttons */}
                <div className="mt-5 flex items-center gap-3 flex-wrap">
                  <IonButton
                    onClick={() => handleOpenClient(client.code)}
                    style={{
                      '--background': '#3eaa76',
                      '--border-radius': '10px',
                      '--padding-start': '18px',
                      '--padding-end': '18px',
                      'height': '44px',
                      'margin': '0'
                    } as any}
                    className="text-sm font-bold shadow-sm"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    ABRIR MONITOR
                  </IonButton>
                  {client.notificationTopic && (
                    <button
                      onClick={() => handleTestNotification(client._id)}
                      disabled={testingNotification[client._id]}
                      className="inline-flex items-center gap-2 border border-blue-400 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-[0.98] font-bold text-xs tracking-wider uppercase px-5 py-3 rounded-2xl transition-all disabled:opacity-50"
                      title="Enviar notificación de prueba"
                    >
                      {testingNotification[client._id] ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                      ) : (
                        <>📢 Prueba</>
                      )}
                    </button>
                  )}
                </div>

                {/* Map Image */}
                {client.mapImage && (
                  <div className="mt-4">
                    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                      <img
                        src={client.mapImage}
                        alt={`Mapa de ${client.name}`}
                        className="w-full object-contain max-h-56"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />

      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, type: null, targetId: null })}
        onConfirm={() => {
          if (deleteModalState.targetId) {
            if (deleteModalState.type === 'client') {
              handleDeleteClient(deleteModalState.targetId);
            } else if (deleteModalState.type === 'map') {
              handleDeleteMapImage(deleteModalState.targetId);
            }
          }
        }}
        title={deleteModalState.type === 'map' ? 'Eliminar mapa' : 'Eliminar cliente'}
        description={deleteModalState.type === 'map' ? 'El mapa del cliente será removido' : 'Remover dato seleccionado'}
      />
    </div>
  );
}
