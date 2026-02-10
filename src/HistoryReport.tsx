import React from 'react';
import * as XLSX from 'xlsx';

type Props = {
  tickets: any[];
  history: any[];
  clients?: any[];
  users?: any[];
  pqrTypes?: any[];
};

const formatDate = (d: any) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CO') + ' ' + dt.toLocaleTimeString('es-CO');
};

const buildRow = (t: any, allHistory: any[], clients: any[], users: any[], pqrTypes: any[]) => {
  const client = clients?.find((c: any) => c.id === t.clientId) || {};
  const seller = users?.find((u: any) => u.id === t.sellerId) || {};
  const responsable = users?.find((u: any) => u.id === t.assignedToId) || {};
  const pqrType = pqrTypes?.find((p: any) => p.id === t.pqrTypeId) || {};

  const relatedHistory = allHistory.filter(h => h.ticketId === t.id).sort((a,b)=> new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const seguimientos = relatedHistory.map((h:any)=> `${formatDate(h.timestamp)} - ${h.userName}: ${h.action}${h.comment ? ' | ' + h.comment : ''}`).join('\n');

  return [
    t.code || '',
    formatDate(t.createdAt),
    seller.name || t.sellerName || '',
    client.name || client.razonSocial || '',
    t.description || '',
    pqrType.name || t.pqrType || '',
    responsable.name || '',
    t.rca?.rootCause || '',
    t.rca?.causes || '',
    t.rca?.correctiveAction || '',
    t.rca?.preventiveAction || '',
    seguimientos,
    t.status || '',
    t.effectiveness || ''
  ];
};

const HistoryReport: React.FC<Props> = ({ tickets, history, clients = [], users = [], pqrTypes = [] }) => {

  const exportXLSX = () => {
    const header = [
      'Número', 'Fecha', 'Comercial (Vendedor)', 'Cliente', 'Descripción', 'Clasificación', 'Responsable',
      'RCA - Causa raíz', 'RCA - Causas', 'Acción Correctiva', 'Acción Preventiva', 'Seguimientos (fecha - usuario: acción / comentario)',
      'Estado', 'Efectividad'
    ];

    // Order by date asc
    const ordered = [...tickets].sort((a,b)=> new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const rows = ordered.map(t => buildRow(t, history, clients, users, pqrTypes));

    const ws_data = [] as any[];
    ws_data.push(['LA CALERA']);
    ws_data.push(['Histórico de PQR - Exportación']);
    ws_data.push([]);
    ws_data.push(header);
    for (const r of rows) ws_data.push(r);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    // Apply basic column widths
    const maxCol = header.length;
    const wscols = new Array(maxCol).fill({ wch: 30 });
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Historico_PQR_LaCalera_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg">Histórico completo de PQR</h3>
          <p className="text-sm text-gray-500">Exporta en formato Excel (.xlsx) con todos los campos</p>
        </div>
        <div>
          <button onClick={exportXLSX} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded">Exportar .xlsx</button>
        </div>
      </div>

      <div className="text-sm text-gray-600">Registros: {tickets.length}</div>
      <div className="mt-3 text-xs text-gray-500">Nota: la exportación incluye seguimientos y comentarios concatenados por caso.</div>
    </div>
  );
};

export default HistoryReport;
