import { useEffect, useState } from 'react';
import {
  getAreas,
  createArea,
  deleteArea,
  updateArea,
  getLocations,
  createLocation,
  deleteLocation,
  updateLocation,
  getParameters,
  createParameter,
  deleteParameter,
  updateParameter,
  getSetpoints,
  createSetpoint,
  deleteSetpoint,
  updateSetpoint,
  getClients
} from '../utils/api';
import { useClient } from '@/hooks/useClient';
import { Card, CardContent } from '@/components/ui/card';
import { IonButton, IonSelect, IonSelectOption } from '@ionic/react';

import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, X, MapPin, Settings, Gauge, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';

interface Area {
  _id: string;
  name: string;
  description?: string;
}

interface Location {
  _id: string;
  name: string;
  description?: string;
  message?: string;
  status?: 'info' | 'warning' | 'danger' | 'success';
  areaId: string | { _id: string; name?: string };
}

interface Parameter {
  _id: string;
  name: string;
  unit: string;
  topic: string;
  description?: string;
  locationId: string | { _id: string; name?: string };
  type?: 'sensor' | 'status';
  decimals?: number;
}

interface Setpoint {
  _id: string;
  minValue: number;
  maxValue: number | null;
  color: string;
  label?: string;
  condition: 'normal' | 'warning' | 'critical';
  notificationsEnabled: boolean;
  notificationCondition: 'inside' | 'outside';
  isActive: boolean;
  parameterId: string;
}

interface Client {
  _id: string;
  name: string;
  code: string;
}

