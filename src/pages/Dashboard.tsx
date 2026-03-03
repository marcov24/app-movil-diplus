import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { connectSocket, getSocket } from '../utils/socket';
// Using api client instead of direct API calls
import { useClient } from '../hooks/useClient';
import { createApiClient } from '../utils/apiClient';
import { getClientByCode, getClientMqttStatus, getHistoricalData } from '../utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, Bell, ChevronUp, ChevronDown, X, Power, PowerOff, ArrowLeft, WifiOff, Wifi, MapPin } from 'lucide-react';
import { IonButton, IonSelect, IonSelectOption } from '@ionic/react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { AreaChart, Area as RechartsArea, ResponsiveContainer } from 'recharts';

interface Area {
  _id: string;
  name: string;
  locations: Location[];
}

interface Location {
  _id: string;
  name: string;
  message?: string;
  status?: 'info' | 'warning' | 'danger' | 'success';
  parameters: Parameter[];
}

interface Parameter {
  _id: string;
  name: string;
  unit: string;
  topic: string;
  type?: 'sensor' | 'status';
  decimals?: number;
}

interface SensorData {
  value: number | string;
  type: string;
  timestamp: string | Date;
  timestampNumber?: number;
  createdAt?: string | Date;
  parameterId?: string;
  topic?: string;
}

interface TrendDataPoint {
  timestamp: number;
  value: number;
}

interface Setpoint {
  _id: string;
  minValue: number;
  maxValue: number | null;
  color: string;
  label?: string;
  condition: 'normal' | 'warning' | 'critical';
  parameterId: string;
}

