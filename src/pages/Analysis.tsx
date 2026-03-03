import { useEffect, useState, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getHistoricalData, getParameter, getSetpoints } from '../utils/api';
import { Button } from '@/components/ui/button';
import { useClient } from '@/hooks/useClient';
import { Loader2, ArrowLeft, Calendar, Clock, Radio } from 'lucide-react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { IonButton } from '@ionic/react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/api';

interface Parameter {
  _id: string;
  name: string;
  unit: string;
  topic: string;
  description?: string;
  locationId: {
    _id: string;
    name: string;
    areaId: {
      _id: string;
      name: string;
    };
  };
  decimals?: number;
}

interface DataPoint {
  timestamp: number;
  value: number;
  date?: string;
  minValue?: number;
  maxValue?: number;
}

interface Setpoint {
  _id: string;
  minValue: number;
  maxValue: number | null;
  color: string;
}

interface HistoricalDataItem {
  timestamp?: string | number;
  timestampNumber?: number;
  value: string | number;
}

const MAX_CHART_POINTS = 1000;

const downsampleLTTB = (points: DataPoint[], threshold: number) => {
  if (threshold >= points.length || threshold < 3) {
    return points;
  }

  const sampled: DataPoint[] = [];
  const bucketSize = (points.length - 2) / (threshold - 2);
  let a = 0;

  sampled.push(points[a]);

  for (let i = 0; i < threshold - 2; i += 1) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;

    const avgRangeStart = rangeStart;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, points.length);

    let avgX = 0;
    let avgY = 0;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    for (let j = avgRangeStart; j < avgRangeEnd; j += 1) {
      avgX += points[j].timestamp;
      avgY += points[j].value;
    }
    avgX /= avgRangeLength || 1;
    avgY /= avgRangeLength || 1;

    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.min(Math.floor((i + 1) * bucketSize) + 1, points.length);

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j += 1) {
      const area = Math.abs(
        (points[a].timestamp - avgX) * (points[j].value - points[a].value) -
        (points[a].timestamp - points[j].timestamp) * (avgY - points[a].value)
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled.push(points[nextA]);
    a = nextA;
  }

  sampled.push(points[points.length - 1]);
  return sampled;
};

