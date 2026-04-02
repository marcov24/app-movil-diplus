import { useEffect, useRef, useState, type MouseEvent } from 'react';
// import L from 'leaflet';
import { MapSkeleton } from '../components/Skeletons';
import { useHistory } from 'react-router-dom';
import { getClientByCode, getLocations, getParameters, getSetpoints, updateClientMapMarkersByCode } from '../utils/api';
import { useClient } from '@/hooks/useClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Gauge, ArrowRight, AlertTriangle, ArrowLeft, Map as MapIcon, Info } from 'lucide-react';
import { connectSocket, getSocket } from '@/utils/socket';
import PullToRefresh from '../components/PullToRefresh';
import { IonSelect, IonSelectOption } from '@ionic/react';

interface ClientInfo {
  _id: string;
  name: string;
  mapImage?: string;
  mapMarkers?: Array<{
    locationId: string;
    xPercent: number;
    yPercent: number;
  }>;
}

interface Location {
  _id: string;
  name: string;
  description?: string;
  areaId: string;
}

interface Parameter {
  _id: string;
  name: string;
  unit: string;
  topic: string;
  description?: string;
  locationId: string | { _id: string };
  decimals?: number;
}

interface MapMarker {
  xPercent: number;
  yPercent: number;
}

interface SensorData {
  parameterId: string;
  value: number;
  timestamp?: string | number;
  timestampNumber?: number;
}

interface Setpoint {
  _id: string;
  minValue: number;
  maxValue: number | null;
  color: string;
  parameterId: string;
}

