import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ──────────────────────────────────────────────
// Excel Export
// ──────────────────────────────────────────────

interface ExcelExportOptions {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
}

export function exportToExcel({ fileName, sheetName, headers, rows }: ExcelExportOptions) {
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// ──────────────────────────────────────────────
// PDF Export
// ──────────────────────────────────────────────

interface PdfExportOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  orientation?: 'portrait' | 'landscape';
}

export function exportToPdf({ fileName, title, subtitle, headers, rows, orientation = 'landscape' }: PdfExportOptions) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  // Title
  doc.setFontSize(16);
  doc.setTextColor(62, 170, 118); // #3eaa76
  doc.text(title, 14, 20);

  // Subtitle
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 28);
  }

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 14, subtitle ? 34 : 28);

  // Table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: subtitle ? 38 : 32,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [62, 170, 118], // #3eaa76
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 10, right: 14, bottom: 10, left: 14 },
  });

  doc.save(`${fileName}.pdf`);
}

// ──────────────────────────────────────────────
// Pre-built formatters for each view
// ──────────────────────────────────────────────

interface AlertData {
  timestamp: string;
  parameterId: {
    name: string;
    unit: string;
    locationId?: {
      name?: string;
      areaId?: { name?: string };
    } | null;
  } | null;
  sensorValue: number;
  condition: string;
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
}

export function formatAlertsForExport(alerts: AlertData[]) {
  const headers = ['Fecha', 'Parámetro', 'Ubicación', 'Área', 'Valor', 'Condición', 'Mensaje', 'Estado', 'Resuelta en'];

  const rows = alerts.map(alert => {
    const date = format(new Date(alert.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es });
    const paramName = alert.parameterId?.name || 'N/A';
    const location = alert.parameterId?.locationId?.name || 'N/A';
    const area = alert.parameterId?.locationId?.areaId?.name || 'N/A';
    const value = `${alert.sensorValue} ${alert.parameterId?.unit || ''}`;
    const condition = alert.condition === 'critical' ? 'Crítica' : alert.condition === 'warning' ? 'Advertencia' : 'Normal';
    const estado = alert.isResolved ? 'Resuelta' : 'Sin Resolver';
    const resolvedAt = alert.resolvedAt ? format(new Date(alert.resolvedAt), 'dd/MM/yyyy HH:mm:ss', { locale: es }) : '-';
    return [date, paramName, location, area, value, condition, alert.message, estado, resolvedAt];
  });

  return { headers, rows };
}

interface AnalysisDataPoint {
  timestamp: number;
  value: number;
}

export function formatAnalysisForExport(data: AnalysisDataPoint[], paramName: string, unit: string) {
  const headers = ['Fecha', 'Hora', `Valor (${unit})`];

  const rows = data.map(point => {
    const d = new Date(point.timestamp);
    const date = format(d, 'dd/MM/yyyy', { locale: es });
    const time = format(d, 'HH:mm:ss', { locale: es });
    return [date, time, point.value];
  });

  return { headers, rows, paramName };
}