export default function Areas() {
  const { clientCode } = useClient();
  const isAdminView = !clientCode;
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState('');
  const effectiveClientCode = clientCode || selectedClientCode || undefined;
  const [activeTab, setActiveTab] = useState('areas');
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedLocationAreaAccordion, setSelectedLocationAreaAccordion] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedParameterLocationAccordion, setSelectedParameterLocationAccordion] = useState<string>('');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [setpoints, setSetpoints] = useState<Record<string, Setpoint[]>>({});
  const [loading, setLoading] = useState(true);
  const isClientSelected = Boolean(effectiveClientCode);
  const getLocationAreaId = (location: Location) =>
    typeof location.areaId === 'string' ? location.areaId : location.areaId?._id;
  const getParameterLocationId = (parameter: Parameter) =>
    typeof parameter.locationId === 'string' ? parameter.locationId : parameter.locationId?._id;

  // Loading states for create/update operations
  const [creatingArea, setCreatingArea] = useState(false);
  const [updatingArea, setUpdatingArea] = useState<Record<string, boolean>>({});
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState<Record<string, boolean>>({});
  const [creatingParameter, setCreatingParameter] = useState(false);
  const [updatingParameter, setUpdatingParameter] = useState<Record<string, boolean>>({});
  const [creatingSetpoint, setCreatingSetpoint] = useState<Record<string, boolean>>({});
  const [updatingSetpoint, setUpdatingSetpoint] = useState<Record<string, boolean>>({});

  // Editing states
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editingParameter, setEditingParameter] = useState<string | null>(null);
  const [editingSetpoint, setEditingSetpoint] = useState<string | null>(null);

  // Modals state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: 'area' | 'location' | 'parameter' | 'setpoint' | null;
    targetId: string | null;
  }>({
    isOpen: false,
    type: null,
    targetId: null
  });

  // Editing data states
  const [editingAreaData, setEditingAreaData] = useState<Record<string, { name: string; description: string }>>({});
  const [editingLocationData, setEditingLocationData] = useState<Record<string, { name: string; description: string; message: string; status: 'info' | 'warning' | 'danger' | 'success'; areaId: string }>>({});
  const [editingParameterData, setEditingParameterData] = useState<Record<string, { name: string; unit: string; topic: string; description: string; decimals: number; type: 'sensor' | 'status' }>>({});
  const [editingSetpointData, setEditingSetpointData] = useState<Record<string, { minValue: number; maxValue: number | null; label: string; color: string; condition: 'normal' | 'warning' | 'critical'; notificationsEnabled: boolean; notificationCondition: 'inside' | 'outside' }>>({});

  // New item states
  const [newArea, setNewArea] = useState({ name: '', description: '' });
  const [newAreaClientCode, setNewAreaClientCode] = useState('');
  const [newLocation, setNewLocation] = useState({ name: '', description: '', message: '', status: 'info' as 'info' | 'warning' | 'danger' | 'success', areaId: '' });
  const [newParameter, setNewParameter] = useState({ name: '', unit: '', topic: '', description: '', locationId: '', type: 'sensor' as 'sensor' | 'status', decimals: 2 });
  const [newSetpoint, setNewSetpoint] = useState<Record<string, {
    minValue: number;
    maxValue: number | null;
    color: string;
    label: string;
    condition: 'normal' | 'warning' | 'critical';
    notificationsEnabled: boolean;
    notificationCondition: 'inside' | 'outside';
    isRange: boolean;
  }>>({});
  const filteredSetpointParameters = parameters.filter((param) => {
    const paramLocationId = getParameterLocationId(param);
    if (!newParameter.locationId) return false;
    return paramLocationId === newParameter.locationId;
  });

  useEffect(() => {
    if (isAdminView) {
      loadClients();
    } else {
      setClients([]);
      setSelectedClientCode('');
    }
  }, [isAdminView]);

  useEffect(() => {
    loadData();
  }, [effectiveClientCode, isAdminView]);


  const loadClients = async () => {
    try {
      const response = await getClients();
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      if (isAdminView && !selectedClientCode) {
        setAreas([]);
        setLocations([]);
        setParameters([]);
        setSetpoints({});
        return;
      }
      const [areasRes, locationsRes] = await Promise.all([
        getAreas(effectiveClientCode),
        getLocations(undefined, effectiveClientCode)
      ]);

      setAreas(areasRes.data);
      setLocations(locationsRes.data);

      // Load parameters
      const paramsRes = await getParameters(undefined, effectiveClientCode);
      setParameters(paramsRes.data);

      // Load setpoints for each parameter
      const setpointsMap: Record<string, Setpoint[]> = {};
      for (const param of paramsRes.data) {
        try {
          const setpointRes = await getSetpoints(param._id, effectiveClientCode);
          setpointsMap[param._id] = setpointRes.data;
        } catch (error) {
          setpointsMap[param._id] = [];
        }
      }
      setSetpoints(setpointsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Area CRUD
  const handleCreateArea = async () => {
    const targetClientCode = isAdminView ? newAreaClientCode : clientCode;

    if (isAdminView && !targetClientCode) {
      alert('Seleccione un cliente para la nueva área');
      return;
    }
    // Activate loading immediately
    setCreatingArea(true);

    if (!newArea.name.trim()) {
      setCreatingArea(false);
      return;
    }

    try {
      await createArea(newArea, targetClientCode);
      setNewArea({ name: '', description: '' });
      setNewAreaClientCode('');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al crear área');
    } finally {
      setCreatingArea(false);
    }
  };

  const initializeAreaEditing = (area: Area) => {
    if (!editingAreaData[area._id]) {
      setEditingAreaData(prev => ({
        ...prev,
        [area._id]: {
          name: area.name || '',
          description: area.description || ''
        }
      }));
    }
  };

  const updateAreaEditingField = (areaId: string, field: string, value: string) => {
    setEditingAreaData(prev => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        [field]: value
      }
    }));
  };

  const handleSaveArea = async (id: string) => {
    const areaData = editingAreaData[id];
    if (!areaData) return;

    setUpdatingArea(prev => ({ ...prev, [id]: true }));
    try {
      await updateArea(id, areaData, effectiveClientCode);
      setEditingArea(null);
      setEditingAreaData(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al actualizar área');
    } finally {
      setUpdatingArea(prev => ({ ...prev, [id]: false }));
    }
  };


  const handleDeleteArea = async (id: string) => {
    try {
      await deleteArea(id, effectiveClientCode);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar área');
    }
  };

  // Location CRUD
  const handleCreateLocation = async () => {
    if (isAdminView && !selectedClientCode) {
      alert('Seleccione un cliente para continuar');
      return;
    }
    // Activate loading immediately
    setCreatingLocation(true);

    if (!newLocation.name.trim() || !newLocation.areaId) {
      setCreatingLocation(false);
      return;
    }

    try {
      await createLocation(newLocation, effectiveClientCode);
      setNewLocation({ name: '', description: '', message: '', status: 'info', areaId: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al crear ubicación');
    } finally {
      setCreatingLocation(false);
    }
  };

  const initializeLocationEditing = (location: Location) => {
    if (!editingLocationData[location._id]) {
      setEditingLocationData(prev => ({
        ...prev,
        [location._id]: {
          name: location.name || '',
          description: location.description || '',
          message: location.message || '',
          status: location.status || 'info',
          areaId: getLocationAreaId(location) || ''
        }
      }));
    }
  };

  const updateLocationEditingField = (locationId: string, field: string, value: string) => {
    setEditingLocationData(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [field]: value
      }
    }));
  };

  const handleSaveLocation = async (id: string) => {
    const locationData = editingLocationData[id];
    if (!locationData) return;

    setUpdatingLocation(prev => ({ ...prev, [id]: true }));
    try {
      await updateLocation(id, {
        name: locationData.name,
        description: locationData.description,
        message: locationData.message,
        status: locationData.status,
        areaId: locationData.areaId
      }, effectiveClientCode);
      setEditingLocation(null);
      setEditingLocationData(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al actualizar ubicación');
    } finally {
      setUpdatingLocation(prev => ({ ...prev, [id]: false }));
    }
  };


  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteLocation(id, effectiveClientCode);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar ubicación');
    }
  };

  // Parameter CRUD
  const handleCreateParameter = async () => {
    if (isAdminView && !selectedClientCode) {
      alert('Seleccione un cliente para continuar');
      return;
    }
    // Activate loading immediately
    setCreatingParameter(true);

    if (!newParameter.name.trim() || !newParameter.topic.trim() || !newParameter.locationId) {
      setCreatingParameter(false);
      return;
    }
    if (newParameter.type === 'sensor' && !newParameter.unit.trim()) {
      setCreatingParameter(false);
      return;
    }

    try {
      const paramData = {
        ...newParameter,
        unit: newParameter.type === 'status' ? 'Estado' : newParameter.unit
      };
      await createParameter(paramData, effectiveClientCode);
      setNewParameter({ name: '', unit: '', topic: '', description: '', locationId: '', type: 'sensor', decimals: 2 });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al crear parámetro');
    } finally {
      setCreatingParameter(false);
    }
  };


  const initializeParameterEditing = (parameter: Parameter) => {
    if (!editingParameterData[parameter._id]) {
      setEditingParameterData(prev => ({
        ...prev,
        [parameter._id]: {
          name: parameter.name || '',
          unit: parameter.unit || '',
          topic: parameter.topic || '',
          description: parameter.description || '',
          decimals: parameter.decimals || 2,
          type: parameter.type || 'sensor'
        }
      }));
    }
  };

  const updateParameterEditingField = (parameterId: string, field: string, value: string | number) => {
    setEditingParameterData(prev => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        [field]: value
      }
    }));
  };

  const handleSaveParameter = async (id: string) => {
    const parameterData = editingParameterData[id];
    if (!parameterData) return;

    setUpdatingParameter(prev => ({ ...prev, [id]: true }));
    try {
      await updateParameter(id, {
        name: parameterData.name,
        unit: parameterData.type === 'status' ? 'Estado' : parameterData.unit,
        topic: parameterData.topic,
        description: parameterData.description,
        decimals: parameterData.decimals,
        type: parameterData.type
      }, effectiveClientCode);
      setEditingParameter(null);
      setEditingParameterData(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al actualizar parámetro');
    } finally {
      setUpdatingParameter(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteParameter = async (id: string) => {
    try {
      await deleteParameter(id, effectiveClientCode);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar parámetro');
    }
  };

  // Setpoint CRUD
  const handleCreateSetpoint = async (parameterId: string) => {
    if (isAdminView && !selectedClientCode) {
      alert('Seleccione un cliente para continuar');
      return;
    }
    // Activate loading immediately
    setCreatingSetpoint(prev => ({ ...prev, [parameterId]: true }));

    const data = newSetpoint[parameterId];
    if (!data || (data.isRange ? (data.minValue === null && data.maxValue === null) : (data.minValue === null || data.minValue === undefined))) {
      setCreatingSetpoint(prev => {
        const newState = { ...prev };
        delete newState[parameterId];
        return newState;
      });
      return;
    }

    try {
      const setpointData = {
        minValue: data.minValue,
        maxValue: data.isRange ? (data.maxValue !== null && data.maxValue !== undefined ? data.maxValue : null) : null,
        color: data.color,
        label: data.label,
        condition: data.condition,
        notificationsEnabled: data.notificationsEnabled,
        notificationCondition: data.notificationCondition
      };
      await createSetpoint(parameterId, setpointData, effectiveClientCode);
      setNewSetpoint(prev => {
        const updated = { ...prev };
        delete updated[parameterId];
        return updated;
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al crear setpoint');
    } finally {
      setCreatingSetpoint(prev => {
        const newState = { ...prev };
        delete newState[parameterId];
        return newState;
      });
    }
  };

  const initializeSetpointEditing = (setpoint: Setpoint) => {
    if (!editingSetpointData[setpoint._id]) {
      setEditingSetpointData(prev => ({
        ...prev,
        [setpoint._id]: {
          minValue: setpoint.minValue || 0,
          maxValue: setpoint.maxValue,
          label: setpoint.label || '',
          color: setpoint.color || '#3eaa76',
          condition: setpoint.condition || 'normal',
          notificationsEnabled: setpoint.notificationsEnabled || false,
          notificationCondition: setpoint.notificationCondition || 'outside'
        }
      }));
    }
  };

  const updateSetpointEditingField = (setpointId: string, field: string, value: number | string | boolean | null) => {
    setEditingSetpointData(prev => ({
      ...prev,
      [setpointId]: {
        ...prev[setpointId],
        [field]: value
      }
    }));
  };

  const handleSaveSetpoint = async (id: string, _parameterId: string) => {
    const setpointData = editingSetpointData[id];
    if (!setpointData) return;

    setUpdatingSetpoint(prev => ({ ...prev, [id]: true }));
    try {
      await updateSetpoint(id, setpointData, effectiveClientCode);
      setEditingSetpoint(null);
      setEditingSetpointData(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al actualizar setpoint');
    } finally {
      setUpdatingSetpoint(prev => ({ ...prev, [id]: false }));
    }
  };


  const handleDeleteSetpoint = async (id: string) => {
    try {
      await deleteSetpoint(id, effectiveClientCode);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar setpoint');
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-[#3eaa76]">
          Gestión de Áreas y Ubicaciones
        </h2>
        <p className="text-muted-foreground mt-2">
          Configure áreas, ubicaciones, parámetros y setpoints con edición en línea
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex w-full bg-transparent p-1 border-none pb-4">
          <div className="grid grid-cols-4 w-full gap-1 sm:gap-2">
            {/* Tab: Áreas */}
            <IonButton
              fill="clear"
              onClick={() => setActiveTab('areas')}
              className={`m-0 w-full rounded-2xl sm:rounded-3xl transition-all font-semibold normal-case
                ${activeTab === 'areas'
                  ? '!bg-[#5fb380] !text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex flex-col xl:flex-row items-center justify-center gap-1 xl:space-x-2 py-1">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] sm:text-[11px] md:text-sm tracking-tight truncate">Áreas</span>
              </div>
            </IonButton>

            {/* Tab: Ubicaciones */}
            <IonButton
              fill="clear"
              onClick={() => setActiveTab('locations')}
              className={`m-0 w-full rounded-2xl sm:rounded-3xl transition-all font-semibold normal-case
                ${activeTab === 'locations'
                  ? '!bg-[#5fb380] !text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex flex-col xl:flex-row items-center justify-center gap-1 xl:space-x-2 py-1">
                <Settings className="w-4 h-4" />
                <span className="text-[10px] sm:text-[11px] md:text-sm tracking-tight truncate">Ubicaciones</span>
              </div>
            </IonButton>

            {/* Tab: Parámetros */}
            <IonButton
              fill="clear"
              onClick={() => setActiveTab('parameters')}
              className={`m-0 w-full rounded-2xl sm:rounded-3xl transition-all font-semibold normal-case
                ${activeTab === 'parameters'
                  ? '!bg-[#5fb380] !text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex flex-col xl:flex-row items-center justify-center gap-1 xl:space-x-2 py-1">
                <Gauge className="w-4 h-4" />
                <span className="text-[10px] sm:text-[11px] md:text-sm tracking-tight truncate">Parámetros</span>
              </div>
            </IonButton>

            {/* Tab: Setpoints */}
            <IonButton
              fill="clear"
              onClick={() => setActiveTab('setpoints')}
              className={`m-0 w-full rounded-2xl sm:rounded-3xl transition-all font-semibold normal-case
                ${activeTab === 'setpoints'
                  ? '!bg-[#5fb380] !text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <div className="flex flex-col xl:flex-row items-center justify-center gap-1 xl:space-x-2 py-1">
                <Gauge className="w-4 h-4" />
                <span className="text-[10px] sm:text-[11px] md:text-sm tracking-tight truncate">Setpoints</span>
              </div>
            </IonButton>
          </div>
        </div>

        {/* Areas Tab */}
        <TabsContent value="areas" className="space-y-4">
          <div className="bg-[#F0FDF4] p-6 rounded-2xl mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Áreas</h3>
            <p className="text-sm text-gray-500">Gestione las áreas del sistema</p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              {/* Clients List */}
              {isAdminView && clients.length > 0 && (
                <div className="mb-8">
                  <div className="flex flex-col border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#3eaa76]/50">
                    {clients.map((client, index) => (
                      <div key={client._id} className={cn("flex flex-col group", index !== clients.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : "")}>
                        <button
                          type="button"
                          onClick={() => setSelectedClientCode(selectedClientCode === client.code ? '' : client.code)}
                          className="w-full flex items-center justify-between px-5 py-4 min-h-[50px] bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors outline-none"
                        >
                          <span className="text-[15px] font-bold text-gray-900 dark:text-white transition-colors">{client.name}</span>
                          <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform duration-300", selectedClientCode === client.code ? "rotate-180" : "")} />
                        </button>

                        <div className={cn(
                          "transition-all duration-300 ease-in-out overflow-hidden",
                          selectedClientCode === client.code ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                        )}>
                          <div className="flex flex-col border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                            {areas.length > 0 ? areas.map((area, index) => (
                              <div key={area._id} className={cn("flex items-center gap-4 px-6 py-4 bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50", index !== areas.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : "")}>
                                {editingArea === area._id ? (
                                  <div className="w-full flex flex-col gap-4">
                                    {(() => {
                                      if (!editingAreaData[area._id]) {
                                        initializeAreaEditing(area);
                                      }
                                      return null;
                                    })()}
                                    <div className="grid grid-cols-1 gap-4">
                                      <div className="float-group">
                                        <input
                                          type="text"
                                          value={editingAreaData[area._id]?.name || ''}
                                          onChange={(e) => updateAreaEditingField(area._id, 'name', e.target.value)}
                                          disabled={updatingArea[area._id]}
                                          placeholder=" "
                                          className="float-input font-semibold"
                                        />
                                        <label className="float-label font-bold text-gray-500 uppercase tracking-wider text-[10px]">NOMBRE</label>
                                      </div>
                                      <div className="float-group">
                                        <input
                                          type="text"
                                          value={editingAreaData[area._id]?.description || ''}
                                          onChange={(e) => updateAreaEditingField(area._id, 'description', e.target.value)}
                                          disabled={updatingArea[area._id]}
                                          placeholder=" "
                                          className="float-input"
                                        />
                                        <label className="float-label font-bold text-gray-500 uppercase tracking-wider text-[10px]">DESCRIPCIÓN</label>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <IonButton
                                        fill="solid"
                                        size="small"
                                        onClick={() => handleSaveArea(area._id)}
                                        disabled={updatingArea[area._id] || !editingAreaData[area._id]}
                                        className="font-bold text-white rounded shadow-sm"
                                        style={{ '--background': '#3eaa76', '--background-hover': '#338f61', '--padding-top': '0.75rem', '--padding-bottom': '0.75rem', '--padding-start': '1.5rem', '--padding-end': '1.5rem' }}
                                      >
                                        {updatingArea[area._id] ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Guardando...
                                          </>
                                        ) : (
                                          'GUARDAR'
                                        )}
                                      </IonButton>
                                      <IonButton
                                        fill="clear"
                                        onClick={() => {
                                          setEditingAreaData(prev => {
                                            const newState = { ...prev };
                                            delete newState[area._id];
                                            return newState;
                                          });
                                          setEditingArea(null);
                                        }}
                                      >
                                        <X className="w-5 h-5 text-gray-500" />
                                      </IonButton>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex-1 overflow-hidden">
                                      <h4 className="font-medium text-[17px] text-[#1c2b36] dark:text-gray-100 truncate">{area.name}</h4>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0 bg-transparent">
                                      <button
                                        type="button"
                                        onClick={() => setEditingArea(area._id)}
                                        className="p-2 text-gray-500 hover:text-[#3eaa76] hover:bg-emerald-50 rounded-full transition-colors"
                                      >
                                        <Edit2 className="w-[18px] h-[18px] stroke-[1.5]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteModalState({ isOpen: true, type: 'area', targetId: area._id })}
                                        className="p-2 text-[#e53e3e] hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                      >
                                        <Trash2 className="w-[18px] h-[18px] stroke-[1.5]" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )) : (
                              <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                                <p className="text-sm text-gray-500 italic">No hay áreas asociadas a este cliente.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Area Form */}
              <div className="mb-8 p-6 bg-white rounded-2xl border border-dashed border-gray-300">
                <h3 className="font-semibold text-gray-700 mb-6 flex items-center space-x-2 text-lg">
                  <Plus className="w-5 h-5" />
                  <span>Nueva Área</span>
                </h3>
                <div className="grid grid-cols-1 gap-4 mb-6">
                  {isAdminView && (
                    <div className="float-group">
                      <IonSelect
                        value={newAreaClientCode}
                        onIonChange={e => setNewAreaClientCode(e.detail.value)}
                        placeholder="Seleccione Cliente"
                        interface="action-sheet"
                        cancelText="Cancelar"
                        className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#60B883]/50 focus:border-transparent transition-all"
                      >
                        {clients.map(client => (
                          <IonSelectOption key={client._id} value={client.code}>
                            {client.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                      {/* <label className="float-label">Cliente *</label> */}
                    </div>
                  )}
                  <div className="float-group">
                    <input
                      type="text"
                      id="area-name"
                      value={newArea.name}
                      onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Nombre *</label>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="area-desc"
                      value={newArea.description}
                      onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Descripción</label>
                  </div>
                </div>
                <IonButton
                  onClick={handleCreateArea}
                  disabled={creatingArea || (isAdminView && !newAreaClientCode)}
                  className="font-bold rounded-xl shadow-sm uppercase tracking-wider text-xs"
                  style={{ '--background': '#A0D1B4', '--background-hover': '#3eaa76', '--color': '#ffffff', '--padding-top': '1rem', '--padding-bottom': '1rem', '--padding-start': '1rem', '--padding-end': '1rem' }}
                >
                  {creatingArea ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      CREANDO...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      CREAR ÁREA
                    </>
                  )}
                </IonButton>
              </div>


            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <div className="bg-[#F4FCE3] p-6 rounded-2xl mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Ubicaciones</h3>
            <p className="text-sm text-gray-500">Gestione las ubicaciones dentro de las áreas</p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              {/* Areas List with Locations Accordion */}
              {areas.length > 0 && (
                <div className="mb-8">
                  <div className="flex flex-col border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#3eaa76]/50">
                    {areas.map((area, index) => (
                      <div key={area._id} className={cn("flex flex-col group", index !== areas.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : "")}>
                        <button
                          type="button"
                          onClick={() => setSelectedLocationAreaAccordion(selectedLocationAreaAccordion === area._id ? '' : area._id)}
                          className="w-full flex items-center justify-between px-5 py-4 min-h-[50px] bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors outline-none"
                        >
                          <span className="text-[15px] font-bold text-gray-900 dark:text-white transition-colors uppercase tracking-wider">{area.name}</span>
                          <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform duration-300", selectedLocationAreaAccordion === area._id ? "rotate-180" : "")} />
                        </button>

                        <div className={cn(
                          "transition-all duration-300 ease-in-out overflow-hidden",
                          selectedLocationAreaAccordion === area._id ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                        )}>
                          <div className="flex flex-col border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                            {(() => {
                              const areaLocations = locations.filter(loc => getLocationAreaId(loc) === area._id);

                              return areaLocations.length > 0 ? areaLocations.map((location, locIndex) => (
                                <div key={location._id} className={cn("flex items-center gap-4 px-6 py-4 bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50", locIndex !== areaLocations.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : "")}>
                                  {editingLocation === location._id ? (
                                    <div className="w-full flex flex-col gap-4">
                                      {(() => {
                                        if (!editingLocationData[location._id]) {
                                          initializeLocationEditing(location);
                                        }
                                        return null;
                                      })()}
                                      <div className="grid grid-cols-1 gap-4">
                                        <div className="float-group">
                                          <input
                                            type="text"
                                            value={editingLocationData[location._id]?.name || ''}
                                            onChange={(e) => updateLocationEditingField(location._id, 'name', e.target.value)}
                                            disabled={updatingLocation[location._id]}
                                            placeholder=" "
                                            className="float-input font-semibold"
                                          />
                                          <label className="float-label font-bold text-gray-500 uppercase tracking-wider text-[10px]">NOMBRE</label>
                                        </div>
                                        <div className="float-group">
                                          <input
                                            type="text"
                                            value={editingLocationData[location._id]?.description || ''}
                                            onChange={(e) => updateLocationEditingField(location._id, 'description', e.target.value)}
                                            disabled={updatingLocation[location._id]}
                                            placeholder=" "
                                            className="float-input"
                                          />
                                          <label className="float-label font-bold text-gray-500 uppercase tracking-wider text-[10px]">DESCRIPCIÓN</label>
                                        </div>
                                        <IonSelect
                                          value={editingLocationData[location._id]?.areaId || ''}
                                          onIonChange={(e) => updateLocationEditingField(location._id, 'areaId', e.detail.value)}
                                          disabled={updatingLocation[location._id]}
                                          className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm focus:outline-none transition-all"
                                        >
                                          {areas.map((a) => (
                                            <IonSelectOption key={a._id} value={a._id}>{a.name}</IonSelectOption>
                                          ))}
                                        </IonSelect>
                                        <div className="float-group">
                                          <input
                                            type="text"
                                            value={editingLocationData[location._id]?.message || ''}
                                            onChange={(e) => updateLocationEditingField(location._id, 'message', e.target.value)}
                                            disabled={updatingLocation[location._id]}
                                            placeholder=" "
                                            className="float-input"
                                          />
                                          <label className="float-label font-bold text-gray-500 uppercase tracking-wider text-[10px]">MENSAJE PARA EL DASHBOARD</label>
                                        </div>
                                        <IonSelect
                                          value={editingLocationData[location._id]?.status || 'info'}
                                          onIonChange={(e) => updateLocationEditingField(location._id, 'status', e.detail.value)}
                                          disabled={updatingLocation[location._id]}
                                          className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm focus:outline-none transition-all"
                                        >
                                          <IonSelectOption value="info">Info</IonSelectOption>
                                          <IonSelectOption value="warning">Warning</IonSelectOption>
                                          <IonSelectOption value="danger">Danger</IonSelectOption>
                                          <IonSelectOption value="success">Success</IonSelectOption>
                                        </IonSelect>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <IonButton
                                          fill="solid"
                                          size="small"
                                          onClick={() => handleSaveLocation(location._id)}
                                          disabled={updatingLocation[location._id] || !editingLocationData[location._id]}
                                          className="font-bold text-white rounded shadow-sm"
                                          style={{ '--background': '#3eaa76', '--background-hover': '#338f61', '--padding-top': '0.75rem', '--padding-bottom': '0.75rem', '--padding-start': '1.5rem', '--padding-end': '1.5rem' }}
                                        >
                                          {updatingLocation[location._id] ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Guardando...
                                            </>
                                          ) : (
                                            'GUARDAR'
                                          )}
                                        </IonButton>
                                        <IonButton
                                          fill="clear"
                                          onClick={() => {
                                            setEditingLocationData(prev => {
                                              const newState = { ...prev };
                                              delete newState[location._id];
                                              return newState;
                                            });
                                            setEditingLocation(null);
                                          }}
                                        >
                                          <X className="w-5 h-5 text-gray-500" />
                                        </IonButton>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex-1 overflow-hidden">
                                        <h4 className="font-medium text-[17px] text-[#1c2b36] dark:text-gray-100 truncate">
                                          {location.name}
                                        </h4>
                                        {location.description && <p className="text-sm text-gray-500 mt-1">{location.description}</p>}
                                      </div>
                                      <div className="flex items-center space-x-1 shrink-0 bg-transparent">
                                        <button
                                          type="button"
                                          onClick={() => setEditingLocation(location._id)}
                                          className="p-2 text-gray-500 hover:text-[#3eaa76] hover:bg-emerald-50 rounded-full transition-colors"
                                        >
                                          <Edit2 className="w-[18px] h-[18px] stroke-[1.5]" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteModalState({ isOpen: true, type: 'location', targetId: location._id });
                                          }}
                                          className="p-2 text-[#e53e3e] hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                          <Trash2 className="w-[18px] h-[18px] stroke-[1.5]" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )) : (
                                <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl m-4">
                                  <p className="text-sm text-gray-500 italic">No hay ubicaciones asociadas a esta área.</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Location Form */}
              <div className="mb-8 p-6 bg-white rounded-2xl border border-dashed border-gray-300">
                <h3 className="font-semibold text-gray-700 mb-6 flex items-center space-x-2 text-lg">
                  <Plus className="w-5 h-5" />
                  <span>Nueva Ubicación</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label htmlFor="location-area">Área *</Label>
                    <IonSelect
                      id="location-area"
                      value={newLocation.areaId}
                      onIonChange={(e) => setNewLocation({ ...newLocation, areaId: e.detail.value })}
                      placeholder="Seleccione área"
                      className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#60B883]/50 focus:border-transparent transition-all"
                    >
                      {areas.map((area) => (
                        <IonSelectOption key={area._id} value={area._id}>{area.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="location-name"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Nombre *</label>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="location-desc"
                      value={newLocation.description}
                      onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Descripción</label>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="location-message"
                      value={newLocation.message}
                      onChange={(e) => setNewLocation({ ...newLocation, message: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Mensaje</label>
                  </div>
                  <div>
                    <Label htmlFor="location-status">Estado</Label>
                    <IonSelect
                      id="location-status"
                      value={newLocation.status}
                      onIonChange={(e) => setNewLocation({ ...newLocation, status: e.detail.value as 'info' | 'warning' | 'danger' | 'success' })}
                      className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#60B883]/50 focus:border-transparent transition-all"
                    >
                      <IonSelectOption value="info">Info</IonSelectOption>
                      <IonSelectOption value="warning">Warning</IonSelectOption>
                      <IonSelectOption value="danger">Danger</IonSelectOption>
                      <IonSelectOption value="success">Success</IonSelectOption>
                    </IonSelect>
                  </div>
                </div>
                <IonButton
                  onClick={handleCreateLocation}
                  disabled={creatingLocation || (isAdminView && !isClientSelected)}
                  className="font-bold rounded-xl shadow-sm uppercase tracking-wider text-xs"
                  style={{ '--background': '#3eaa76', '--background-hover': '#b0d283', '--color': '#ffffff', '--padding-top': '1.25rem', '--padding-bottom': '1.25rem', '--padding-start': '1.5rem', '--padding-end': '1.5rem' }}
                >
                  {creatingLocation ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      CREANDO...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      CREAR UBICACIÓN
                    </>
                  )}
                </IonButton>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-4">
          <div className="bg-[#E6F8F6] p-6 rounded-2xl mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Parámetros</h3>
            <p className="text-sm text-gray-500">Gestione los parámetros de monitoreo</p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              {/* Locations List with Parameters Accordion */}
              {locations.length > 0 && (
                <div className="mb-8">
                  <div className="flex flex-col border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#3eaa76]/50">
                    {locations.map((location, index) => {
                      const area = areas.find(a => a._id === getLocationAreaId(location));
                      return (
                        <div key={location._id} className={cn("flex flex-col group", index !== locations.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : "")}>
                          <button
                            type="button"
                            onClick={() => setSelectedParameterLocationAccordion(selectedParameterLocationAccordion === location._id ? '' : location._id)}
                            className="w-full flex flex-col items-start px-5 py-3 min-h-[50px] bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors outline-none"
                          >
                            <div className="w-full flex items-center justify-between">
                              <span className="text-[15px] font-bold text-gray-900 dark:text-white transition-colors uppercase tracking-wider">{location.name}</span>
                              <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform duration-300", selectedParameterLocationAccordion === location._id ? "rotate-180" : "")} />
                            </div>
                            {area && (
                              <span className="text-xs text-gray-400 mt-1">{area.name}</span>
                            )}
                          </button>

                          <div className={cn(
                            "transition-all duration-300 ease-in-out overflow-hidden",
                            selectedParameterLocationAccordion === location._id ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                          )}>
                            <div className="flex flex-col border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                              {(() => {
                                const locationParameters = parameters.filter((parameter) => {
                                  return getParameterLocationId(parameter) === location._id;
                                });

                                return locationParameters.length > 0 ? locationParameters.map((parameter) => {
                                  return (
                                    <div key={parameter._id} className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-muted/50 transition-colors">
                                      {editingParameter === parameter._id ? (
                                        <div className="space-y-4">
                                          {(() => {
                                            if (!editingParameterData[parameter._id]) {
                                              initializeParameterEditing(parameter);
                                            }
                                            return null;
                                          })()}
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="float-group">
                                              <input
                                                type="text"
                                                value={editingParameterData[parameter._id]?.name || ''}
                                                onChange={(e) => updateParameterEditingField(parameter._id, 'name', e.target.value)}
                                                disabled={updatingParameter[parameter._id]}
                                                placeholder=" "
                                                className="float-input"
                                              />
                                              <label className="float-label">Nombre</label>
                                            </div>
                                            <div>
                                              <Label>Tipo</Label>
                                              <IonSelect
                                                value={editingParameterData[parameter._id]?.type || 'sensor'}
                                                onIonChange={(e) => updateParameterEditingField(parameter._id, 'type', e.detail.value as 'sensor' | 'status')}
                                                disabled={updatingParameter[parameter._id]}
                                                className="flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-0 text-sm"
                                              >
                                                <IonSelectOption value="sensor">Sensor (Valor numérico)</IonSelectOption>
                                                <IonSelectOption value="status">Estado (ON/OFF)</IonSelectOption>
                                              </IonSelect>
                                            </div>
                                            <div className="float-group">
                                              <input
                                                type="text"
                                                value={editingParameterData[parameter._id]?.unit || ''}
                                                onChange={(e) => updateParameterEditingField(parameter._id, 'unit', e.target.value)}
                                                disabled={parameter.type === 'status' || updatingParameter[parameter._id]}
                                                placeholder=" "
                                                className="float-input"
                                              />
                                              <label className="float-label">Unidad</label>
                                            </div>
                                            <div className="float-group">
                                              <input
                                                type="number"
                                                min={0}
                                                max={6}
                                                value={editingParameterData[parameter._id]?.decimals ?? 2}
                                                onChange={(e) => {
                                                  const value = Math.max(0, Math.min(6, Number(e.target.value)));
                                                  updateParameterEditingField(parameter._id, 'decimals', Number.isNaN(value) ? 2 : value);
                                                }}
                                                disabled={updatingParameter[parameter._id]}
                                                placeholder=" "
                                                className="float-input"
                                              />
                                              <label className="float-label">Decimales</label>
                                            </div>
                                            <div className="float-group md:col-span-2">
                                              <input
                                                type="text"
                                                value={editingParameterData[parameter._id]?.topic || ''}
                                                onChange={(e) => updateParameterEditingField(parameter._id, 'topic', e.target.value)}
                                                disabled={updatingParameter[parameter._id]}
                                                placeholder=" "
                                                className="float-input"
                                              />
                                              <label className="float-label">Tópico MQTT</label>
                                            </div>
                                            <div className="float-group md:col-span-2">
                                              <textarea
                                                value={editingParameterData[parameter._id]?.description || ''}
                                                onChange={(e) => updateParameterEditingField(parameter._id, 'description', e.target.value)}
                                                disabled={updatingParameter[parameter._id]}
                                                placeholder=" "
                                                className="float-textarea resize-none"
                                              />
                                              <label className="float-label">Descripción</label>
                                            </div>
                                          </div>
                                          <div className="flex gap-2 items-center">
                                            <IonButton
                                              fill="solid"
                                              size="small"
                                              onClick={() => handleSaveParameter(parameter._id)}
                                              disabled={updatingParameter[parameter._id] || !editingParameterData[parameter._id]}
                                              className="font-bold text-white rounded shadow-sm"
                                              style={{ '--background': '#3eaa76', '--background-hover': '#338f61', '--padding-top': '0.75rem', '--padding-bottom': '0.75rem', '--padding-start': '1.5rem', '--padding-end': '1.5rem' }}
                                            >
                                              {updatingParameter[parameter._id] ? (
                                                <>
                                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                  Guardando...
                                                </>
                                              ) : (
                                                'GUARDAR'
                                              )}
                                            </IonButton>
                                            <IonButton
                                              fill="clear"
                                              onClick={() => {
                                                setEditingParameterData(prev => {
                                                  const newState = { ...prev };
                                                  delete newState[parameter._id];
                                                  return newState;
                                                });
                                                setEditingParameter(null);
                                              }}
                                            >
                                              <X className="w-5 h-5 text-gray-500" />
                                            </IonButton>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center space-x-2 mb-2">
                                              <h4 className="font-semibold text-[15px] sm:text-[16px] text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{parameter.name}</h4>
                                              {parameter.type === 'status' && (
                                                <span className="text-[10px] sm:text-xs bg-purple-100 text-purple-800 px-2 py-0.5 sm:py-1 rounded font-medium whitespace-nowrap shrink-0">
                                                  Estado
                                                </span>
                                              )}
                                              <span className="text-[11px] sm:text-xs text-gray-500 whitespace-nowrap shrink-0 block mt-[1px]">({parameter.unit})</span>
                                            </div>
                                            <p className="text-[12px] sm:text-[13px] font-mono text-gray-500 mb-1 break-all leading-tight">{parameter.topic}</p>
                                            {parameter.description && (
                                              <p className="text-[12px] sm:text-[13px] text-gray-400 leading-tight">{parameter.description}</p>
                                            )}
                                          </div>
                                          <div className="flex items-center space-x-1 shrink-0 bg-transparent">
                                            <button
                                              type="button"
                                              onClick={() => setEditingParameter(parameter._id)}
                                              className="p-2 text-gray-500 hover:text-[#3eaa76] hover:bg-emerald-50 rounded-full transition-colors"
                                            >
                                              <Edit2 className="w-[18px] h-[18px] stroke-[1.5]" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteModalState({ isOpen: true, type: 'parameter', targetId: parameter._id });
                                              }}
                                              className="p-2 text-[#e53e3e] hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                            >
                                              <Trash2 className="w-[18px] h-[18px] stroke-[1.5]" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }) : (
                                  <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl m-4">
                                    <p className="text-sm text-gray-500 italic">No hay parámetros asociados a esta ubicación.</p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New Parameter Form */}
              <div className="mb-8 p-6 bg-white rounded-2xl border border-dashed border-gray-300">
                <h3 className="font-semibold text-gray-700 mb-6 flex items-center space-x-2 text-lg">
                  <Plus className="w-5 h-5" />
                  <span>Nuevo Parámetro</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label htmlFor="param-location">Ubicación *</Label>
                    <IonSelect
                      id="param-location"
                      value={newParameter.locationId}
                      onIonChange={(e) => setNewParameter({ ...newParameter, locationId: e.detail.value })}
                      placeholder="Seleccione ubicación"
                      className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#60B883]/50 focus:border-transparent transition-all"
                    >
                      {locations
                        .filter((loc) => !newLocation.areaId || getLocationAreaId(loc) === newLocation.areaId)
                        .map((loc) => {
                          const area = areas.find(a => a._id === getLocationAreaId(loc));
                          return (
                            <IonSelectOption key={loc._id} value={loc._id}>
                              {area?.name} - {loc.name}
                            </IonSelectOption>
                          );
                        })}
                    </IonSelect>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="param-name"
                      value={newParameter.name}
                      onChange={(e) => setNewParameter({ ...newParameter, name: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Nombre *</label>
                  </div>
                  <div>
                    <Label htmlFor="param-type">Tipo *</Label>
                    <IonSelect
                      id="param-type"
                      value={newParameter.type}
                      onIonChange={(e) => {
                        const type = e.detail.value as 'sensor' | 'status';
                        setNewParameter({
                          ...newParameter,
                          type,
                          unit: type === 'status' ? 'Estado' : newParameter.unit === 'Estado' ? '' : newParameter.unit
                        });
                      }}
                      className="flex min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-0 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#60B883]/50 focus:border-transparent transition-all"
                    >
                      <IonSelectOption value="sensor">Sensor (Valor numérico)</IonSelectOption>
                      <IonSelectOption value="status">Estado (ON/OFF)</IonSelectOption>
                    </IonSelect>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="param-unit"
                      value={newParameter.unit}
                      onChange={(e) => setNewParameter({ ...newParameter, unit: e.target.value })}
                      placeholder=" "
                      disabled={newParameter.type === 'status'}
                      className="float-input"
                    />
                    <label className="float-label">Unidad {newParameter.type === 'status' ? '(Estado)' : '*'}</label>
                  </div>
                  <div className="float-group">
                    <input
                      type="text"
                      id="param-topic"
                      value={newParameter.topic}
                      onChange={(e) => setNewParameter({ ...newParameter, topic: e.target.value })}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Tópico MQTT *</label>
                  </div>
                  <div className="float-group">
                    <input
                      id="param-decimals"
                      type="number"
                      min={0}
                      max={6}
                      value={newParameter.decimals}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(6, Number(e.target.value)));
                        setNewParameter({ ...newParameter, decimals: Number.isNaN(value) ? 2 : value });
                      }}
                      placeholder=" "
                      className="float-input"
                    />
                    <label className="float-label">Decimales *</label>
                  </div>
                  <div className="float-group lg:col-span-3">
                    <textarea
                      id="param-desc"
                      value={newParameter.description}
                      onChange={(e) => setNewParameter({ ...newParameter, description: e.target.value })}
                      placeholder=" "
                      className="float-textarea min-h-[48px] resize-none"
                    />
                    <label className="float-label">Descripción</label>
                  </div>
                </div>
                <IonButton
                  onClick={handleCreateParameter}
                  disabled={creatingParameter || (isAdminView && !isClientSelected)}
                  className="font-bold rounded-xl shadow-sm uppercase tracking-wider text-xs"
                  style={{ '--background': '#3eaa76', '--background-hover': '#8ecbca', '--color': '#ffffff', '--padding-top': '1.25rem', '--padding-bottom': '1.25rem', '--padding-start': '1.5rem', '--padding-end': '1.5rem' }}
                >
                  {creatingParameter ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      CREANDO...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      CREAR PARÁMETRO
                    </>
                  )}
                </IonButton>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Setpoints Tab */}
        <TabsContent value="setpoints" className="space-y-4">
          <div className="bg-[#E0F7FA] p-6 rounded-2xl mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Setpoints</h3>
            <p className="text-sm text-gray-500">Configure los setpoints para cada parámetro</p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <div className="space-y-6">
                {parameters
                  .filter((parameter) => {
                    const paramLocationId = getParameterLocationId(parameter);
                    if (!newParameter.locationId) return false;
                    return paramLocationId === newParameter.locationId;
                  })
                  .map((parameter) => {
                    const paramLocationId = getParameterLocationId(parameter);
                    const location = locations.find(l => l._id === paramLocationId);
                    const area = location ? areas.find(a => a._id === location.areaId) : null;
                    const paramSetpoints = setpoints[parameter._id] || [];
                    const newSetpointData = newSetpoint[parameter._id] || {
                      minValue: 0,
                      maxValue: null,
                      color: '#FF0000',
                      label: '',
                      condition: 'normal',
                      notificationsEnabled: false,
                      notificationCondition: 'outside',
                      isRange: false
                    };

                    return (
                      <div key={parameter._id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{parameter.name}</h4>
                            {area && location && (
                              <p className="text-xs text-muted-foreground">{area.name} → {location.name}</p>
                            )}
                          </div>
                        </div>

                        {/* New Setpoint Form - Compact */}
                        <div className="p-4 bg-white rounded-2xl border border-dashed border-gray-300 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {/* Range Values */}
                            <div className="md:col-span-2">
                              <div className="flex items-center space-x-2 h-full">
                                <div className="float-group w-full h-full flex items-center">
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder=" "
                                    value={newSetpointData.minValue !== null && newSetpointData.minValue !== undefined ? newSetpointData.minValue : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const numVal = val === '' ? null : parseFloat(val);
                                      setNewSetpoint({
                                        ...newSetpoint,
                                        [parameter._id]: {
                                          ...newSetpointData,
                                          minValue: numVal !== null && !isNaN(numVal) ? numVal : 0
                                        }
                                      });
                                    }}
                                    className="float-input"
                                  />
                                  <label className="float-label">Min *</label>
                                </div>
                                <span className="text-muted-foreground">-</span>
                                <div className="float-group w-full h-full flex items-center">
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder=" "
                                    value={newSetpointData.maxValue !== null && newSetpointData.maxValue !== undefined ? newSetpointData.maxValue : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const numVal = val === '' ? null : parseFloat(val);
                                      setNewSetpoint({
                                        ...newSetpoint,
                                        [parameter._id]: {
                                          ...newSetpointData,
                                          maxValue: numVal !== null && !isNaN(numVal) ? numVal : null,
                                          isRange: val !== '' && !isNaN(parseFloat(val))
                                        }
                                      });
                                    }}
                                    className="float-input"
                                  />
                                  <label className="float-label">Max</label>
                                </div>
                              </div>
                            </div>

                            {/* Label */}
                            <div className="h-full flex items-center">
                              <div className="float-group w-full">
                                <input
                                  type="text"
                                  placeholder=" "
                                  value={newSetpointData.label}
                                  onChange={(e) => setNewSetpoint({
                                    ...newSetpoint,
                                    [parameter._id]: { ...newSetpointData, label: e.target.value }
                                  })}
                                  className="float-input"
                                />
                                <label className="float-label">Etiqueta</label>
                              </div>
                            </div>

                            {/* Color Palette */}
                            <div>
                              <Label className="text-xs font-semibold mb-1 block">Color</Label>
                              <div className="flex items-center flex-wrap gap-1.5">
                                {['#3eaa76', '#9EE538', '#51E8D4', '#0091A0', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E'].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewSetpoint({
                                      ...newSetpoint,
                                      [parameter._id]: { ...newSetpointData, color }
                                    })}
                                    className={cn(
                                      "w-5 h-8 rounded-sm transition-all duration-200 border-2",
                                      newSetpointData.color === color
                                        ? "border-gray-900 ring-1 ring-offset-1 ring-gray-400 scale-105"
                                        : "border-gray-200 hover:scale-105"
                                    )}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                                <div className="relative ml-1 flex items-center justify-center">
                                  <input
                                    type="color"
                                    value={newSetpointData.color}
                                    onChange={(e) => setNewSetpoint({
                                      ...newSetpoint,
                                      [parameter._id]: { ...newSetpointData, color: e.target.value }
                                    })}
                                    className="h-8 w-8 cursor-pointer opacity-0 absolute inset-0 z-10"
                                  />
                                  <div
                                    className="w-8 h-8 rounded-sm border-2 border-gray-200 flex items-center justify-center transition-all duration-200 hover:border-gray-400"
                                    style={{ backgroundColor: newSetpointData.color }}
                                    title="Personalizado"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Condition & Notifications */}
                            <div>
                              <Label className="text-xs font-semibold mb-2 block text-gray-700">Opciones</Label>
                              <div className="flex flex-col space-y-2">
                                <IonSelect
                                  value={newSetpointData.condition}
                                  onIonChange={(e) => setNewSetpoint({
                                    ...newSetpoint,
                                    [parameter._id]: { ...newSetpointData, condition: e.detail.value as 'normal' | 'warning' | 'critical' }
                                  })}
                                  className="flex min-h-[40px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-0 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#60B883]/50 focus:border-transparent transition-all"
                                >
                                  <IonSelectOption value="normal">Normal</IonSelectOption>
                                  <IonSelectOption value="warning">Advertencia</IonSelectOption>
                                  <IonSelectOption value="critical">Crítico</IonSelectOption>
                                </IonSelect>
                                <label className="flex items-center gap-1 space-x-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={newSetpointData.notificationsEnabled}
                                    onChange={(e) => setNewSetpoint({
                                      ...newSetpoint,
                                      [parameter._id]: { ...newSetpointData, notificationsEnabled: e.target.checked }
                                    })}
                                    className="h-3 w-3"
                                  />
                                  <span className="text-xs">Notificaciones</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Notification Condition - Only if enabled */}
                          {newSetpointData.notificationsEnabled && (
                            <div className="flex items-center space-x-2 pt-2 border-t">
                              <Label className="text-xs">Alertar cuando:</Label>
                              <IonSelect
                                value={newSetpointData.notificationCondition}
                                onIonChange={(e) => setNewSetpoint({
                                  ...newSetpoint,
                                  [parameter._id]: { ...newSetpointData, notificationCondition: e.detail.value as 'inside' | 'outside' }
                                })}
                                className="flex min-h-[32px] flex-1 rounded-md border border-input bg-background px-2 py-0 text-xs max-w-xs"
                              >
                                <IonSelectOption value="outside">Fuera del rango</IonSelectOption>
                                <IonSelectOption value="inside">Dentro del rango</IonSelectOption>
                              </IonSelect>
                            </div>
                          )}

                          <IonButton
                            onClick={() => handleCreateSetpoint(parameter._id)}
                            disabled={creatingSetpoint[parameter._id] || (isAdminView && !isClientSelected)}
                            className="w-full mt-2 font-bold rounded-xl shadow-sm uppercase tracking-wider text-xs"
                            style={{ '--background': '#3eaa76', '--background-hover': '#8ecb2f', '--color': '#ffffff', '--padding-top': '1rem', '--padding-bottom': '1rem' }}
                          >
                            {creatingSetpoint[parameter._id] ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                CREANDO...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-1.5" />
                                AGREGAR SETPOINT
                              </>
                            )}
                          </IonButton>
                        </div>

                        {/* Visual Range Bar - Compact */}
                        {paramSetpoints.length > 0 && (() => {
                          const sortedSetpoints = [...paramSetpoints].sort((a, b) => a.minValue - b.minValue);
                          const minValue = Math.min(...sortedSetpoints.map(s => s.minValue));
                          const maxValue = Math.max(...sortedSetpoints.map(s => s.maxValue || s.minValue));
                          const range = maxValue - minValue || 1;

                          return (
                            <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-semibold">Vista de Rangos</Label>
                                <span className="text-xs text-muted-foreground">
                                  {sortedSetpoints.length} {sortedSetpoints.length === 1 ? 'rango' : 'rangos'} • {parameter.unit}
                                </span>
                              </div>
                              <div className="relative h-8 bg-gray-100 rounded overflow-hidden border border-gray-200">
                                {sortedSetpoints.map((setpoint) => {
                                  const leftPercent = ((setpoint.minValue - minValue) / range) * 100;
                                  const widthPercent = setpoint.maxValue !== null
                                    ? ((setpoint.maxValue - setpoint.minValue) / range) * 100
                                    : Math.max(3, 100 / sortedSetpoints.length); // Min 3% or equal distribution

                                  return (
                                    <div
                                      key={setpoint._id}
                                      className="absolute h-full opacity-85 hover:opacity-100 transition-opacity border-r border-white/50"
                                      style={{
                                        left: `${leftPercent}%`,
                                        width: `${widthPercent}%`,
                                        backgroundColor: setpoint.color,
                                        minWidth: '20px'
                                      }}
                                      title={`${setpoint.label || 'Rango'}: ${setpoint.minValue}${setpoint.maxValue !== null ? ` - ${setpoint.maxValue}` : ''} ${parameter.unit}`}
                                    >
                                      {widthPercent > 15 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold px-1 truncate">
                                          {setpoint.label || `${setpoint.minValue}${setpoint.maxValue !== null ? `-${setpoint.maxValue}` : ''}`}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {/* Scale markers */}
                                <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-[10px] text-gray-500">
                                  <span>{minValue.toFixed(1)}</span>
                                  <span>{maxValue.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Setpoints List - Compact */}
                        <div className="space-y-2">
                          {(() => {
                            // Sort setpoints by minValue
                            const sortedSetpoints = [...paramSetpoints].sort((a, b) => a.minValue - b.minValue);
                            return sortedSetpoints.map((setpoint) => (
                              <div
                                key={setpoint._id}
                                className="flex items-center gap-2 p-2 rounded-lg border transition-all hover:shadow-sm"
                                style={{
                                  borderColor: setpoint.color,
                                  backgroundColor: `${setpoint.color}08`
                                }}
                              >
                                {editingSetpoint === setpoint._id ? (
                                  <>
                                    {(() => {
                                      if (!editingSetpointData[setpoint._id]) {
                                        initializeSetpointEditing(setpoint);
                                      }
                                      return null;
                                    })()}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                                      <div className="flex items-center space-x-1">
                                        <div className="float-group w-full">
                                          <input
                                            type="number"
                                            step="any"
                                            value={editingSetpointData[setpoint._id]?.minValue ?? 0}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const numVal = val === '' ? 0 : parseFloat(val);
                                              updateSetpointEditingField(setpoint._id, 'minValue', !isNaN(numVal) ? numVal : 0);
                                            }}
                                            disabled={updatingSetpoint[setpoint._id]}
                                            placeholder=" "
                                            className="float-input min-h-[32px] pt-3 pb-1 px-2 text-xs"
                                          />
                                          <label className="float-label text-[10px] top-[10px]">Min</label>
                                        </div>
                                        <span className="text-muted-foreground">-</span>
                                        <div className="float-group w-full">
                                          <input
                                            type="number"
                                            step="any"
                                            value={(editingSetpointData[setpoint._id]?.maxValue ?? null) !== null ? String(editingSetpointData[setpoint._id]!.maxValue) : ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const numVal = val === '' ? null : parseFloat(val);
                                              updateSetpointEditingField(setpoint._id, 'maxValue', numVal !== null && !isNaN(numVal) ? numVal : null);
                                            }}
                                            disabled={updatingSetpoint[setpoint._id]}
                                            placeholder=" "
                                            className="float-input min-h-[32px] pt-3 pb-1 px-2 text-xs"
                                          />
                                          <label className="float-label text-[10px] top-[10px]">Max</label>
                                        </div>
                                      </div>

                                      <div className="float-group">
                                        <input
                                          type="text"
                                          value={editingSetpointData[setpoint._id]?.label || ''}
                                          onChange={(e) => updateSetpointEditingField(setpoint._id, 'label', e.target.value)}
                                          disabled={updatingSetpoint[setpoint._id]}
                                          placeholder=" "
                                          className="float-input min-h-[32px] pt-3 pb-1 px-2 text-xs"
                                        />
                                        <label className="float-label text-[10px] top-[10px]">Etiqueta</label>
                                      </div>

                                      <div className="flex items-center flex-wrap gap-1.5 md:col-span-4 mt-1 mb-1">
                                        {['#3eaa76', '#9EE538', '#51E8D4', '#0091A0', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E'].map((color) => (
                                          <button
                                            key={color}
                                            type="button"
                                            onClick={() => updateSetpointEditingField(setpoint._id, 'color', color)}
                                            disabled={updatingSetpoint[setpoint._id]}
                                            className={cn(
                                              "w-5 h-8 rounded-sm transition-all duration-200 border-2",
                                              editingSetpointData[setpoint._id]?.color === color
                                                ? "border-gray-900 ring-1 ring-offset-1 ring-gray-400 scale-105"
                                                : "border-gray-200 hover:scale-105"
                                            )}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                          />
                                        ))}
                                        <div className="relative ml-1 flex items-center justify-center">
                                          <input
                                            type="color"
                                            value={editingSetpointData[setpoint._id]?.color || '#3eaa76'}
                                            onChange={(e) => updateSetpointEditingField(setpoint._id, 'color', e.target.value)}
                                            disabled={updatingSetpoint[setpoint._id]}
                                            className="h-8 w-8 cursor-pointer opacity-0 absolute inset-0 z-10"
                                          />
                                          <div
                                            className="w-8 h-8 rounded-sm border-2 border-gray-200 flex items-center justify-center transition-all duration-200 hover:border-gray-400"
                                            style={{ backgroundColor: editingSetpointData[setpoint._id]?.color || '#3eaa76' }}
                                            title="Personalizado"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-1">
                                        <IonSelect
                                          value={editingSetpointData[setpoint._id]?.condition || 'normal'}
                                          onIonChange={(e) => updateSetpointEditingField(setpoint._id, 'condition', e.detail.value as 'normal' | 'warning' | 'critical')}
                                          disabled={updatingSetpoint[setpoint._id]}
                                          className="flex min-h-[32px] flex-1 rounded-md border border-input bg-background px-2 py-0 text-xs"
                                        >
                                          <IonSelectOption value="normal">Normal</IonSelectOption>
                                          <IonSelectOption value="warning">Advertencia</IonSelectOption>
                                          <IonSelectOption value="critical">Crítico</IonSelectOption>
                                        </IonSelect>
                                        <label className="flex items-center space-x-1 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={editingSetpointData[setpoint._id]?.notificationsEnabled || false}
                                            onChange={(e) => updateSetpointEditingField(setpoint._id, 'notificationsEnabled', e.target.checked)}
                                            disabled={updatingSetpoint[setpoint._id]}
                                            className="h-3 w-3"
                                          />
                                          <span className="text-xs">🔔</span>
                                        </label>
                                      </div>
                                      <div className="flex gap-2 items-center md:col-span-4 mt-2">
                                        <IonButton
                                          fill="solid"
                                          size="small"
                                          onClick={() => handleSaveSetpoint(setpoint._id, parameter._id)}
                                          disabled={updatingSetpoint[setpoint._id] || !editingSetpointData[setpoint._id]}
                                          className="font-bold text-white rounded shadow-sm text-xs"
                                          style={{ '--background': '#3eaa76', '--background-hover': '#338f61', '--padding-top': '0.5rem', '--padding-bottom': '0.5rem', '--padding-start': '1rem', '--padding-end': '1rem' }}
                                        >
                                          {updatingSetpoint[setpoint._id] ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Guardando...
                                            </>
                                          ) : (
                                            'GUARDAR'
                                          )}
                                        </IonButton>
                                        <IonButton
                                          fill="clear"
                                          onClick={() => {
                                            setEditingSetpointData(prev => {
                                              const newState = { ...prev };
                                              delete newState[setpoint._id];
                                              return newState;
                                            });
                                            setEditingSetpoint(null);
                                          }}
                                        >
                                          <X className="w-5 h-5 text-gray-500" />
                                        </IonButton>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div
                                      className="w-8 h-8 rounded flex-shrink-0 border-2 border-white shadow-sm"
                                      style={{ backgroundColor: setpoint.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-1.5 flex-wrap">
                                        <span className="font-semibold text-sm truncate">
                                          {setpoint.label || `${setpoint.minValue}${setpoint.maxValue !== null ? `-${setpoint.maxValue}` : ''}`}
                                        </span>
                                        <span className={cn(
                                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                          setpoint.condition === 'critical' ? 'bg-red-100 text-red-800' :
                                            setpoint.condition === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                              'bg-green-100 text-green-800'
                                        )}>
                                          {setpoint.condition === 'critical' ? 'Crítico' :
                                            setpoint.condition === 'warning' ? 'Adv' : 'Normal'}
                                        </span>
                                        {setpoint.notificationsEnabled && (
                                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                            🔔
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {setpoint.maxValue !== null
                                          ? `${setpoint.minValue} - ${setpoint.maxValue} ${parameter.unit}`
                                          : `${setpoint.minValue} ${parameter.unit}`
                                        }
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <IonButton
                                        fill="clear"
                                        onClick={() => setEditingSetpoint(setpoint._id)}
                                        className="hover:bg-blue-50"
                                        style={{ width: '28px', height: '28px', '--padding-start': '0', '--padding-end': '0' }}
                                      >
                                        <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                                      </IonButton>
                                      <IonButton
                                        fill="clear"
                                        color="danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteModalState({ isOpen: true, type: 'setpoint', targetId: setpoint._id });
                                        }}
                                        className="hover:bg-red-50"
                                        style={{ width: '28px', height: '28px', '--padding-start': '0', '--padding-end': '0' }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </IonButton>
                                    </div>
                                  </>
                                )}
                              </div>
                            ));
                          })()}
                          {paramSetpoints.length === 0 && (
                            <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">
                                No hay setpoints. Use el formulario arriba para agregar rangos.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {(!newParameter.locationId || filteredSetpointParameters.length === 0) && (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Seleccione una ubicación para ver setpoints.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, type: null, targetId: null })}
        onConfirm={() => {
          if (!deleteModalState.targetId) return;
          const { type, targetId } = deleteModalState;
          if (type === 'area') handleDeleteArea(targetId);
          if (type === 'location') handleDeleteLocation(targetId);
          if (type === 'parameter') handleDeleteParameter(targetId);
          if (type === 'setpoint') handleDeleteSetpoint(targetId);
        }}
        title={
          deleteModalState.type === 'area' ? 'Eliminar Área' :
            deleteModalState.type === 'location' ? 'Eliminar Ubicación' :
              deleteModalState.type === 'parameter' ? 'Eliminar Parámetro' :
                'Eliminar Setpoint'
        }
        description={
          deleteModalState.type === 'area' ? 'Las ubicaciones de esta área quedarán sin grupo' :
            deleteModalState.type === 'location' ? 'Los sensores de esta ubicación quedarán sin grupo' :
              deleteModalState.type === 'parameter' ? 'Se eliminarán también sus setpoints' :
                'Se eliminará este estado y sus notificaciones asociadas'
        }
      />
    </div >
  );
}