export default function Dashboard() {
  const history = useHistory();
  const { clientCode } = useClient();
  const [structure, setStructure] = useState<Area[]>([]);
  const [latestData, setLatestData] = useState<Record<string, SensorData>>({});
  const [trendData, setTrendData] = useState<Record<string, TrendDataPoint[]>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [setpoints, setSetpoints] = useState<Record<string, Setpoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(true);
  const [mqttStatus, setMqttStatus] = useState<{ isConnected: boolean; isActive: boolean } | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');

  // Create API client with client code
  const api = createApiClient(clientCode);

  useEffect(() => {
    loadData();
    setupSocket();
    loadMqttStatus();

    // Check data freshness every 10 seconds
    const freshnessInterval = setInterval(() => {
      // Force re-render to update stale data indicators
      setLatestData(prev => ({ ...prev }));
    }, 10000);

    // Refresh MQTT status every 30 seconds
    const mqttStatusInterval = setInterval(() => {
      if (clientId) {
        loadMqttStatus();
      }
    }, 30000);

    return () => {
      clearInterval(freshnessInterval);
      clearInterval(mqttStatusInterval);
      const socket = getSocket();
      if (socket) {
        socket.off('sensor-data');
        socket.off('new-alert');
      }
    };
  }, [clientId]);

  const loadMqttStatus = async () => {
    if (!clientCode) return;
    try {
      const clientResponse = await getClientByCode(clientCode);
      const client = clientResponse.data;
      setClientId(client._id);
      setClientName(client.name);

      const statusResponse = await getClientMqttStatus(client._id);
      setMqttStatus({
        isConnected: statusResponse.data.isConnected,
        isActive: statusResponse.data.isActive
      });
    } catch (error) {
      console.error('Error loading MQTT status:', error);
      setMqttStatus(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [structureRes, latestRes, alertsRes] = await Promise.all([
        api.get('/data/structure'),
        api.get('/data/latest'),
        api.get('/alerts/latest').catch(() => ({ data: { data: [] } }))
      ]);

      const structureArray = structureRes.data.data || structureRes.data;
      setStructure(structureArray);

      const dataMap: Record<string, SensorData> = {};
      const latestArray = latestRes.data?.data || latestRes.data || [];
      latestArray.forEach((item: { parameter: Parameter; latestData: SensorData }) => {
        if (item.latestData && item.parameter._id) {
          dataMap[item.parameter._id] = item.latestData;
        }
      });
      setLatestData(dataMap);
      setAlerts(alertsRes.data?.data || alertsRes.data || []);

      // Load 24h trend data for all parameters (parallelized)
      const trendMap: Record<string, TrendDataPoint[]> = {};
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

      // Collect all parameters first
      const allParameters: Parameter[] = [];
      for (const area of structureArray) {
        for (const location of area.locations) {
          for (const parameter of location.parameters) {
            allParameters.push(parameter);
          }
        }
      }

      // Load all historical data in parallel
      const historicalPromises = allParameters.map(async (parameter) => {
        try {
          const historicalRes = await getHistoricalData(
            parameter._id,
            twentyFourHoursAgo,
            now,
            1440 // 24 hours * 60 minutes = max data points
          );
          const rawData = historicalRes.data.data || historicalRes.data;
          const points = rawData.map((item: any) => ({
            timestamp: item.createdAt
              ? new Date(item.createdAt).getTime()
              : (typeof item.timestamp === 'string'
                ? new Date(item.timestamp).getTime()
                : (item.timestampNumber || new Date(item.timestamp).getTime())),
            value: item.value
          })).filter((point: TrendDataPoint) => point.timestamp >= twentyFourHoursAgo);
          return { parameterId: parameter._id, points };
        } catch (error) {
          console.error(`Error loading trend for parameter ${parameter._id}:`, error);
          return { parameterId: parameter._id, points: [] };
        }
      });

      // Wait for all historical data requests to complete
      const historicalResults = await Promise.all(historicalPromises);
      historicalResults.forEach(({ parameterId, points }) => {
        trendMap[parameterId] = points;
      });
      setTrendData(trendMap);

      // Load setpoints for all parameters (parallelized)
      const setpointsMap: Record<string, Setpoint[]> = {};

      // Load all setpoints in parallel
      const setpointPromises = allParameters.map(async (parameter) => {
        try {
          const setpointRes = await api.get(`/parameters/${parameter._id}/setpoints`);
          const rawSetpoints = setpointRes.data.data || setpointRes.data || [];
          const formattedSetpoints = rawSetpoints.map((sp: any) => ({
            ...sp,
            minValue: typeof sp.minValue === 'string'
              ? parseFloat(sp.minValue.replace(',', '.'))
              : Number(sp.minValue),
            maxValue: sp.maxValue === null || sp.maxValue === undefined
              ? null
              : (typeof sp.maxValue === 'string'
                ? parseFloat(sp.maxValue.replace(',', '.'))
                : Number(sp.maxValue))
          }));
          return { parameterId: parameter._id, setpoints: formattedSetpoints };
        } catch (error) {
          return { parameterId: parameter._id, setpoints: [] };
        }
      });

      // Wait for all setpoint requests to complete
      const setpointResults = await Promise.all(setpointPromises);
      setpointResults.forEach(({ parameterId, setpoints }) => {
        setpointsMap[parameterId] = setpoints;
      });
      setSetpoints(setpointsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecordTimeMs = (data: SensorData) => {
    if (data.createdAt) {
      return new Date(data.createdAt).getTime();
    }
    if (data.timestampNumber) {
      return data.timestampNumber;
    }
    return new Date(data.timestamp).getTime();
  };

  const isStaleData = (data?: SensorData) => {
    if (!data) return true;
    const dataTime = getRecordTimeMs(data);
    return Date.now() - dataTime > 60000;
  };

  const updateTrendData = (parameterId: string, value: number, timestamp: number) => {
    setTrendData(prev => {
      const currentData = prev[parameterId] || [];
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

      // Add new data point
      const newData = [...currentData, { timestamp, value }];

      // Remove data points older than 24 hours
      const filteredData = newData.filter(point => point.timestamp >= twentyFourHoursAgo);

      return {
        ...prev,
        [parameterId]: filteredData
      };
    });
  };

  const setupSocket = () => {
    const socket = connectSocket();

    socket.on('sensor-data', (data: SensorData) => {
      if (data.parameterId) {
        setLatestData(prev => ({
          ...prev,
          [data.parameterId!]: data
        }));

        // Update trend data
        const timestamp = getRecordTimeMs(data);
        const numeric = typeof data.value === 'string'
          ? parseFloat(data.value.replace(',', '.').replace(/[^0-9.+-]/g, ''))
          : Number(data.value);
        if (!Number.isNaN(numeric)) {
          updateTrendData(data.parameterId, numeric, timestamp);
        }

      }
    });

    socket.on('new-alert', (alert: any) => {
      setAlerts(prev => [alert, ...prev].slice(0, 5));
    });

    // Reload setpoints when they might be updated
    socket.on('setpoint-updated', async () => {
      const structureRes = await api.get('/data/structure');
      const structureArray = structureRes.data.data || structureRes.data;
      const setpointsMap: Record<string, Setpoint[]> = {};
      for (const area of structureArray) {
        for (const location of area.locations) {
          for (const parameter of location.parameters) {
            try {
              const setpointRes = await api.get(`/parameters/${parameter._id}/setpoints`);
              const rawSetpoints = setpointRes.data.data || setpointRes.data || [];
              setpointsMap[parameter._id] = rawSetpoints.map((sp: any) => ({
                ...sp,
                minValue: typeof sp.minValue === 'string'
                  ? parseFloat(sp.minValue.replace(',', '.'))
                  : Number(sp.minValue),
                maxValue: sp.maxValue === null || sp.maxValue === undefined
                  ? null
                  : (typeof sp.maxValue === 'string'
                    ? parseFloat(sp.maxValue.replace(',', '.'))
                    : Number(sp.maxValue))
              }));
            } catch (error) {
              setpointsMap[parameter._id] = [];
            }
          }
        }
      }
      setSetpoints(setpointsMap);
    });
  };

  const getParameterValue = (parameterId: string) => {
    const data = latestData[parameterId];
    if (!data) return null;

    const rawValue = data.value;
    let numericValue: number;
    if (typeof rawValue === 'string') {
      const normalized = rawValue.replace(',', '.').replace(/[^0-9.+-]/g, '');
      numericValue = parseFloat(normalized);
    } else {
      numericValue = Number(rawValue);
    }
    return Number.isNaN(numericValue) ? null : numericValue;
  };

  const getParameterSetpointColor = (parameterId: string, value: number | null): string => {
    // Default green color if no value or no setpoints
    if (value === null) return '#3eaa76';

    const paramSetpoints = setpoints[parameterId] || [];
    if (paramSetpoints.length === 0) return '#3eaa76';

    // Sort setpoints by minValue to check in order
    const sortedSetpoints = [...paramSetpoints].sort((a, b) => a.minValue - b.minValue);

    // Find the setpoint that matches the current value
    for (const setpoint of sortedSetpoints) {
      if (setpoint.maxValue !== null && setpoint.maxValue !== undefined) {
        // Range setpoint: check if value is within range
        if (value >= setpoint.minValue && value <= setpoint.maxValue) {
          return setpoint.color;
        }
      } else {
        // Open-ended setpoint: value >= minValue
        if (value >= setpoint.minValue) {
          return setpoint.color;
        }
      }
    }

    // If no setpoint matches, return default green
    return '#3eaa76';
  };

  const formatValue = (value: number, parameter: Parameter) => {
    const decimals = parameter.decimals ?? 2;
    return value.toFixed(decimals);
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    const bigint = parseInt(cleanHex.length === 3
      ? cleanHex.split('').map((c) => c + c).join('')
      : cleanHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getTimelineStops = (parameterId: string, trend: TrendDataPoint[]) => {
    if (!trend || trend.length === 0) {
      return [
        { offset: '0%', color: '#3eaa76' },
        { offset: '100%', color: '#3eaa76' }
      ];
    }
    const colors = trend.map(point => getParameterSetpointColor(parameterId, point.value));
    const stops: Array<{ offset: string; color: string }> = [];
    const lastIndex = colors.length - 1;

    stops.push({ offset: '0%', color: colors[0] });
    for (let i = 1; i <= lastIndex; i += 1) {
      if (colors[i] !== colors[i - 1]) {
        const pct = `${((i / lastIndex) * 100).toFixed(2)}%`;
        stops.push({ offset: pct, color: colors[i - 1] });
        stops.push({ offset: pct, color: colors[i] });
      }
    }
    if (!stops.find(stop => stop.offset === '100%')) {
      stops.push({ offset: '100%', color: colors[lastIndex] });
    } else {
      stops[stops.length - 1] = { offset: '100%', color: colors[lastIndex] };
    }
    return stops;
  };



  const getStatusValue = (value: number | null): { text: string; color: string; icon: any } => {
    if (value === null) {
      return { text: 'Sin datos', color: '#9CA3AF', icon: PowerOff };
    }
    // Consider status: 0 or false = OFF, 1 or true = ON
    // Could also be: < 0.5 = OFF, >= 0.5 = ON
    if (value === 0 || value < 0.5) {
      return { text: 'OFF', color: '#EF4444', icon: PowerOff };
    } else {
      return { text: 'ON', color: '#3eaa76', icon: Power };
    }
  };

  const formatTimestamp = (timestamp: string | Date | number) => {
    if (typeof timestamp === 'string' || timestamp instanceof Date) {
      return new Date(timestamp).toLocaleString('es-ES');
    }
    return new Date(timestamp).toLocaleString('es-ES');
  };

  // Get status for each location (first status parameter found per location)
  const getLocationStatus = (location: Location): { status: { text: string; color: string; icon: any }; hasStatus: boolean } => {
    const statusParam = location.parameters.find(param => param.type === 'status');
    if (!statusParam) {
      return { status: { text: 'Sin estado', color: '#9CA3AF', icon: Activity }, hasStatus: false };
    }
    const value = getParameterValue(statusParam._id);
    return { status: getStatusValue(value), hasStatus: true };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (structure.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>No hay áreas configuradas</CardTitle>
          <CardDescription>Comienza configurando áreas y ubicaciones</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }


  return (
    <div className="space-y-4 md:space-y-8 w-full">
      {/* Header - Full Width */}
      <div className="w-screen bg-background relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">

        {/* Top row: Client Back Button with bottom border */}
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

        <div className="w-full flex flex-col gap-3 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-3 pb-3">
          {/* Dashboard Title & Badge */}
          <div className="flex justify-between items-center gap-2">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-none">
              Dashboard SCADA
            </h2>
            {mqttStatus && (
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                mqttStatus.isConnected
                  ? "bg-green-50 text-[#3eaa76] border-green-200 dark:bg-green-950/30 dark:border-green-800/50"
                  : mqttStatus.isActive
                    ? "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800/50"
                    : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
              )}>
                {mqttStatus.isConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    <span>MQTT Conectado</span>
                  </>
                ) : mqttStatus.isActive ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>MQTT Desconectado</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>MQTT Inactivo</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Alertas button (full width) */}
          <div className="w-full mb-1">
            <Link to={clientCode ? `/${clientCode}/alerts` : '/alerts'} className="block w-full">
              <IonButton
                fill="clear"
                className="w-full md:w-auto rounded-xl border border-green-500 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 transition-all m-0 h-auto min-h-[44px] normal-case text-sm font-medium"
                style={{
                  '--border-radius': '8px',
                  '--padding-start': '16px',
                  '--padding-end': '16px',
                  '--padding-top': '8px',
                  '--padding-bottom': '8px'
                }}
              >
                <Bell className="w-4 h-4 mr-1" />
                <span className="font-semibold tracking-wide">Alertas</span>
              </IonButton>
            </Link>
          </div>

          {/* Area Filter */}
          {structure.length > 0 && (
            <div className="w-full mt-2 relative">
              <div className="flex items-center absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-[#3eaa76]">
                <MapPin className="w-4 h-4" />
              </div>
              <IonSelect
                value={selectedAreaId}
                onIonChange={e => setSelectedAreaId(e.detail.value)}
                placeholder="Seleccione Área..."
                interface="action-sheet"
                cancelText="Cancelar"
                className="flex items-center min-h-[44px] w-full rounded-xl border-2 border-green-100 bg-white dark:bg-gray-800 dark:border-gray-700 pl-10 pr-4 py-0 text-[15px] font-semibold text-gray-800 dark:text-gray-100 focus:outline-none transition-all shadow-sm"
              >
                <IonSelectOption value="all">Todas las Áreas</IonSelectOption>
                {structure.map(area => (
                  <IonSelectOption key={area._id} value={area._id}>
                    {area.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </div>
          )}
        </div>
      </div>

      <div className="w-full">
        <div className="space-y-4 md:space-y-8">
          {structure
            .filter(area => selectedAreaId === 'all' || area._id === selectedAreaId)
            .map((area) => (
              <Card key={area._id} className="border-2 shadow-lg transition-colors duration-200 rounded-xl overflow-hidden">
                <CardHeader className="bg-[#e9f5f0] border-0 p-4 transition-colors duration-200">
                  <CardTitle className="text-xl sm:text-2xl text-[#3eaa76] transition-colors duration-200 font-semibold">{area.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-4 md:p-6 pb-6 border-t">
                  {area.locations.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No hay ubicaciones en esta área</p>
                  ) : (
                    <div className="space-y-4 md:space-y-6">
                      {area.locations.map((location) => {
                        const locationStatus = getLocationStatus(location);
                        const StatusIcon = locationStatus.status.icon;
                        const statusParam = location.parameters.find(param => param.type === 'status');
                        const statusValue = statusParam ? getParameterValue(statusParam._id) : null;

                        return (
                          <div key={location._id} className="space-y-3 md:space-y-4">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <div className="w-1.5 h-5 bg-[#3eaa76] rounded-full flex-shrink-0"></div>
                              <h4 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide truncate flex-1">{location.name}</h4>
                              {locationStatus.hasStatus && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                                    statusValue === null || statusValue < 0.5
                                      ? "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-400/30 dark:border-red-600/50"
                                      : "bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-400/30 dark:border-green-600/50"
                                  )}
                                >
                                  <div className={cn(
                                    "w-2 h-2 rounded-full flex-shrink-0",
                                    statusValue === null || statusValue < 0.5
                                      ? "bg-red-500"
                                      : "bg-green-500"
                                  )}></div>
                                  <StatusIcon
                                    className={cn(
                                      "w-3.5 h-3.5 flex-shrink-0",
                                      statusValue === null || statusValue < 0.5
                                        ? "text-red-600"
                                        : "text-green-600"
                                    )}
                                  />
                                  {locationStatus.status.text}
                                </span>
                              )}
                              {location.message && location.status && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                                    location.status === 'info'
                                      ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-400/30 dark:border-blue-600/50"
                                      : location.status === 'warning'
                                        ? "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-400/30 dark:border-yellow-600/50"
                                        : location.status === 'danger'
                                          ? "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-400/30 dark:border-red-600/50"
                                          : "bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-400/30 dark:border-green-600/50"
                                  )}
                                >
                                  {location.message}
                                </span>
                              )}
                            </div>
                            {location.parameters.filter(p => !p.type || p.type === 'sensor').length === 0 ? (
                              <p className="text-muted-foreground text-sm ml-4">No hay parámetros en esta ubicación</p>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                                {location.parameters
                                  .filter(p => !p.type || p.type === 'sensor')
                                  .map((parameter) => {
                                    const value = getParameterValue(parameter._id);
                                    const data = latestData[parameter._id];
                                    const isStale = isStaleData(data);
                                    const setpointColor = getParameterSetpointColor(parameter._id, value);
                                    const staleColor = '#9CA3AF';
                                    const displayColor = isStale ? staleColor : setpointColor;

                                    return (
                                      <Card
                                        key={parameter._id}
                                        onClick={() => history.push(clientCode ? `/${clientCode}/analysis/${parameter._id}` : `/analysis/${parameter._id}`)}
                                        className={cn(
                                          "cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 rounded-xl card-press"
                                        )}
                                        style={{
                                          borderColor: displayColor,
                                          backgroundColor: hexToRgba(displayColor, 0.08)
                                        }}
                                      >
                                        <CardHeader className="pb-1 p-3 md:p-4 relative">
                                          <div className="flex justify-between items-start gap-1">
                                            <CardTitle className="text-gray-900 dark:text-gray-100 text-sm sm:text-base font-bold flex-1 leading-tight line-clamp-2 pr-4">
                                              {parameter.name}
                                            </CardTitle>
                                            {data && (
                                              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-70">
                                                <span className="text-[10px] whitespace-nowrap hidden sm:inline-block">
                                                  {formatTimestamp(getRecordTimeMs(data)).split(' ')[1]}
                                                </span>
                                                {/* <Clock className="w-3 h-3 flex-shrink-0" /> */}
                                              </div>
                                            )}
                                          </div>
                                        </CardHeader>
                                        <CardContent className="p-3 md:p-4 pt-0">
                                          {value !== null ? (
                                            <div className="space-y-1 sm:space-y-2">
                                              <div className="flex items-end justify-between gap-1">
                                                <div className="flex items-baseline space-x-1 min-w-0">
                                                  <span
                                                    className="text-2xl sm:text-3xl lg:text-4xl font-extrabold whitespace-nowrap"
                                                    style={{ color: displayColor }}
                                                  >
                                                    {isStale ? '---' : formatValue(value, parameter)}
                                                  </span>
                                                  <span
                                                    className="text-xs sm:text-sm font-semibold flex-shrink-0 whitespace-nowrap"
                                                    style={{ color: displayColor }}
                                                  >
                                                    {parameter.unit}
                                                  </span>
                                                </div>
                                                {trendData[parameter._id] && trendData[parameter._id].length > 0 && (
                                                  (() => {
                                                    const trend = trendData[parameter._id];
                                                    const stops = getTimelineStops(parameter._id, trend);
                                                    return (
                                                      <div className="w-12 h-6 sm:w-16 sm:h-8 md:w-20 md:h-10 flex-shrink-0 opacity-80">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                          <AreaChart data={trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                                            <defs>
                                                              <linearGradient id={`gradient-line-${parameter._id}`} x1="0" y1="0" x2="1" y2="0">
                                                                {stops.map((stop, index) => (
                                                                  <stop
                                                                    key={`${parameter._id}-line-${index}`}
                                                                    offset={stop.offset}
                                                                    stopColor={stop.color}
                                                                    stopOpacity={1}
                                                                  />
                                                                ))}
                                                              </linearGradient>
                                                              <linearGradient id={`gradient-fill-${parameter._id}`} x1="0" y1="0" x2="1" y2="0">
                                                                {stops.map((stop, index) => (
                                                                  <stop
                                                                    key={`${parameter._id}-fill-${index}`}
                                                                    offset={stop.offset}
                                                                    stopColor={stop.color}
                                                                    stopOpacity={0.25}
                                                                  />
                                                                ))}
                                                              </linearGradient>
                                                            </defs>
                                                            <RechartsArea
                                                              type="monotone"
                                                              dataKey="value"
                                                              stroke={`url(#gradient-line-${parameter._id})`}
                                                              fill={`url(#gradient-fill-${parameter._id})`}
                                                              strokeWidth={1.5}
                                                              dot={false}
                                                              isAnimationActive={false}
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                            />
                                                          </AreaChart>
                                                        </ResponsiveContainer>
                                                      </div>
                                                    );
                                                  })()
                                                )}
                                              </div>
                                              {isStale ? (
                                                <div className="flex items-start gap-1 rounded-md px-1.5 py-1 mt-2 text-[9px] sm:text-[10px] font-medium bg-gray-200 text-gray-700 w-full">
                                                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                                  <span className="leading-tight whitespace-normal break-words text-left">Alerta equipo sin conexion</span>
                                                </div>
                                              ) : (
                                                <div className="flex items-center space-x-1 mt-1 text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                                                  <Activity className="w-3 h-3 flex-shrink-0" />
                                                  <span className="hidden sm:inline">Click para análisis</span>
                                                  <span className="truncate">Análisis</span>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="space-y-1 sm:space-y-2">
                                              <div className="flex items-baseline space-x-1 min-w-0">
                                                <span
                                                  className="text-2xl sm:text-3xl lg:text-4xl font-extrabold whitespace-nowrap text-muted-foreground"
                                                >
                                                  --
                                                </span>
                                                <span
                                                  className="text-xs sm:text-sm font-semibold flex-shrink-0 whitespace-nowrap text-muted-foreground"
                                                >
                                                  {parameter.unit}
                                                </span>
                                              </div>
                                              {isStale ? (
                                                <div className="flex items-start gap-1 rounded-md px-1.5 py-1 mt-2 text-[9px] sm:text-[10px] font-medium bg-gray-200 text-gray-700 w-full">
                                                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                                  <span className="leading-tight whitespace-normal break-words text-left">Alerta equipo sin conexion</span>
                                                </div>
                                              ) : (
                                                <div className="flex items-center space-x-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                                  <Activity className="w-3 h-3 flex-shrink-0" />
                                                  <span className="truncate">Sin datos recientes</span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Floating Notifications Panel */}
      {alerts.length > 0 && notificationsVisible && (
        <div className={cn(
          "fixed z-50 transition-all duration-300",
          notificationsExpanded
            ? "bottom-4 right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-96 max-w-[calc(100vw-2rem)]"
            : "bottom-4 right-4 w-auto"
        )}>
          <div className={cn(
            "bg-background rounded-lg shadow-2xl border-2 border-[#F97316] dark:border-[#F97316]/70 transition-all duration-300 overflow-hidden",
            notificationsExpanded ? "max-h-[60vh] sm:max-h-[500px]" : ""
          )}>
            {/* Header */}
            <div
              className="bg-[#F97316]/10 dark:bg-[#F97316]/20 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between cursor-pointer border-b border-[#F97316]/20 dark:border-[#F97316]/30"
              onClick={() => setNotificationsExpanded(!notificationsExpanded)}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className="relative">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[#F97316] flex-shrink-0" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {alerts.length > 9 ? '9+' : alerts.length}
                    </span>
                  )}
                </div>
                {notificationsExpanded && (
                  <span className="text-sm sm:text-base font-semibold text-[#F97316] truncate">
                    Alertas ({alerts.length})
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                {notificationsExpanded && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-[#F97316]/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotificationsVisible(false);
                    }}
                  >
                    <X className="w-3.5 h-3.5 text-[#F97316]" />
                  </Button>
                )}
                {notificationsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#F97316]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#F97316]" />
                )}
              </div>
            </div>

            {/* Content */}
            {notificationsExpanded && (
              <div className="max-h-[calc(60vh-3.5rem)] sm:max-h-[450px] overflow-y-auto overscroll-contain">
                <div className="p-2 sm:p-3 space-y-2">
                  {alerts.slice(0, 5).map((alert) => {
                    const parameter = alert.parameterId;
                    return (
                      <div
                        key={alert._id}
                        className={cn(
                          "p-2 sm:p-2.5 rounded-lg border text-xs sm:text-sm transition-all hover:shadow-md",
                          alert.condition === 'critical' ? 'bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
                            alert.condition === 'warning' ? 'bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' :
                              'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                        )}
                      >
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className={cn(
                            "w-4 h-4 mt-0.5 flex-shrink-0",
                            alert.condition === 'critical' ? 'text-red-600' :
                              alert.condition === 'warning' ? 'text-yellow-600' :
                                'text-blue-600'
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                              <span className={cn(
                                "text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded",
                                alert.condition === 'critical' ? 'bg-red-200 text-red-800' :
                                  alert.condition === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                                    'bg-blue-200 text-blue-800'
                              )}>
                                {alert.condition === 'critical' ? 'CRIT' : alert.condition === 'warning' ? 'WARN' : 'INFO'}
                              </span>
                              {parameter && (
                                <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                                  {parameter.name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-foreground line-clamp-2 mb-1 leading-tight">
                              {alert.message}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {alerts.length > 5 && (
                    <Link to={clientCode ? `/${clientCode}/alerts` : '/alerts'} className="block">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs sm:text-sm h-8 sm:h-9 border-[#F97316] text-[#F97316] hover:bg-[#F97316] hover:text-white"
                      >
                        Ver todas ({alerts.length})
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Alert Badge - Only when minimized or hidden */}
      {alerts.length > 0 && !notificationsVisible && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full bg-[#F97316] hover:bg-[#F97316]/90 text-white border-[#F97316] shadow-lg"
            onClick={() => {
              setNotificationsVisible(true);
              setNotificationsExpanded(true);
            }}
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
