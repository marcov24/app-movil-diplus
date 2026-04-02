import { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { resolveAlert, getClientByCode } from '../utils/api';
import { createApiClient } from '../utils/apiClient';
import { useClient } from '../hooks/useClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Calendar, ArrowLeft, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { IonSelect, IonSelectOption, IonButton, IonList, IonItemSliding, IonItem, IonItemOptions, IonItemOption, IonAccordion, IonAccordionGroup, IonModal } from '@ionic/react';
import { FaSliders } from 'react-icons/fa6';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { cn } from '@/lib/utils';
import { connectSocket, getSocket } from '../utils/socket';
import { AlertsSkeleton } from '../components/Skeletons';
import { useAlertsContext } from '../contexts/AlertsContext';
import { exportToExcel, exportToPdf, formatAlertsForExport } from '../utils/exportUtils';
import PullToRefresh from '../components/PullToRefresh';

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
  const { refreshUnresolvedCount } = useAlertsContext();
  const [clientName, setClientName] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [draggingAlertId, setDraggingAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
      refreshUnresolvedCount();
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

  if (loading && alerts.length === 0) {
    return <AlertsSkeleton />;
  }

  const handleRefresh = async () => {
    await Promise.all([loadAlerts(true), loadStats()]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
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

        <div className="w-full flex flex-row items-center justify-between gap-2 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-3 pb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-none">
              Histórico de Alertas
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Visualice y gestione todas las alertas del sistema
            </p>
          </div>
          {alerts.length > 0 && (
            <div className="relative flex-shrink-0" ref={exportMenuRef}>
              <IonButton
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="text-sm font-semibold m-0 normal-case shadow-sm"
                style={{
                  '--background': '#3eaa76',
                  '--background-hover': '#2d8a5e',
                  '--background-activated': '#2d8a5e',
                  '--color': 'white',
                  '--border-radius': '8px',
                  '--padding-top': '6px',
                  '--padding-bottom': '6px',
                  '--padding-start': '14px',
                  '--padding-end': '14px',
                } as React.CSSProperties}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </IonButton>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <IonButton
                    fill="clear"
                    expand="full"
                    onClick={() => {
                      const { headers, rows } = formatAlertsForExport(alerts);
                      exportToExcel({ fileName: `alertas_${clientName || 'reporte'}`, sheetName: 'Alertas', headers, rows });
                      setShowExportMenu(false);
                    }}
                    className="m-0 normal-case text-sm [--color:theme(colors.gray.700)] dark:[--color:theme(colors.gray.200)] [--padding-start:16px]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-600 mr-3" />
                    Exportar como Excel
                  </IonButton>
                  <div className="border-t border-gray-100 dark:border-gray-700" />
                  <IonButton
                    fill="clear"
                    expand="full"
                    onClick={() => {
                      const { headers, rows } = formatAlertsForExport(alerts);
                      exportToPdf({ fileName: `alertas_${clientName || 'reporte'}`, title: 'Histórico de Alertas', subtitle: clientName ? `Cliente: ${clientName}` : undefined, headers, rows });
                      setShowExportMenu(false);
                    }}
                    className="m-0 normal-case text-sm [--color:theme(colors.gray.700)] dark:[--color:theme(colors.gray.200)] [--padding-start:16px]"
                  >
                    <FileText className="w-4 h-4 text-red-500 mr-3" />
                    Exportar como PDF
                  </IonButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* iOS Style Summary Widgets */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 px-1 sm:px-0">
          {/* Total Widget */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-900/20 rounded-[24px] p-4 sm:p-5 flex flex-col relative overflow-hidden group border border-cyan-100/50 dark:border-cyan-800/30 shadow-[0_8px_20px_rgb(0,145,160,0.04)]">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-400/10 dark:bg-cyan-400/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-cyan-600/90 dark:text-cyan-400 font-extrabold text-[11px] sm:text-[13px] uppercase tracking-wider mb-1 z-10">Total</span>
            <span className="text-3xl sm:text-4xl font-black text-cyan-700 dark:text-cyan-300 tracking-tight z-10">{stats.total}</span>
          </div>
          
          {/* Sin Resolver Widget */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-900/20 rounded-[24px] p-4 sm:p-5 flex flex-col relative overflow-hidden group border border-red-100/50 dark:border-red-800/30 shadow-[0_8px_20px_rgb(239,68,68,0.06)]">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-red-400/10 dark:bg-red-400/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-red-500/90 dark:text-red-400 font-extrabold text-[11px] sm:text-[13px] uppercase tracking-wider mb-1 z-10">Sin Resolver</span>
            <span className="text-3xl sm:text-4xl font-black text-red-600 dark:text-red-300 tracking-tight z-10">{stats.unresolved}</span>
          </div>

          {/* Resueltas Widget */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-900/20 rounded-[24px] p-4 sm:p-5 flex flex-col relative overflow-hidden group border border-emerald-100/50 dark:border-emerald-800/30 shadow-[0_8px_20px_rgb(62,170,118,0.04)]">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-400/10 dark:bg-emerald-400/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-emerald-600/90 dark:text-emerald-400 font-extrabold text-[11px] sm:text-[13px] uppercase tracking-wider mb-1 z-10">Resueltas</span>
            <span className="text-3xl sm:text-4xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight z-10">{stats.resolved}</span>
          </div>

          {/* Hoy Widget */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-900/20 rounded-[24px] p-4 sm:p-5 flex flex-col relative overflow-hidden group border border-indigo-100/50 dark:border-indigo-800/30 shadow-[0_8px_20px_rgb(79,70,229,0.04)]">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-400/10 dark:bg-indigo-400/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-indigo-500/90 dark:text-indigo-400 font-extrabold text-[11px] sm:text-[13px] uppercase tracking-wider mb-1 z-10">Hoy</span>
            <span className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-300 tracking-tight z-10">{stats.today}</span>
          </div>
        </div>
      )}

      {/* Filters (Compact Accordion) */}
      <Card className="overflow-hidden border border-slate-100/60 dark:border-slate-800 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-[20px]">
        <IonAccordionGroup>
          <IonAccordion value="filters" className="bg-white dark:bg-gray-800 m-0">
            <IonItem slot="header" lines="none" className="[--background:transparent] [--background-hover:transparent] hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer py-1">
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded-xl text-slate-600 dark:text-slate-300">
                  <FaSliders className="w-[18px] h-[18px]" />
                </div>
                <span className="font-extrabold text-[15px] sm:text-[16px] text-slate-800 dark:text-white tracking-tight">Filtros</span>
              </div>
            </IonItem>
            
            <div slot="content" className="px-5 pb-6 pt-2 border-t border-slate-100 dark:border-slate-700/60 font-sans">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Estado</Label>
                  <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#3eaa76]/20 mt-1.5 hover:border-slate-300">
                    <IonSelect
                      value={isResolved}
                      onIonChange={(e) => { setIsResolved(e.detail.value); handleFilterChange(); }}
                      interface="popover"
                      className="w-full text-[14px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                      <IonSelectOption value="all">Todos</IonSelectOption>
                      <IonSelectOption value="false">Sin Resolver</IonSelectOption>
                      <IonSelectOption value="true">Resueltas</IonSelectOption>
                    </IonSelect>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Condición</Label>
                  <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-1 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-[#3eaa76]/20 mt-1.5 hover:border-slate-300">
                    <IonSelect
                      value={condition}
                      onIonChange={(e) => setCondition(e.detail.value)}
                      interface="popover"
                      className="w-full text-[14px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                      <IonSelectOption value="all">Todas</IonSelectOption>
                      <IonSelectOption value="critical">Crítico</IonSelectOption>
                      <IonSelectOption value="warning">Advertencia</IonSelectOption>
                      <IonSelectOption value="normal">Normal</IonSelectOption>
                    </IonSelect>
                  </div>
                </div>
                
                <div className="col-span-1 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Rango de Fechas</Label>
                  <div className="relative mt-1.5" ref={datePickerRef}>
                    <IonButton
                      fill="clear"
                      onClick={() => setShowDatePicker(true)}
                      className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40 transition-all shadow-sm m-0 normal-case"
                      style={{ '--border-radius': '12px' }}
                    >
                      <div className="w-full flex items-center justify-start gap-3 px-1 text-slate-700 dark:text-slate-200">
                        <Calendar size={18} className="text-slate-400 shrink-0" />
                        <span className="font-semibold text-[14px]">
                          {startDate && endDate
                            ? `${format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')} — ${format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}`
                            : 'Seleccione un rango'}
                        </span>
                      </div>
                    </IonButton>
                    
                    <IonModal
                      isOpen={showDatePicker}
                      onDidDismiss={() => setShowDatePicker(false)}
                      initialBreakpoint={0.7}
                      breakpoints={[0, 0.7, 0.9]}
                      className="date-modal custom-bottom-sheet"
                    >
                      <div className="bg-white dark:bg-gray-800 w-full h-full p-5 overflow-y-auto flex flex-col items-center">
                        <div className="w-full max-w-[340px] mx-auto">
                          <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-4 mt-2">Rango de fechas</h3>
                          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
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
                          </div>
                          <IonButton
                            expand="block"
                            onClick={applyDateRange}
                            className="w-full mt-6 m-0 normal-case shadow-md text-[16px] font-bold tracking-wide"
                            style={{
                              '--background': '#3eaa76',
                              '--background-hover': '#2e825a',
                              '--border-radius': '12px',
                              '--padding-top': '18px',
                              '--padding-bottom': '18px',
                              '--box-shadow': 'none'
                            } as React.CSSProperties}
                          >
                            Aplicar Filtro
                          </IonButton>
                        </div>
                      </div>
                    </IonModal>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setCalendarRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
                  setIsResolved('false');
                  setCondition('all');
                  setTimeout(() => handleFilterChange(), 50);
                }}
                className="mt-5 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 hover:text-slate-900 transition-colors active:scale-95 mx-auto md:mx-0 w-full md:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Limpiar Filtros
              </button>
            </div>
          </IonAccordion>
        </IonAccordionGroup>
      </Card>

      {/* Alerts List */}
      <Card className="border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-[20px] bg-white dark:bg-gray-800 overflow-hidden mb-6">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-[18px] sm:text-[20px] font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            Alertas <span className="text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5 text-[12px] font-bold">{alerts.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-24 h-24 mb-6 rounded-[28px] bg-gradient-to-br from-[#e4fcfa] to-[#3eaa76]/10 flex items-center justify-center shadow-[0_0_40px_rgba(62,170,118,0.2)] dark:shadow-none animate-in fade-in zoom-in duration-500">
                <div className="w-[60px] h-[60px] rounded-[20px] bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-8 h-8 text-[#3eaa76]" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2 tracking-tight">¡Todo bajo control!</h3>
              <p className="text-[14px] text-slate-500 dark:text-slate-400 text-center max-w-[280px] leading-relaxed font-medium">
                Tu sistema no reporta ninguna alerta pendiente bajo estos filtros.
              </p>
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
    </PullToRefresh>
  );
}