const toLocalDateTimeInput = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function Analysis() {
  const { parameterId } = useParams<{ parameterId: string }>();
  const history = useHistory();
  const { clientCode } = useClient();
  const [parameter, setParameter] = useState<Parameter | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [rawData, setRawData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [setpoints, setSetpoints] = useState<Setpoint[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Real-time data state
  const [realtimeData, setRealtimeData] = useState<[number, number][]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const realtimeChartRef = useRef<HighchartsReact.RefObject>(null);
  const MAX_REALTIME_POINTS = 100;

  const [calendarRange, setCalendarRange] = useState([
    {
      startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
      endDate: new Date(),
      key: 'selection'
    }
  ]);

  const [startTime, setStartTime] = useState(() => {
    const d = new Date(new Date().setDate(new Date().getDate() - 1));
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return toLocalDateTimeInput(date);
  });
  const [endDate, setEndDate] = useState(() => {
    return toLocalDateTimeInput(new Date());
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyDateRange = () => {
    const startObj = new Date(calendarRange[0].startDate);
    const endObj = new Date(calendarRange[0].endDate);

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    startObj.setHours(startH || 0, startM || 0, 0, 0);
    endObj.setHours(endH || 0, endM || 0, 0, 0);

    setStartDate(toLocalDateTimeInput(startObj));
    setEndDate(toLocalDateTimeInput(endObj));
    setShowDatePicker(false);
  };

  useEffect(() => {
    if (parameterId) {
      loadParameter();
      loadSetpoints();
      loadData();
    }
  }, [parameterId]);

  useEffect(() => {
    if (parameterId) {
      loadData();
    }
  }, [startDate, endDate]);

  // Real-time backend Socket.io connection (imitating appFrontend)
  useEffect(() => {
    if (!parameterId) return;

    setRealtimeData([]);
    let socket: Socket | null = null;
    let isMounted = true;

    const setupSocket = () => {
      try {
        socket = io(SOCKET_URL, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
          if (isMounted) setIsSocketConnected(true);
        });

        socket.on('disconnect', () => {
          if (isMounted) setIsSocketConnected(false);
        });

        socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          if (isMounted) setIsSocketConnected(false);
        });

        // The backend emits 'sensor-data' for all live MQTT messages
        socket.on('sensor-data', (data: any) => {
          if (!isMounted) return;

          // Verify if this message belongs to the current parameter
          if (data && data.parameterId === parameterId) {
            try {
              const rawValue = data.value;
              let numericValue: number;

              if (typeof rawValue === 'boolean') {
                numericValue = rawValue ? 1 : 0;
              } else if (typeof rawValue === 'string') {
                const normalized = rawValue.replace(',', '.').replace(/[^0-9.+-]/g, '');
                numericValue = parseFloat(normalized);
              } else {
                numericValue = Number(rawValue);
              }

              if (!Number.isNaN(numericValue)) {
                // Determine the timestamp (prefer server timestamp, fallback to now)
                let pointTimestamp = Date.now();
                if (data.timestampNumber) {
                  pointTimestamp = data.timestampNumber;
                } else if (data.timestamp) {
                  pointTimestamp = new Date(data.timestamp).getTime();
                }

                const newPoint: [number, number] = [pointTimestamp, numericValue];

                setRealtimeData(prev => {
                  const nextData = [...prev, newPoint];
                  if (nextData.length > MAX_REALTIME_POINTS) {
                    return nextData.slice(nextData.length - MAX_REALTIME_POINTS);
                  }
                  return nextData;
                });
              }
            } catch (err) {
              console.error('Error parsing live socket data:', err);
            }
          }
        });
      } catch (err) {
        console.error('Failed to init socket connection:', err);
      }
    };

    setupSocket();

    return () => {
      isMounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [parameterId]);

  const loadParameter = async () => {
    try {
      const response = await getParameter(parameterId!);
      setParameter(response.data);
    } catch (error) {
      console.error('Error loading parameter:', error);
    }
  };

  const loadSetpoints = async () => {
    try {
      const response = await getSetpoints(parameterId!, clientCode || undefined);
      setSetpoints(response.data || []);
    } catch (error) {
      console.error('Error loading setpoints:', error);
      setSetpoints([]);
    }
  };

  const loadData = async () => {
    if (!parameterId) return;
    try {
      setLoading(true);
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime() + 86400000;

      const response = await getHistoricalData(parameterId, startTime, endTime, 10000);
      const formatted = response.data.map((item: HistoricalDataItem) => {
        const ts = item.timestamp || item.timestampNumber;
        const timestamp = typeof ts === 'string' ? new Date(ts).getTime() : (typeof ts === 'number' ? ts : new Date().getTime());
        const rawValue = item.value;
        let numericValue: number;
        if (typeof rawValue === 'string') {
          const normalized = rawValue.replace(',', '.').replace(/[^0-9.+-]/g, '');
          numericValue = parseFloat(normalized);
        } else {
          numericValue = Number(rawValue);
        }
        return {
          timestamp: timestamp,
          value: Number.isNaN(numericValue) ? 0 : numericValue,
          date: new Date(timestamp).toLocaleString('es-ES')
        };
      }).sort((a: DataPoint, b: DataPoint) => a.timestamp - b.timestamp);
      setRawData(formatted);
      setData(downsampleLTTB(formatted, MAX_CHART_POINTS));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!parameter) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getSetpointColor = (value: number | null) => {
    if (value === null || value === undefined) return '#3eaa76';
    if (setpoints.length === 0) return '#3eaa76';
    const sorted = [...setpoints].sort((a, b) => a.minValue - b.minValue);
    for (const sp of sorted) {
      if (sp.maxValue !== null && sp.maxValue !== undefined) {
        if (value >= sp.minValue && value <= sp.maxValue) return sp.color;
      } else if (value === sp.minValue) {
        return sp.color;
      }
    }
    return '#3eaa76';
  };

  const getTimelineStops = () => {
    if (!data || data.length === 0) {
      return [
        { offset: '0%', color: '#3eaa76' },
        { offset: '100%', color: '#3eaa76' }
      ];
    }
    const colors = data.map(point => getSetpointColor(point.value));
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

  const stats = rawData.length > 0 ? {
    avg: rawData.reduce((sum, d) => sum + d.value, 0) / rawData.length,
    min: Math.min(...rawData.map(d => d.value)),
    max: Math.max(...rawData.map(d => d.value)),
    count: rawData.length
  } : null;
  const decimals = parameter.decimals ?? 2;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => history.push(clientCode ? `/${clientCode}/dashboard` : '/')}
            className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-[#3eaa76]/10 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[#3eaa76]" />
          </Button>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#3eaa76] truncate flex-1">
            Análisis: {parameter.name}
          </h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          {parameter.locationId.areaId.name} → {parameter.locationId.name}
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
          <span className="block sm:inline">Tópico: <span className="font-mono bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm">{parameter.topic}</span></span>
          <span className="hidden sm:inline"> | </span>
          <span className="block sm:inline mt-1 sm:mt-0">Unidad: <span className="font-semibold">{parameter.unit}</span></span>
        </p>
      </div>

      {/* Real-time Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
        {/* Header with connection status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio size={14} className={isSocketConnected ? 'text-green-500' : 'text-gray-400'} />
            <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">Gráfica en Tiempo Real</h4>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${isSocketConnected
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
              <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
              {isSocketConnected ? 'En línea' : 'Desconectado'}
            </span>
          </div>
        </div>

        {realtimeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
            <Radio size={32} className="mb-2 opacity-40" />
            <span className="text-sm">Esperando datos en tiempo real...</span>
          </div>
        ) : (
          <HighchartsReact
            highcharts={Highcharts}
            options={{
              time: { useUTC: false },
              chart: {
                type: 'spline',
                backgroundColor: 'transparent',
                height: 300,
                animation: false,
              },
              title: { text: undefined },
              xAxis: {
                type: 'datetime',
                labels: { format: '{value:%H:%M:%S}' },
                tickPixelInterval: 80,
              },
              yAxis: {
                title: { text: parameter.unit },
                gridLineDashStyle: 'Dash',
              },
              tooltip: {
                xDateFormat: '%H:%M:%S',
                valueSuffix: ` ${parameter.unit}`,
              },
              plotOptions: {
                spline: {
                  marker: { enabled: false },
                  lineWidth: 2,
                },
              },
              series: [{
                type: 'spline',
                name: parameter.name,
                data: realtimeData,
                color: '#0d9488',
              } as any],
              credits: { enabled: false },
              legend: { enabled: false },
            } as Highcharts.Options}
            ref={realtimeChartRef}
          />
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Rango de Fechas</label>
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-full sm:w-auto min-w-[300px] flex items-center justify-between gap-3 px-4 py-2 border border-[#3eaa76] rounded-md text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[#3eaa76]/50"
            >
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-[#3eaa76] shrink-0" />
                <span className="font-medium">
                  {format(calendarRange[0].startDate, 'dd/MM/yyyy', { locale: es })} {startTime}
                  <span className="mx-2 text-gray-400">—</span>
                  {format(calendarRange[0].endDate, 'dd/MM/yyyy', { locale: es })} {endTime}
                </span>
              </div>
            </button>
            {showDatePicker && (
              <div className="absolute z-50 mt-2 left-0 sm:left-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden date-range-wrapper min-w-[320px]">
                <DateRange
                  ranges={calendarRange}
                  onChange={(item: RangeKeyDict) => setCalendarRange([item.selection as { startDate: Date; endDate: Date; key: string }])}
                  moveRangeOnFirstSelection={false}
                  months={1}
                  direction="vertical"
                  rangeColors={['#3eaa76']}
                  locale={es}
                  dateDisplayFormat="dd/MM/yyyy"
                  maxDate={new Date()}
                />
                {/* Time selectors */}
                <div className="grid grid-cols-2 gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <label className="text-xs text-gray-600 dark:text-gray-400 shrink-0">Inicio</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-[#3eaa76] focus:ring-1 focus:ring-[#3eaa76]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <label className="text-xs text-gray-600 dark:text-gray-400 shrink-0">Fin</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-[#3eaa76] focus:ring-1 focus:ring-[#3eaa76]"
                    />
                  </div>
                </div>
                <div className="flex justify-end p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <IonButton
                    onClick={applyDateRange}
                    className="text-sm font-semibold m-0 normal-case shadow-sm"
                    style={{
                      '--background': '#3eaa76',
                      '--background-hover': '#2d8a5e',
                      '--background-activated': '#2d8a5e',
                      '--color': 'white',
                      '--border-radius': '6px',
                      '--padding-top': '8px',
                      '--padding-bottom': '8px',
                      '--padding-start': '20px',
                      '--padding-end': '20px',
                      'height': 'auto',
                      'minHeight': 'unset'
                    }}
                  >
                    Aplicar
                  </IonButton>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : rawData.length === 0 ? (
          <div className="flex justify-center items-center h-96">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Chart Title and Registros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-4">
              <div className="flex items-center gap-2">
                <div>
                  <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">Gráfica de Datos Histórica</h4>
                  {!loading && stats && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stats.count} registros encontrados
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Legend above chart */}
            <div className="flex flex-wrap items-center justify-center gap-4 px-4 text-xs sm:text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-0.5 bg-[#3eaa76]"></div>
                <span>{parameter.name}</span>
              </div>
            </div>

            {/* Chart with reduced height to bring stats closer */}
            <ResponsiveContainer width="100%" height={380} className="sm:h-[450px] md:h-[500px]">
              <LineChart
                data={data}
                margin={{ bottom: 60, right: 20, left: 10, top: 10 }}
              >
                <defs>
                  {(() => {
                    const stops = getTimelineStops();
                    return (
                      <linearGradient id="analysis-line-gradient" x1="0" y1="0" x2="1" y2="0">
                        {stops.map((stop, index) => (
                          <stop
                            key={`analysis-line-${index}`}
                            offset={stop.offset}
                            stopColor={stop.color}
                            stopOpacity={1}
                          />
                        ))}
                      </linearGradient>
                    );
                  })()}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval="preserveStartEnd"
                  minTickGap={30}
                  tickFormatter={(value) => {
                    try {
                      const date = new Date(value);
                      const day = date.getDate().toString().padStart(2, '0');
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');

                      // Si hay muchos puntos, usar formato compacto en una línea
                      if (data.length > 100) {
                        return `${day}/${month} ${hours}:${minutes}`;
                      }
                      // Formato en dos líneas para mejor lectura
                      return `${day}/${month}\n${hours}:${minutes}`;
                    } catch {
                      return value;
                    }
                  }}
                />
                <YAxis
                  label={{ value: parameter.unit, angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    padding: '8px 12px'
                  }}
                  labelFormatter={(value) => {
                    try {
                      const date = new Date(value);
                      const day = date.getDate().toString().padStart(2, '0');
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const year = date.getFullYear();
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      return `${day}/${month}/${year} a las ${hours}:${minutes}`;
                    } catch {
                      return value;
                    }
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="url(#analysis-line-gradient)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  animationDuration={300}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {stats && !loading && rawData.length > 0 && (
          <div className="grid grid-cols-4 gap-2 border-t pt-3 sm:pt-4 mt-2 sm:mt-4">
            <div className="flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Promedio</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-foreground">{stats.avg.toFixed(decimals)}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Mínimo</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-foreground">{stats.min.toFixed(decimals)}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Máximo</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-foreground">{stats.max.toFixed(decimals)}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Registros</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-foreground">{stats.count}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
