import { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { resolveAlert, getClientByCode } from '../utils/api';
import { createApiClient } from '../utils/apiClient';
import { useClient } from '../hooks/useClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, Filter, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';
import { IonSelect, IonSelectOption, IonButton, IonList, IonItemSliding, IonItem, IonItemOptions, IonItemOption } from '@ionic/react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { cn } from '@/lib/utils';
import { connectSocket, getSocket } from '../utils/socket';

interface Alert {
  _id: string;
  parameterId: {
    _id: string;
    name: string;
    unit: string;
    locationId?: {
      name?: string;
      areaId?: {
        name?: string;
      };
    } | null;
  } | null;
  sensorValue: number;
  condition: 'normal' | 'warning' | 'critical';
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  timestamp: string;
}

export default function Alerts() {
  const history = useHistory();
  const { clientCode } = useClient();
  const api = createApiClient(clientCode);
  const [clientName, setClientName] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [draggingAlertId, setDraggingAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<any>(null);

  // Filters
  const [isResolved, setIsResolved] = useState<string>('false');
  const [condition, setCondition] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [calendarRange, setCalendarRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ]);

  const observerTarget = useRef<HTMLDivElement>(null);

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
    const sDate = format(calendarRange[0].startDate, 'yyyy-MM-dd');
    const eDate = format(calendarRange[0].endDate, 'yyyy-MM-dd');
    setStartDate(sDate);
    setEndDate(eDate);
    setShowDatePicker(false);
    setTimeout(() => {
      handleFilterChange();
    }, 50);
  };

  useEffect(() => {
    loadAlerts(true);
    loadStats();
    setupSocket();

    if (clientCode) {
      getClientByCode(clientCode)
        .then(res => setClientName(res.data.name))
        .catch(err => console.error('Error loading client name:', err));
    }

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('new-alert');
      }
    };
  }, []);

  useEffect(() => {
    if (page > 1) {
      loadAlerts(false);
    }
  }, [page]);

  const setupSocket = () => {
    const socket = connectSocket();
    socket.on('new-alert', () => {
      // Reload first page when new alert arrives
      loadAlerts(true);
      loadStats();
    });
  };

  const loadAlerts = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }

      const currentPage = reset ? 1 : page;
      const params: any = {
        page: currentPage,
        limit: 20
      };
      if (isResolved !== 'all') {
        params.isResolved = isResolved === 'true';
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await api.get('/alerts', { params });

      const fetchedAlerts = response.data.alerts || [];
      if (reset) {
        setAlerts(fetchedAlerts);
      } else {
        setAlerts(prev => [...prev, ...fetchedAlerts]);
      }

      setHasMore(response.data.pagination.page < response.data.pagination.totalPages);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/alerts/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      setAlerts(prev => prev.map(alert =>
        alert._id === id
          ? { ...alert, isResolved: true, resolvedAt: new Date().toISOString() }
          : alert
      ));
      loadStats();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const handleFilterChange = () => {
    loadAlerts(true);
    loadStats();
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading]);

  return (
    <div className="space-y-4 md:space-y-8 w-full">
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
            Histórico de Alertas
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Visualice y gestione todas las alertas del sistema
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#51E8D4]/10 border-[#51E8D4] flex flex-col justify-center">
            <CardHeader className="pb-2">
              <CardDescription className="text-[#0091A0]">Total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#0091A0]">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#EF4444]/10 border-[#EF4444] flex flex-col justify-center">
            <CardHeader className="pb-2">
              <CardDescription className="text-[#EF4444]">Sin Resolver</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#EF4444]">{stats.unresolved}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#3eaa76]/10 border-[#3eaa76] flex flex-col justify-center">
            <CardHeader className="pb-2">
              <CardDescription className="text-[#3eaa76]">Resueltas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#3eaa76]">{stats.resolved}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0091A0]/10 border-[#0091A0] flex flex-col justify-center">
            <CardHeader className="pb-2">
              <CardDescription className="text-[#0091A0]">Hoy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#0091A0]">{stats.today}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Estado</Label>
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring mt-1.5">
                <IonSelect
                  value={isResolved}
                  onIonChange={(e) => { setIsResolved(e.detail.value); handleFilterChange(); }}
                  interface="popover"
                  className="w-full [--padding-start:0] [--padding-end:0] text-sm"
                >
                  <IonSelectOption value="all">Todos</IonSelectOption>
                  <IonSelectOption value="false">Sin Resolver</IonSelectOption>
                  <IonSelectOption value="true">Resueltas</IonSelectOption>
                </IonSelect>
              </div>
            </div>
            <div>
              <Label>Condición</Label>
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring mt-1.5">
                <IonSelect
                  value={condition}
                  onIonChange={(e) => setCondition(e.detail.value)}
                  interface="popover"
                  className="w-full [--padding-start:0] [--padding-end:0] text-sm"
                >
                  <IonSelectOption value="all">Todas</IonSelectOption>
                  <IonSelectOption value="critical">Crítico</IonSelectOption>
                  <IonSelectOption value="warning">Advertencia</IonSelectOption>
                  <IonSelectOption value="normal">Normal</IonSelectOption>
                </IonSelect>
              </div>
            </div>
            <div className="col-span-1 md:col-span-2">
              <Label>Rango de Fechas</Label>
              <div className="relative mt-1.5" ref={datePickerRef}>
                <IonButton
                  fill="clear"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="w-full h-10 border border-input rounded-md bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm normal-case"
                >
                  <div className="w-full flex items-center justify-between gap-3 px-1 text-sm text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        {startDate && endDate
                          ? `${format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')} — ${format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}`
                          : 'Seleccione un rango'}
                      </span>
                    </div>
                  </div>
                </IonButton>
                {showDatePicker && (
                  <div className="absolute z-50 mt-2 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden date-range-wrapper min-w-[320px]">
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
                    <div className="flex justify-end p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <IonButton
                        onClick={applyDateRange}
                        className="text-sm font-semibold m-0 normal-case shadow-sm"
                        style={{ '--background': '#3eaa76', '--border-radius': '8px', 'height': '36px' }}
                      >
                        Aplicar Filtro
                      </IonButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setCalendarRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
              setIsResolved('false');
              setCondition('all');
              setTimeout(() => handleFilterChange(), 50);
            }}
            variant="outline"
            className="mt-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpiar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas ({alerts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && alerts.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="relative">
                <div className="absolute inset-0 bg-[#3eaa76]/30 rounded-full blur-xl animate-pulse -m-2"></div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 dark:border-gray-700 relative z-10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#3eaa76] animate-spin" />
                </div>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="text-muted-foreground">No hay alertas disponibles</p>
            </div>
          ) : (
            <IonList
              className="space-y-3 bg-transparent p-0"
              // Clear dragging state when user releases touch/mouse anywhere in the list
              onTouchEnd={() => setTimeout(() => setDraggingAlertId(null), 300)}
              onMouseUp={() => setTimeout(() => setDraggingAlertId(null), 300)}
            >
              {alerts.map((alert) => (
                <IonItemSliding
                  key={alert._id}
                  className="overflow-hidden rounded-lg mb-3 shadow-sm bg-transparent"
                  onIonDrag={() => setDraggingAlertId(alert._id)}
                // Uses a slightly delayed clear so the options UI handles the click before resetting the state.
                // If it resets immediately, the text re-appears instantly on release before the 'resolver' close animation finishes.
                // But standard touchend is fine for purely hiding it during the swipe gesture.
                // Let's just use onIonDrag to hide and we can attach an event to close it or let it restore naturally when the swipe is closed. 
                >
                  <IonItem lines="none" className="[--background:transparent] [--padding-start:0] [--inner-padding-end:0] m-0 p-0 w-full cursor-grab active:cursor-grabbing">
                    <div
                      className={cn(
                        "w-full border p-4 transition-all rounded-lg",
                        alert.isResolved
                          ? "bg-gray-50 border-gray-200 opacity-75 dark:bg-gray-900/30 dark:border-gray-700"
                          : alert.condition === 'critical'
                            ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
                            : "bg-[#FCF9E8] border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/50"
                      )}
                    >
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1",
                            alert.isResolved
                              ? "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              : alert.condition === 'critical'
                                ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                                : 'bg-[#FDE68A] text-[#92400E] dark:bg-yellow-900/50 dark:text-yellow-200'
                          )}>
                            {!alert.isResolved ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            {alert.condition.toUpperCase()}
                          </span>
                          {alert.parameterId && (
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
                              {alert.parameterId.locationId?.name ?? 'Sin ubicación'} - {alert.parameterId.locationId?.areaId?.name ?? 'Sin área'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {alert.message}
                        </p>

                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">
                          Valor: {new Date(alert.timestamp).toLocaleString('es-ES')}
                        </p>

                        {!alert.isResolved && (
                          <p className={cn(
                            "text-[11px] text-gray-400 dark:text-gray-500 italic mt-1 font-medium select-none flex items-center transition-opacity duration-200",
                            draggingAlertId === alert._id ? "opacity-0" : "opacity-100"
                          )}>
                            ← Desliza para resolver
                          </p>
                        )}
                        {alert.isResolved && alert.resolvedAt && (
                          <p className="text-[11px] text-green-600 font-medium mt-1">
                            Resuelta: {new Date(alert.resolvedAt).toLocaleString('es-ES')}
                          </p>
                        )}
                      </div>
                    </div>
                  </IonItem>

                  {!alert.isResolved && (
                    <IonItemOptions side="end" className="m-0 p-0 border-0 bg-[#129c54]">
                      <IonItemOption
                        onClick={() => {
                          handleResolve(alert._id);
                          setDraggingAlertId(null);
                        }}
                        className="flex flex-col justify-center items-center w-[120px] h-full m-0 bg-transparent text-white"
                        expandable
                      >
                        <CheckCircle2 className="w-8 h-8 mb-1" />
                        <span className="font-semibold text-sm capitalize">Resolver</span>
                      </IonItemOption>
                    </IonItemOptions>
                  )}
                </IonItemSliding>
              ))}

              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="h-10 flex justify-center items-center">
                {loading && (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                )}
                {!hasMore && alerts.length > 0 && (
                  <p className="text-sm text-muted-foreground">No hay más alertas</p>
                )}
              </div>
            </IonList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