export default function MapPage() {
  const { clientCode } = useClient();
  const history = useHistory();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [parametersByLocation, setParametersByLocation] = useState<Record<string, Parameter[]>>({});
  const [setpointsByParameter, setSetpointsByParameter] = useState<Record<string, Setpoint[]>>({});
  const [markers, setMarkers] = useState<Record<string, MapMarker>>({});
  const [showParameters, setShowParameters] = useState<Record<string, boolean>>({});
  const [latestData, setLatestData] = useState<Record<string, SensorData>>({});

  const loadMapData = async () => {
    if (!clientCode) return;
    try {
      setLoading(true);
      const [clientRes, locationsRes, paramsRes] = await Promise.all([
        getClientByCode(clientCode),
        getLocations(undefined, clientCode),
        getParameters(undefined, clientCode)
      ]);
      setClient(clientRes.data);
      setLocations(locationsRes.data);
      const grouped: Record<string, Parameter[]> = {};
      (paramsRes.data || []).forEach((param: Parameter) => {
        const locId = typeof param.locationId === 'string'
          ? param.locationId
          : param.locationId?._id;
        if (!locId) return;
        if (!grouped[locId]) grouped[locId] = [];
        grouped[locId].push(param);
      });
      setParametersByLocation(grouped);
      const setpointsMap: Record<string, Setpoint[]> = {};
      await Promise.all(
        (paramsRes.data || []).map(async (param: Parameter) => {
          try {
            const res = await getSetpoints(param._id, clientCode);
            setpointsMap[param._id] = res.data || [];
          } catch {
            setpointsMap[param._id] = [];
          }
        })
      );
      setSetpointsByParameter(setpointsMap);
      const markersFromDb = (clientRes.data.mapMarkers || []).reduce(
        (acc: Record<string, MapMarker>, marker: { locationId: string; xPercent: number; yPercent: number }) => {
          acc[marker.locationId] = { xPercent: marker.xPercent, yPercent: marker.yPercent };
          return acc;
        },
        {}
      );
      setMarkers(markersFromDb);
      const showAll: Record<string, boolean> = {};
      Object.keys(markersFromDb).forEach((locId) => {
        showAll[locId] = true;
      });
      setShowParameters(showAll);
    } catch (error) {
      console.error('Error loading map data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientCode) return;
    loadMapData();
  }, [clientCode]);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('sensor-data', (data: SensorData) => {
      if (!data?.parameterId) return;
      setLatestData(prev => ({
        ...prev,
        [data.parameterId]: data
      }));
    });

    return () => {
      const current = getSocket();
      if (current) {
        current.off('sensor-data');
      }
    };
  }, []);

  const getParameterColor = (paramId: string, value?: number) => {
    if (value === undefined || value === null) return '#3eaa76';
    const setpoints = setpointsByParameter[paramId] || [];
    for (const setpoint of setpoints) {
      if (setpoint.maxValue !== null && setpoint.maxValue !== undefined) {
        if (value >= setpoint.minValue && value <= setpoint.maxValue) {
          return setpoint.color;
        }
      } else if (value >= setpoint.minValue) {
        return setpoint.color;
      }
    }
    return '#3eaa76';
  };

  const getParameterBackgroundColor = (color: string) => {
    // Convert hex color to rgba with opacity for background
    // Works well in both light and dark modes
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Use 15% opacity for a subtle background that works in both themes
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  };

  const getRecordTimeMs = (data?: SensorData) => {
    if (!data) return 0;
    if (data.timestampNumber) return data.timestampNumber;
    if (data.timestamp) return new Date(data.timestamp).getTime();
    return 0;
  };

  const isStaleData = (data?: SensorData) => {
    if (!data) return true;
    const time = getRecordTimeMs(data);
    return time ? Date.now() - time > 60000 : true;
  };

  const handleMapDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectedLocationId) {
      alert('Seleccione una ubicación para ver sus parámetros');
      return;
    }
    if (!clientCode) return;
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const nextMarkers = {
      ...markers,
      [selectedLocationId]: {
        xPercent: Math.max(0, Math.min(100, x)),
        yPercent: Math.max(0, Math.min(100, y))
      }
    };
    setMarkers(nextMarkers);
    setShowParameters(prev => ({ ...prev, [selectedLocationId]: true }));
    const payload = Object.entries(nextMarkers).map(([locationId, marker]) => ({
      locationId,
      xPercent: marker.xPercent,
      yPercent: marker.yPercent
    }));
    updateClientMapMarkersByCode(clientCode, payload).catch((error) => {
      console.error('Error saving map markers:', error);
    });
  };

  if (loading) {
    return <MapSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={loadMapData}>
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
              {client?.name || clientCode}
            </h1>
          </div>
        )}

        <div className="w-full flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-3 pb-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 leading-none mb-3">
            Mapa
          </h2>
          <div className="inline-flex items-start sm:items-center gap-2 bg-blue-50/50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100 w-fit max-w-full">
            <Info className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 opacity-80" />
            <p className="text-[13px] font-medium leading-snug">
              Seleccione una ubicación y haga <strong className="font-extrabold">doble clic</strong> sobre el mapa para ver sus parámetros.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="min-h-[60vh] h-[calc(100vh-260px)] flex flex-col border-none shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[20px] overflow-hidden bg-white">
          <CardHeader className="bg-white pb-4 pt-5 px-5">
            <div className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardDescription className="text-xs font-bold text-[#3eaa76] uppercase tracking-wider mb-1">
                  {client?.name || 'Cliente'}
                </CardDescription>
                <CardTitle className="text-[20px] font-extrabold text-slate-800 tracking-tight">Mapa del Cliente</CardTitle>
              </div>
              <div className="flex-1 max-w-[200px] shrink-0">
                <div className="w-full bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-[#3eaa76]/20 focus-within:border-[#3eaa76]/30 relative overflow-hidden">
                  <div className="absolute top-1.5 left-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none z-10">Ubicaciones</div>
                  <IonSelect
                    id="map-location"
                    value={selectedLocationId}
                    onIonChange={(e) => {
                      setSelectedLocationId(e.detail.value);
                      setShowParameters({});
                    }}
                    placeholder="Escoger..."
                    className="flex min-h-[48px] w-full px-3 pt-4 pb-0 text-[14px] font-semibold text-slate-700 focus:outline-none transition-all font-sans"
                    interface="popover"
                  >
                    {locations.map((location) => (
                      <IonSelectOption key={location._id} value={location._id}>
                        {location.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 h-full overflow-hidden bg-white">
            {client?.mapImage ? (
              <div
                ref={mapRef}
                className="relative w-full h-full min-h-[50vh] bg-white cursor-crosshair overflow-hidden"
                style={{
                  backgroundImage: `url(${client.mapImage})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat'
                }}
                onDoubleClick={handleMapDoubleClick}
                title="Doble clic para ver parámetros"
              >
                {Object.entries(markers).map(([locationId, marker]) => {
                  const location = locations.find((loc) => loc._id === locationId);
                  if (!location) return null;
                  const params = parametersByLocation[locationId] || [];
                  return (
                    <div
                      key={locationId}
                      className="absolute"
                      style={{
                        left: `${marker.xPercent}%`,
                        top: `${marker.yPercent}%`,
                        transform: 'translate(-50%, -100%)'
                      }}
                    >
                      <div className="bg-background/80 border rounded-lg shadow-lg p-2 w-56 max-w-[240px] backdrop-blur">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold leading-tight truncate">{location.name}</p>
                        </div>
                        {showParameters[locationId] && (
                          <div className="space-y-2 max-h-56 overflow-y-auto">
                            {params.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Sin parámetros.
                              </p>
                            ) : (
                              params.map((param) => {
                                const value = latestData[param._id]?.value;
                                const decimals = param.decimals ?? 2;
                                const data = latestData[param._id];
                                const isStale = isStaleData(data);
                                const color = isStale ? '#9CA3AF' : getParameterColor(param._id, value);
                                const backgroundColor = getParameterBackgroundColor(color);
                                return (
                                  <div
                                    key={param._id}
                                    className="border rounded-md px-2 py-1.5"
                                    style={{
                                      borderColor: color,
                                      backgroundColor: backgroundColor
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-medium leading-tight truncate min-w-0 flex-1">{param.name}</p>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span
                                          className="text-xs font-semibold whitespace-nowrap"
                                          style={{ color }}
                                        >
                                          {isStale ? '---' : (value !== undefined ? `${value.toFixed(decimals)} ${param.unit}` : '--')}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`Ver análisis de ${param.name}`}
                                          className="rounded-full p-1 text-muted-foreground hover:text-foreground transition"
                                          onClick={() => {
                                            history.push(clientCode ? `/${clientCode}/analysis/${param._id}` : `/analysis/${param._id}`);
                                          }}
                                        >
                                          <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    {isStale && (
                                      <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-700">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="truncate">Alerta equipo sin conexion</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-[#3eaa76] rounded-full border border-white shadow mx-auto mt-1" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full min-h-[50vh] bg-slate-50/50">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <MapIcon className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                </div>
                <h3 className="text-[17px] font-semibold text-slate-700">Mapa no disponible</h3>
                <p className="text-[14px] text-slate-500 max-w-[300px] text-center mt-1.5 leading-relaxed">
                  Este cliente aún no tiene un mapa cargado en el sistema.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {Object.keys(markers).length === 0 && (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[20px] bg-white">
          <CardHeader className="bg-gradient-to-r from-teal-50/50 to-white pb-4 pt-5 px-5">
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Parámetros en el mapa
            </CardTitle>
            <CardDescription>
              Asigne ubicaciones al mapa con doble clic.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Seleccione una ubicación y haga doble clic sobre el mapa para
              fijar su posición y visualizar sus parámetros.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </PullToRefresh>
  );
}
