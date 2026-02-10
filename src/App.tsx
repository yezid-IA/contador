import React, { useState, useMemo, useEffect } from 'react';
import { AdminPanel } from './AdminPanel';
import { supabase } from './supabaseClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  History, 
  ChevronRight, 
  Filter,
  ExternalLink,
  User,
  Search,
  ClipboardList,
  BookOpen,
  HelpCircle,
  X,
  BarChart3,
  TrendingUp,
  PieChart,
  Mail,
  MessageSquare,
  Clock,
  Calendar,
  Timer,
  Hash,
  ShoppingBag,
  FileSpreadsheet,
  Package,
  Edit,
  LogOut,
  Eye,
  Settings,
  AlertCircle,
  Lock,
  EyeOff,
  Users,
  Download,
  Menu
} from 'lucide-react';
import * as XLSX from 'xlsx';
type Role = 'Admin' | 'Vendedor' | 'Responsable' | 'Gerente';
type Status = 'Nuevo' | 'Asignado' | 'En Investigacion' | 'Pendiente RCA' | 'En Resolucion' | 'Pendiente Cierre' | 'En Seguimiento' | 'Cerrado' | 'Cierre Temporal' | 'En Verificación de Acciones' | 'Cerrado Verificado';
type Criticidad = 'Crítica' | 'Mayor Alta' | 'Mayor Media' | 'Menor Media' | 'Menor Baja' | 'Observación';
type ResultadoEficacia = 'EFICAZ' | 'NO EFICAZ';

interface UserProfile {
  id: string;
  name: string;
  role: Role;
  department?: string;
  email: string;
  phone: string;
  whatsappPhone?: string;
  password?: string;
}

interface Client {
  id: string;
  name: string;
  razonSocial?: string;
  sucursal?: string;
  contacto?: string;
  cargo?: string;
  nit: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

interface Ticket {
  id: number;
  code: string;
  clientId: string;
  fruitId: string;
  pqrTypeId: string;
  lote: string;
  description: string;
  evidenceLink: string;
  status: Status;
  creatorId: string;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  slaDays: number;
  responsableSla?: number;
  clienteSla?: number;
  rca?: RCA;
  purchaseOrder?: string;
  invoiceNumber?: string;
  returnQuantity?: number;
  criticidad?: Criticidad;
  followUps?: FollowUp[];
  resultadoEficacia?: ResultadoEficacia;
  cumplimientoCount?: { cumplidos: number; noCumplidos: number };
  effectiveness?: EffectivenessVerification;
}

interface RCA {
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  analystId: string;
  date: string;
}

interface FollowUp {
  id: string;
  number: number;
  description: string;
  status: 'Pendiente' | 'Completado';
  cumplimiento: 'Cumplió' | 'No Cumplió' | null;
  observaciones: string;
  completedAt?: string;
  completedBy?: string;
}

interface VerificationAction {
  id: string;
  description: string;
  status: 'Cumplida' | 'Parcial' | 'Incumplida';
  percentage: number;
  evidence: string[];
  comments: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

interface EffectivenessVerification {
  id: string;
  ticketId: number;
  actions: VerificationAction[];
  scheduledDate: string;
  completedDate?: string;
  inspectorId: string;
  status: 'Pendiente' | 'En Progreso' | 'Completada';
  overallComments: string;
  verifiedBy?: string;
}

interface HistoryLog {
  id: string;
  ticketId: number;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
}

// --- DATOS MAESTROS ---

const USERS: UserProfile[] = [
  { id: 'u1', name: 'Sandra Roa', role: 'Admin', department: 'Calidad', email: 'calidad@lacalera.com', phone: '+57 300...', whatsappPhone: '+573001234567' },
  { id: 'u2', name: 'Steffie Comercial', role: 'Vendedor', department: 'Comercial', email: 'ventas@lacalera.com', phone: '+57 310...', whatsappPhone: '+573001234568' },
  { id: 'u3', name: 'Jefe Logística', role: 'Responsable', department: 'Logística', email: 'logistica@lacalera.com', phone: '+57 311...', whatsappPhone: '+573001234569' },
  { id: 'u4', name: 'Jefe Bodega', role: 'Responsable', department: 'Bodega', email: 'bodega@lacalera.com', phone: '+57 312...', whatsappPhone: '+573001234570' },
  { id: 'u5', name: 'Gerencia General', role: 'Gerente', department: 'Gerencia', email: 'gerencia@lacalera.com', phone: '+57 313...', whatsappPhone: '+573001234571' },
  // Inspector removed; Calidad Responsable (Sandra) manejará la verificación internamente
];

const CLIENTS: Client[] = [
  { id: 'c1', name: 'Supermercados Éxito', nit: '800.123.456' },
  { id: 'c2', name: 'Cencosud', nit: '900.654.321' },
  { id: 'c3', name: 'PriceSmart', nit: '700.987.654' },
  { id: 'c4', name: 'Carulla', nit: '860.000.000' },
  { id: 'c5', name: 'Jeronimo Martins', nit: '900.000.000' },
  { id: 'c6', name: 'Alkosto', nit: '890.900.943' },
];

const FRUITS = [
  { id: 'f1', name: 'Cereza Importada', clientIds: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] },
  { id: 'f2', name: 'Ciruela Importada', clientIds: ['c1', 'c2'] },
  { id: 'f3', name: 'Kiwi Importado', clientIds: ['c1', 'c3', 'c5'] },
  { id: 'f4', name: 'Limón Amarillo Importado', clientIds: ['c2', 'c4', 'c6'] },
  { id: 'f5', name: 'Mandarina Importada', clientIds: ['c1', 'c2', 'c3', 'c4'] },
  { id: 'f6', name: 'Manzana Roja Importada', clientIds: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] },
  { id: 'f7', name: 'Manzana Royal Gala Importada', clientIds: ['c1', 'c5'] },
  { id: 'f8', name: 'Manzana Pink Lady Importada', clientIds: ['c2', 'c6'] },
  { id: 'f9', name: 'Manzana Verde Importada', clientIds: ['c3', 'c4'] },
  { id: 'f10', name: 'Naranja Importada', clientIds: ['c1', 'c2', 'c3', 'c4', 'c5'] },
  { id: 'f11', name: 'Pera Importada', clientIds: ['c2', 'c4', 'c6'] },
  { id: 'f12', name: 'Pomelo Importado', clientIds: ['c1', 'c3', 'c5'] },
  { id: 'f13', name: 'Uva Negra Sin Semilla Importada', clientIds: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] },
  { id: 'f14', name: 'Uva Red Globe Importada', clientIds: ['c2', 'c3', 'c5', 'c6'] },
  { id: 'f15', name: 'Uva Verde Sin Semilla Importada', clientIds: ['c1', 'c4', 'c6'] },
];

const PQR_TYPES = [
  { id: 'p1', category: 'Petición', name: 'Petición Administrativa', responsableSla: 5, clienteSla: 5 },
  { id: 'p2', category: 'Petición', name: 'Petición Calidad', responsableSla: 5, clienteSla: 5 },
  { id: 'q1', category: 'Queja', name: 'Queja de Presentación', responsableSla: 2, clienteSla: 5 },
  { id: 'q2', category: 'Queja', name: 'Queja de Calidad (Sin Dev)', responsableSla: 5, clienteSla: 10 },
  { id: 'q3', category: 'Queja', name: 'Queja de Servicio', responsableSla: 2, clienteSla: 5 },
  { id: 'q4', category: 'Queja', name: 'Queja de calidad (Rechazo)', responsableSla: 5, clienteSla: 10 },
  { id: 'r1', category: 'Reclamo', name: 'Reclamo Calidad (Con Dev)', responsableSla: 2, clienteSla: 5 },
  { id: 'r2', category: 'Reclamo', name: 'Reclamo Cantidad/Ajustes', responsableSla: 2, clienteSla: 5 },
  { id: 'r3', category: 'Reclamo', name: 'Reclamo Oportunidad', responsableSla: 2, clienteSla: 5 },
  { id: 's1', category: 'Sugerencia', name: 'Sugerencia Mejora', responsableSla: 5, clienteSla: 5 },
  { id: 'f1', category: 'Felicitación', name: 'Felicitación', responsableSla: 5, clienteSla: 5 },
];

const DEFINITIONS = [
  { term: 'Petición', def: 'Solicitud o requerimiento de una acción (Ej: Documentos, facturas).' },
  { term: 'Queja', def: 'Inconformidad con el servicio o producto. Usualmente NO implica devolución.' },
  { term: 'Reclamo', def: 'Oposición a una actuación injusta. En producto implica defectos y GENERALMENTE IMPLICA DEVOLUCIÓN.' },
  { term: 'PNC', def: 'Producto No Conforme. Debe ser segregado (Baja, Donación o Reproceso).' },
];

// --- FUNCIONES UTILITARIAS ---

const isTicketClosed = (status: Status): boolean => {
  return ['Cerrado', 'Cerrado Verificado'].includes(status);
};

const calculateDueDate = (startDate: string, businessDays: number): Date => {
  let count = 0;
  let currentDate = new Date(startDate);
  
  while (count < businessDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      count++;
    }
  }
  currentDate.setHours(17, 0, 0, 0); 
  return currentDate;
};

// --- COMPONENTES AUXILIARES ---

const StatusBadge = ({ status }: { status: Status }) => {
  const styles: Record<Status, string> = {
    'Nuevo': 'bg-blue-100 text-blue-800 border-blue-200',
    'Asignado': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'En Investigacion': 'bg-purple-100 text-purple-800 border-purple-200',
    'Pendiente RCA': 'bg-orange-100 text-orange-800 border-orange-200',
    'En Resolucion': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Pendiente Cierre': 'bg-teal-100 text-teal-800 border-teal-200',
    'En Seguimiento': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Cerrado': 'bg-green-100 text-green-800 border-green-200',
    'Cierre Temporal': 'bg-gray-100 text-gray-800 border-gray-200',
    'En Verificación de Acciones': 'bg-amber-100 text-amber-800 border-amber-200',
    'Cerrado Verificado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status}
    </span>
  );
};

// Componente para mostrar resultado de eficacia
const EficaciaResultBadge = ({ resultado }: { resultado?: ResultadoEficacia }) => {
  if (!resultado) return null;
  const isEficaz = resultado === 'EFICAZ';
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isEficaz ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
      {resultado}
    </span>
  );
};

// Función auxiliar para obtener número de seguimientos por criticidad
const getFollowUpCount = (criticidad?: Criticidad): number => {
  const counts: Record<Criticidad, number> = {
    'Crítica': 10,
    'Mayor Alta': 10,
    'Mayor Media': 5,
    'Menor Media': 5,
    'Menor Baja': 3,
    'Observación': 1,
  };
  return criticidad ? counts[criticidad] : 0;
};

const calculateTimerState = (createdAt: string, slaDays: number) => {
  const dueDate = calculateDueDate(createdAt, slaDays);
  const now = new Date();
  const difference = dueDate.getTime() - now.getTime();
  
  const absDiff = Math.abs(difference);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((absDiff / 1000 / 60) % 60);

  return { days, hours, minutes, expired: difference < 0 };
};

const SingleSLATimer = ({ createdAt, slaDays, label }: { createdAt: string, slaDays: number, label: string }) => {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, expired: boolean} | null>(null);

  useEffect(() => {
    const update = () => setTimeLeft(calculateTimerState(createdAt, slaDays));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [createdAt, slaDays]);

  if (!timeLeft) return <span className="text-xs text-gray-400">Calculando...</span>;

  let colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200"; 
  let icon = <Clock className="w-3 h-3 mr-1" />;
  let text = `${timeLeft.days}d ${timeLeft.hours}h`;

  if (timeLeft.expired) {
    colorClass = "bg-red-100 text-red-800 border-red-200 animate-pulse font-bold";
    icon = <AlertTriangle className="w-3 h-3 mr-1" />;
    text = `VENCIDO hace ${timeLeft.days}d`;
  } else if (timeLeft.days < 1) {
    colorClass = "bg-orange-100 text-orange-800 border-orange-200"; 
  }

  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium ${colorClass}`} title={`${label} vence: ${calculateDueDate(createdAt, slaDays).toLocaleDateString()}`}>
      {icon}
      <span>{label}: {text}</span>
    </div>
  );
};

const DualSLATimer = ({ createdAt, responsableSla, clienteSla, status }: { createdAt: string, responsableSla: number, clienteSla: number, status: Status }) => {
  if (status === 'Cerrado' || status === 'Cerrado Verificado') {
    return <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded"><CheckCircle className="w-3 h-3 mr-1"/> Completado</span>;
  }

  return (
    <div className="flex gap-2">
      <SingleSLATimer createdAt={createdAt} slaDays={responsableSla} label="Responsable" />
      <SingleSLATimer createdAt={createdAt} slaDays={clienteSla} label="Cliente" />
    </div>
  );
};

const UrgencyTimer = ({ createdAt, slaDays, status }: { createdAt: string, slaDays: number, status: Status }) => {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, expired: boolean} | null>(null);

  useEffect(() => {
    if (status === 'Cerrado') return;

    const dueDate = calculateDueDate(createdAt, slaDays);
    
    const calculateTime = () => {
      const now = new Date();
      const difference = dueDate.getTime() - now.getTime();
      
      const absDiff = Math.abs(difference);
      const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((absDiff / 1000 / 60) % 60);

      setTimeLeft({ 
        days, 
        hours, 
        minutes, 
        expired: difference < 0 
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000); 

    return () => clearInterval(timer);
  }, [createdAt, slaDays, status]);

  if (status === 'Cerrado') {
    return <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded"><CheckCircle className="w-3 h-3 mr-1"/> Completado</span>;
  }

  if (!timeLeft) return <span className="text-xs text-gray-400">Calculando...</span>;

  let colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200"; 
  let icon = <Clock className="w-3 h-3 mr-1" />;
  let text = `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`;

  if (timeLeft.expired) {
    colorClass = "bg-red-100 text-red-800 border-red-200 animate-pulse font-bold";
    icon = <AlertTriangle className="w-3 h-3 mr-1" />;
    text = `VENCIDO hace ${timeLeft.days}d ${timeLeft.hours}h`;
  } else if (timeLeft.days < 2) {
    colorClass = "bg-orange-100 text-orange-800 border-orange-200"; 
    if (timeLeft.days === 0 && timeLeft.hours < 24) {
        colorClass = "bg-red-50 text-red-600 border-red-200 font-bold"; 
    }
  }

  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium ${colorClass}`} title={`Vence: ${calculateDueDate(createdAt, slaDays).toLocaleDateString()}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: 'email' | 'whatsapp', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right z-50">
      <div className={`p-2 rounded-full ${type === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'}`}>
        {type === 'whatsapp' ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
      </div>
      <div>
        <h4 className="font-bold text-sm">Notificación Enviada</h4>
        <p className="text-xs text-gray-300">{message}</p>
      </div>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
    </div>
  );
};

const LoginScreen = ({ onLogin, users }: { onLogin: (user: UserProfile, isAdmin?: boolean) => void, users: UserProfile[] }) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const ADMIN_PASSWORD = 'Calera2025';

  const handleLogin = (user: UserProfile) => {
    // Si es admin o tiene contraseña asignada, pedir contraseña
    if (user.role === 'Admin' || (user.password && user.password.length > 0)) {
      setSelectedUser(user);
      setPassword('');
      setError('');
    } else {
      // Usuarios sin contraseña se loguean directamente
      onLogin(user, false);
    }
  };

  const handlePasswordLogin = () => {
    if (!selectedUser) return;

    // Admin requiere contraseña maestra
    if (selectedUser.role === 'Admin') {
      if (password === ADMIN_PASSWORD) {
        onLogin(selectedUser, true);
      } else {
        setError('Contraseña administrador incorrecta');
      }
      return;
    }

    // Usuarios con contraseña personal
    if (selectedUser.password && selectedUser.password.length > 0) {
      if (password === selectedUser.password) {
        onLogin(selectedUser, false);
      } else {
        setError('Contraseña incorrecta');
      }
      return;
    }
  };

  if (selectedUser && (selectedUser.role === 'Admin' || (selectedUser.password && selectedUser.password.length > 0))) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div className="bg-gradient-to-r from-purple-900 to-purple-700 p-8 text-center">
            <Lock className="w-12 h-12 text-white mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">{selectedUser.role === 'Admin' ? 'Acceso Administrador' : 'Acceso de Usuario'}</h1>
            <p className="text-purple-200 text-sm mt-2">Ingresa la contraseña para continuar</p>
          </div>
          <div className="p-8">
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-700">
                <span className="font-bold text-purple-900">{selectedUser.name}</span>
                <br />
                <span className="text-xs text-gray-600">{selectedUser.role} - {selectedUser.department}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handlePasswordLogin()}
                  placeholder="Ingresa la contraseña"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePasswordLogin}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Ingresar
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setPassword('');
                  setError('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Atrás
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-emerald-900 p-8 text-center">
          <div className="w-16 h-16 bg-white text-emerald-900 rounded-2xl flex items-center justify-center font-bold text-2xl mx-auto shadow-lg mb-4">LC</div>
          <h1 className="text-2xl font-bold text-white">La Calera QMS</h1>
          <p className="text-emerald-200 text-sm mt-1">Sistema de Gestión de Calidad</p>
        </div>
        <div className="p-8">
          <h2 className="text-gray-700 font-bold mb-6 text-center">Seleccione su Usuario</h2>
          <div className="space-y-3">
            {users.map(user => (
              <button 
                key={user.id}
                onClick={() => handleLogin(user)}
                className="w-full flex items-center p-3 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mr-4 shadow-sm
                  ${user.role === 'Admin' ? 'bg-purple-600' : 
                    user.role === 'Vendedor' ? 'bg-blue-500' : 
                    user.role === 'Responsable' ? 'bg-orange-500' : 'bg-gray-600'}`}
                >
                  {user.name.charAt(0)}
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-800 text-sm group-hover:text-emerald-700">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.role} - {user.department}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500" />
              </button>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t">
          © 2025 La Calera Colombia S.A.
        </div>
      </div>
    </div>
  );
};

const HistoryModule = ({ tickets, users, onViewDetail }: { tickets: Ticket[], users: UserProfile[], onViewDetail: (id: number) => void }) => {
  const [filters, setFilters] = useState({
    code: '',
    client: '',
    type: '',
    lote: '',
    status: '',
    responsible: '',
    order: '',
    invoice: ''
  });

  const filteredTickets = tickets.filter(t => {
    const clientName = CLIENTS.find(c => c.id === t.clientId)?.name.toLowerCase() || '';
    const typeName = PQR_TYPES.find(p => p.id === t.pqrTypeId)?.name.toLowerCase() || '';
    const respName = users.find(u => u.id === t.assignedToId)?.name.toLowerCase() || '';
    
    return (
      t.code.toLowerCase().includes(filters.code.toLowerCase()) &&
      clientName.includes(filters.client.toLowerCase()) &&
      typeName.includes(filters.type.toLowerCase()) &&
      t.lote.toLowerCase().includes(filters.lote.toLowerCase()) &&
      t.status.toLowerCase().includes(filters.status.toLowerCase()) &&
      respName.includes(filters.responsible.toLowerCase()) &&
      (t.purchaseOrder || '').toLowerCase().includes(filters.order.toLowerCase()) &&
      (t.invoiceNumber || '').toLowerCase().includes(filters.invoice.toLowerCase())
    );
  });

  return (
    <div className="space-y-4 animate-in fade-in">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
        <FileSpreadsheet className="w-6 h-6 text-emerald-600"/> Historial Global de PQRSF
      </h2>
      {/* Secciones rápidas: Casos para cierre vs Casos en verificación */}
      {(() => {
        const closeCandidates = tickets.filter(t => t.status === 'Pendiente Cierre' || t.status === 'Cierre Temporal');
        const verificationPending = tickets.filter(t => t.status === 'En Verificación de Acciones');
        return (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg border border-amber-100">
              <h3 
                onClick={() => setFilters({...filters, status: 'Pendiente Cierre'})}
                className="font-bold text-md text-amber-700 mb-2 cursor-pointer hover:bg-amber-100 p-2 rounded transition-colors"
                title="Click para filtrar por Pendiente Cierre"
              >
                Casos listos para cierre / Cierre Temporal ({closeCandidates.length})
              </h3>
              <ul className="text-sm space-y-2">
                {closeCandidates.slice(0,6).map(t => (
                  <li key={t.id} className="flex justify-between items-center p-2 border rounded hover:bg-amber-50">
                    <div>
                      <div className="font-medium">{t.code} — {CLIENTS.find(c => c.id === t.clientId)?.name}</div>
                      <div className="text-xs text-gray-500">{t.lote} • <StatusBadge status={t.status} /></div>
                    </div>
                    <button onClick={() => onViewDetail(t.id)} className="text-amber-600 hover:text-amber-800 px-2 py-1 rounded">Ver</button>
                  </li>
                ))}
                {closeCandidates.length === 0 && <li className="text-xs text-gray-500">No hay casos para cierre.</li>}
              </ul>
            </div>

            <div className="bg-white p-4 rounded-lg border border-lime-100">
              <h3 
                onClick={() => setFilters({...filters, status: 'En Verificación de Acciones'})}
                className="font-bold text-md text-lime-700 mb-2 cursor-pointer hover:bg-lime-100 p-2 rounded transition-colors"
                title="Click para filtrar por En Verificación de Acciones"
              >
                Casos en verificación de acciones ({verificationPending.length})
              </h3>
              <ul className="text-sm space-y-2">
                {verificationPending.slice(0,6).map(t => (
                  <li key={t.id} className="flex justify-between items-center p-2 border rounded hover:bg-lime-50">
                    <div>
                      <div className="font-medium">{t.code} — {CLIENTS.find(c => c.id === t.clientId)?.name}</div>
                      <div className="text-xs text-gray-500">{t.lote} • <StatusBadge status={t.status} /></div>
                    </div>
                    <button onClick={() => onViewDetail(t.id)} className="text-lime-600 hover:text-lime-800 px-2 py-1 rounded">Ver</button>
                  </li>
                ))}
                {verificationPending.length === 0 && <li className="text-xs text-gray-500">No hay casos en verificación.</li>}
              </ul>
            </div>
          </div>
        );
      })()}
      
      <div className="flex items-center justify-between">
        {filters.status && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-blue-700">Filtrado por: <strong>{filters.status}</strong></span>
          <button 
            onClick={() => setFilters({...filters, status: ''})}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1 bg-blue-100 rounded transition-colors"
          >
            ✕ Limpiar filtro
          </button>
        </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => exportHistoryCSV(tickets)} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Exportar CSV</button>
          <button onClick={() => exportHistoryXLSX(tickets)} className="px-3 py-1 bg-emerald-700 text-white rounded text-sm">Exportar XLSX</button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-500 min-w-[100px]">
                  Código
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.code} onChange={e => setFilters({...filters, code: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500 min-w-[140px]">
                  Vendedor
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.client} onChange={e => setFilters({...filters, client: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500 min-w-[150px]">
                  Cliente
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.client} onChange={e => setFilters({...filters, client: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500 min-w-[120px]">
                  Importación
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.lote} onChange={e => setFilters({...filters, lote: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500">
                  Tipo PQR
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500">
                  Ord. Compra
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.order} onChange={e => setFilters({...filters, order: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500">
                  Responsable
                  <input type="text" placeholder="..." className="mt-1 block w-full text-xs border-gray-300 rounded" 
                    value={filters.responsible} onChange={e => setFilters({...filters, responsible: e.target.value})} />
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500">Estado</th>
                <th className="px-4 py-3 text-center font-bold text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTickets.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{users.find(u => u.id === t.creatorId)?.name || 'N/A'}</div>
                    <div className="text-xs text-gray-400">{users.find(u => u.id === t.creatorId)?.email || ''} {users.find(u => u.id === t.creatorId)?.phone ? `• ${users.find(u => u.id === t.creatorId)?.phone}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">{CLIENTS.find(c => c.id === t.clientId)?.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.lote}</td>
                  <td className="px-4 py-3">{PQR_TYPES.find(p => p.id === t.pqrTypeId)?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.purchaseOrder || '-'}</td>
                  <td className="px-4 py-3">
                    {users.find(u => u.id === t.assignedToId) ? (
                      <div>
                        <div className="font-medium">{users.find(u => u.id === t.assignedToId)?.name}</div>
                        <div className="text-xs text-gray-400">{users.find(u => u.id === t.assignedToId)?.email || ''} {users.find(u => u.id === t.assignedToId)?.phone ? `• ${users.find(u => u.id === t.assignedToId)?.phone}` : ''}</div>
                      </div>
                    ) : <span className="text-gray-400 italic">Sin Asignar</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => onViewDetail(t.id)}
                      className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 p-1.5 rounded transition-colors"
                      title="Ver Ficha Completa"
                    >
                      <Eye className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No se encontraron resultados con los filtros actuales.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Componente: Histórico personal / por usuario (se muestra en el dashboard cuando se selecciona 'Histórico')
const DashboardHistory = ({ tickets, users, currentUser }: { tickets: Ticket[], users: UserProfile[], currentUser: UserProfile }) => {
  const filtered = useMemo(() => {
    if (!currentUser) return [] as Ticket[];
    if (currentUser.role === 'Admin') return tickets;
    if (currentUser.role === 'Responsable') {
      // Responsables ven: 
      // 1) Tickets asignados a ellos
      // 2) Tickets donde participaron (RCA, seguimientos, efectividad)
      return tickets.filter(t => 
        t.assignedToId === currentUser.id || // Asignado al responsable
        t.rca?.analystId === currentUser.id || // Hizo el RCA
        t.effectiveness?.inspectorId === currentUser.id || // Hizo verificación de efectividad
        (t.followUps && t.followUps.some(f => f.completedBy === currentUser.id)) // Completó seguimientos
      );
    }
    if (currentUser.role === 'Vendedor') return tickets.filter(t => t.creatorId === currentUser.id);
    if (currentUser.role === 'Gerente') return tickets;
    return [] as Ticket[];
  }, [tickets, currentUser]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-600"/> Histórico de PQRSF</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
              <tr>
              <th className="px-3 py-2 text-left font-bold text-gray-600"># PQRS</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Vendedor</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Cliente</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Clasificación</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Producto / Cantidad</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Responsable</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Descripción</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Causas</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Acción Correctiva</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Acción Preventiva</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Seguimientos</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Resultado</th>
              <th className="px-3 py-2 text-left font-bold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 align-top">
                <td className="px-3 py-2 font-medium">{t.code}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{users.find(u => u.id === t.creatorId)?.name || 'N/A'}</div>
                  <div className="text-xs text-gray-400">{users.find(u => u.id === t.creatorId)?.email || ''} {users.find(u => u.id === t.creatorId)?.phone ? `• ${users.find(u => u.id === t.creatorId)?.phone}` : ''}</div>
                </td>
                <td className="px-3 py-2">{CLIENTS.find(c => c.id === t.clientId)?.name || 'N/A'}</td>
                <td className="px-3 py-2">{PQR_TYPES.find(p => p.id === t.pqrTypeId)?.name || ''}</td>
                <td className="px-3 py-2">{FRUITS.find(f => f.id === t.fruitId)?.name || ''} {t.returnQuantity ? ` / ${t.returnQuantity}` : ''}</td>
                <td className="px-3 py-2">{users.find(u => u.id === t.assignedToId) ? (
                  <div>
                    <div className="font-medium">{users.find(u => u.id === t.assignedToId)?.name}</div>
                    <div className="text-xs text-gray-400">{users.find(u => u.id === t.assignedToId)?.email || ''} {users.find(u => u.id === t.assignedToId)?.phone ? `• ${users.find(u => u.id === t.assignedToId)?.phone}` : ''}</div>
                  </div>
                ) : 'Sin Asignar'}</td>
                <td className="px-3 py-2 max-w-xs truncate">{t.description}</td>
                <td className="px-3 py-2 max-w-xs truncate">{t.rca?.rootCause || ''}</td>
                <td className="px-3 py-2 max-w-xs truncate">{t.rca?.correctiveAction || ''}</td>
                <td className="px-3 py-2 max-w-xs truncate">{t.rca?.preventiveAction || ''}</td>
                <td className="px-3 py-2 max-w-xs text-xs">
                  {(t.followUps || []).map(f => `${f.number}:${f.status}${f.cumplimiento ? ` (${f.cumplimiento})` : ''}`).join(' | ') || '-' }
                </td>
                <td className="px-3 py-2">{t.resultadoEficacia || '-'}</td>
                <td className="px-3 py-2">{t.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-gray-500">No hay registros para mostrar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Export helper: builds CSV with follow-up columns up to 10
const exportHistoryCSV = (tickets: Ticket[]) => {
  const maxFollowUps = 10;
  const headers = [
    'Código','Cliente','Importación','Tipo PQR','Orden Compra','Factura','Responsable','Estado','Criticidad','ResultadoEficacia','Cumplidos','NoCumplidos'
  ];
  for (let i = 1; i <= maxFollowUps; i++) {
    headers.push(`FollowUp_${i}_Estado`);
    headers.push(`FollowUp_${i}_Cumplimiento`);
    headers.push(`FollowUp_${i}_Observaciones`);
  }

  const rows = tickets.map(t => {
    const clientName = CLIENTS.find(c => c.id === t.clientId)?.name || '';
    const tipo = PQR_TYPES.find(p => p.id === t.pqrTypeId)?.name || '';
    const resp = (USERS.find(u => u.id === t.assignedToId)?.name) || '';
    const cumplidos = t.cumplimientoCount?.cumplidos ?? (t.followUps ? t.followUps.filter(f => f.cumplimiento === 'Cumplió').length : 0);
    const noCumplidos = t.cumplimientoCount?.noCumplidos ?? (t.followUps ? t.followUps.filter(f => f.cumplimiento === 'No Cumplió').length : 0);

    const base = [t.code, clientName, t.lote, tipo, t.purchaseOrder || '', t.invoiceNumber || '', resp, t.status, t.criticidad || '', t.resultadoEficacia || '', String(cumplidos), String(noCumplidos)];

    const fuCells: string[] = [];
    for (let i = 0; i < maxFollowUps; i++) {
      const f = (t.followUps && t.followUps[i]) || null;
      fuCells.push(f ? f.status : '');
      fuCells.push(f ? (f.cumplimiento || '') : '');
      fuCells.push(f ? (f.observaciones || '') : '');
    }

    return base.concat(fuCells);
  });

  const escapeCell = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csv = [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historial_pqrsf_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// XLSX export using SheetJS
const exportHistoryXLSX = (tickets: Ticket[]) => {
  const maxFollowUps = 10;
  const headers = [
    'Código','Cliente','Importación','Tipo PQR','Orden Compra','Factura','Responsable','Estado','Criticidad','ResultadoEficacia','Cumplidos','NoCumplidos'
  ];
  for (let i = 1; i <= maxFollowUps; i++) {
    headers.push(`FollowUp_${i}_Estado`);
    headers.push(`FollowUp_${i}_Cumplimiento`);
    headers.push(`FollowUp_${i}_Observaciones`);
  }

  const data = tickets.map(t => {
    const clientName = CLIENTS.find(c => c.id === t.clientId)?.name || '';
    const tipo = PQR_TYPES.find(p => p.id === t.pqrTypeId)?.name || '';
    const resp = (USERS.find(u => u.id === t.assignedToId)?.name) || '';
    const cumplidos = t.cumplimientoCount?.cumplidos ?? (t.followUps ? t.followUps.filter(f => f.cumplimiento === 'Cumplió').length : 0);
    const noCumplidos = t.cumplimientoCount?.noCumplidos ?? (t.followUps ? t.followUps.filter(f => f.cumplimiento === 'No Cumplió').length : 0);

    const base: any[] = [t.code, clientName, t.lote, tipo, t.purchaseOrder || '', t.invoiceNumber || '', resp, t.status, t.criticidad || '', t.resultadoEficacia || '', cumplidos, noCumplidos];
    for (let i = 0; i < maxFollowUps; i++) {
      const f = (t.followUps && t.followUps[i]) || null;
      base.push(f ? f.status : '');
      base.push(f ? (f.cumplimiento || '') : '');
      base.push(f ? (f.observaciones || '') : '');
    }
    return base;
  });

  const aoa = [headers].concat(data);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial');
  XLSX.writeFile(wb, `historial_pqrsf_${new Date().toISOString().slice(0,10)}.xlsx`);
};

const AnalyticsDashboard = ({ tickets, title }: { tickets: Ticket[], title?: string }) => {
  // 1. Cálculos de Fechas
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 2. Filtrado Mes Actual
  const monthTickets = tickets.filter(t => {
    const d = new Date(t.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // 3. Métricas Mensuales
  const monthTotal = monthTickets.length;
  const monthClosed = monthTickets.filter(t => isTicketClosed(t.status)).length;
  const monthPending = monthTotal - monthClosed;
  const monthEfficiency = monthTotal > 0 ? Math.round((monthClosed / monthTotal) * 100) : 0;

  // 4. Métricas Históricas (Total Global)
  const historyTotal = tickets.length;
  const historyClosed = tickets.filter(t => isTicketClosed(t.status)).length;
  const historyPending = historyTotal - historyClosed;

  // 5. Cliente más Crítico (Global)
  const clientStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.clientId] = (counts[t.clientId] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { id: sorted[0][0], count: sorted[0][1] } : null;
  }, [tickets]);
  const topClientName = clientStats ? CLIENTS.find(c => c.id === clientStats.id)?.name : 'N/A';

  // 6. Top Importaciones (Global)
  const loteStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.lote] = (counts[t.lote] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5); 
  }, [tickets]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
        <BarChart3 className="w-6 h-6 text-emerald-600"/> {title || 'Inteligencia de Negocio'}
      </h2>

      {/* SECCIÓN 1: GESTIÓN DEL MES ACTUAL */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-2"/> Indicadores del Mes Actual
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs font-bold text-blue-600 uppercase">Total Mes</p>
            <span className="text-3xl font-bold text-blue-900">{monthTotal}</span>
            <p className="text-xs text-blue-400 mt-1">Radicados</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <p className="text-xs font-bold text-green-600 uppercase">Resueltas Mes</p>
            <span className="text-3xl font-bold text-green-900">{monthClosed}</span>
            <p className="text-xs text-green-400 mt-1">Cerradas</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
            <p className="text-xs font-bold text-orange-600 uppercase">Pendientes Mes</p>
            <span className="text-3xl font-bold text-orange-900">{monthPending}</span>
            <p className="text-xs text-orange-400 mt-1">En proceso</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase">Eficacia Mensual</p>
            <div className="flex items-end justify-between">
               <span className={`text-3xl font-bold ${monthEfficiency >= 90 ? 'text-emerald-600' : 'text-yellow-600'}`}>{monthEfficiency}%</span>
               <TrendingUp className="w-5 h-5 text-gray-400 mb-1"/>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: ACUMULADO HISTÓRICO Y ANÁLISIS */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
          <History className="w-4 h-4 mr-2"/> Acumulado Histórico & Análisis
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4">Estado Global de la Cartera</h4>
            <div className="flex items-center justify-center py-4">
               <div className="text-center px-6 border-r border-gray-100">
                 <span className="block text-4xl font-bold text-gray-800">{historyTotal}</span>
                 <span className="text-xs text-gray-500 uppercase">Total Histórico</span>
               </div>
               <div className="text-center px-6">
                 <span className="block text-4xl font-bold text-orange-600">{historyPending}</span>
                 <span className="text-xs text-orange-500 uppercase font-bold">Por Resolver</span>
               </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-xs font-bold text-gray-500">Cliente + Crítico</span>
                 <span className="text-xs font-bold text-red-600">{clientStats?.count} casos</span>
               </div>
               <div className="text-sm font-medium text-gray-800 truncate" title={topClientName}>{topClientName}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4">Distribución por Criticidad</h4>
            <div className="space-y-2">
              {(() => {
                const counts: Record<Criticidad | 'Sin Asignar', number> = { 'Crítica':0,'Mayor Alta':0,'Mayor Media':0,'Menor Media':0,'Menor Baja':0,'Observación':0,'Sin Asignar':0 };
                tickets.forEach(t => { if (t.criticidad) counts[t.criticidad] = (counts[t.criticidad] || 0) + 1; else counts['Sin Asignar']++; });
                const total = tickets.length || 1;
                return Object.entries(counts).map(([k,v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">{k}</div>
                    <div className="text-sm font-bold text-gray-800">{v} <span className="text-xs text-gray-400">({Math.round((v/total)*100)}%)</span></div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4">Tasa de Eficacia General</h4>
            <div className="text-center py-6">
              {(() => {
                try {
                  const evaluated = tickets?.filter(t => t?.resultadoEficacia) || [];
                  const eficaz = evaluated?.filter(t => t?.resultadoEficacia === 'EFICAZ')?.length || 0;
                  const total = evaluated?.length || 0;
                  const tasa = total > 0 ? Math.round((eficaz / total) * 100) : 0;
                  
                  return (
                    <>
                      <div className={`text-4xl font-bold ${tasa >= 80 ? 'text-emerald-600' : tasa >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {isNaN(tasa) ? '0' : tasa}%
                      </div>
                      <div className="text-sm text-gray-500 mt-2">
                        Casos evaluados: {total} • EFICAZ: {eficaz}
                      </div>
                    </>
                  );
                } catch (error) {
                  console.error('Error calculando eficacia:', error);
                  return <div className="text-red-500">Error en cálculo</div>;
                }
              })()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
              <Package className="w-4 h-4 mr-2 text-indigo-500"/> Importaciones Problemáticas (Top 5)
            </h4>
            <div className="space-y-3">
              {loteStats.length === 0 && <p className="text-sm text-gray-400 italic">No hay datos suficientes.</p>}
              {loteStats.map(([lote, count], idx) => (
                <div key={lote} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{lote}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                      <div className="h-full bg-indigo-400" style={{ width: `${(count / (loteStats[0][1] || 1)) * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-gray-600">{count} PQRS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* SECCIÓN 3: ESTADÍSTICAS POR RESPONSABLE (MEJORADA) */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
          <Users className="w-4 h-4 mr-2"/> Desempeño por Responsable de Calidad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => {
            try {
              // Obtener IDs únicos de todos los responsables asignados en tickets
              const assignedResponsableIds = new Set<string>();
              tickets?.forEach(t => {
                if (t?.assignedToId) assignedResponsableIds.add(t.assignedToId);
              });
              
              // Combinar usuarios con rol Responsable + usuarios con tickets asignados
              const responsables = USERS?.filter(u => 
                u?.role === 'Responsable' || 
                u?.department === 'Calidad' ||
                u?.department === 'Logística' ||
                u?.department === 'Producción' ||
                assignedResponsableIds.has(u?.id)
              ) || [];
              
              if (responsables.length === 0) {
                return <div className="col-span-3 text-center text-gray-400 py-4">No hay responsables configurados</div>;
              }

              return responsables.map(responsable => {
                if (!responsable?.id) return null;
                
                // Diferenciar entre Responsable Inicial (asignado) y Responsable de Calidad (que cierra)
                const isCalidadResponsable = responsable.department === 'Calidad' || responsable.id === 'u1' || responsable.id === '2';
                
                let assignedTickets;
                if (isCalidadResponsable) {
                  // Para Calidad: TODOS los tickets le corresponde cerrar/evaluar
                  assignedTickets = tickets || [];
                } else {
                  // Para Responsables normales: solo tickets asignados directamente
                  assignedTickets = tickets?.filter(t => {
                    if (!t) return false;
                    return t.assignedToId === responsable.id;
                  }) || [];
                }
                
                // 🔍 DEBUG
                console.log(`📊 Responsable: ${responsable.name} (ID: ${responsable.id}, Dept: ${responsable.department})`);
                console.log(`   Asignados encontrados: ${assignedTickets.length}`);
                if (assignedTickets.length > 0) {
                  console.log(`   IDs de tickets: ${assignedTickets.map(t => `#${t.id}(assignedTo:${t.assignedToId})`).join(', ')}`);
                }
                
                const closedTickets = assignedTickets?.filter(t => t?.status === 'Cerrado' || t?.status === 'Cerrado Verificado') || [];
                // Respondidos = tickets que ya tienen resultadoEficacia O tickets donde participó en RCA
                const respondedTickets = assignedTickets?.filter(t => t?.resultadoEficacia || t?.rca?.analystId === responsable.id) || [];
                const pendingTickets = assignedTickets?.filter(t => !t?.resultadoEficacia && t?.status !== 'Nuevo' && t?.status !== 'Cerrado' && t?.status !== 'Cerrado Verificado') || [];
                const eficazTickets = respondedTickets?.filter(t => t?.resultadoEficacia === 'EFICAZ') || [];
                
                const eficaciaRate = respondedTickets?.length > 0 ? Math.round((eficazTickets.length / respondedTickets.length) * 100) : 0;
                const closureRate = assignedTickets?.length > 0 ? Math.round((closedTickets.length / assignedTickets.length) * 100) : 0;
                const responseRate = assignedTickets?.length > 0 ? Math.round((respondedTickets.length / assignedTickets.length) * 100) : 0;

                return (
                  <div key={responsable.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{responsable.name || 'Sin nombre'}</h4>
                        <p className="text-xs text-gray-500">{responsable.department || 'Sin departamento'}</p>
                      </div>
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {responsable.name?.charAt(0) || '?'}
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="text-gray-700">{isCalidadResponsable ? 'Total Casos a Cerrar' : 'Asignados Inicialmente'}</span>
                        <span className="font-bold text-blue-600">{isNaN(assignedTickets.length) ? 0 : assignedTickets.length}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                        <span className="text-gray-700">Pendientes</span>
                        <span className="font-bold text-yellow-600">{isNaN(pendingTickets.length) ? 0 : pendingTickets.length}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                        <span className="text-gray-700">Cerrados</span>
                        <span className="font-bold text-green-600">{isNaN(closedTickets.length) ? 0 : closedTickets.length} ({isNaN(closureRate) ? 0 : closureRate}%)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                        <span className="text-gray-700">Eficacia</span>
                        <span className={`font-bold ${eficaciaRate >= 80 ? 'text-emerald-600' : eficaciaRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {isNaN(eficaciaRate) ? 0 : eficaciaRate}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-indigo-50 rounded text-xs">
                        <span className="text-gray-700">Respondidos</span>
                        <span className="font-bold text-indigo-600">{isNaN(respondedTickets.length) ? 0 : respondedTickets.length} ({isNaN(responseRate) ? 0 : responseRate}%)</span>
                      </div>
                    </div>
                  </div>
                );
              });
            } catch (error) {
              console.error('Error mostrando estadísticas por responsable:', error);
              return <div className="col-span-3 text-center text-red-500 py-4">Error al cargar estadísticas</div>;
            }
          })()}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE DETALLE CON EDICIÓN RCA ---
const TicketDetailView = ({
  currentTicket,
  currentUser,
  users,
  onAssign,
  onStatusChange,
  onSubmitRCA,
  onUpdateRCA,
  onClose,
  onReturnToAnalyst,
  onBack,
  history,
  onGeneratePDF,
  onTemporaryClosure,
  onVerificationSubmit,
  onMarkFollowUp: onMarkFollowUpProp,
  onEvaluateFollowUps: onEvaluateFollowUpsProp
}: {
  currentTicket: Ticket,
  currentUser: UserProfile,
  users: UserProfile[],
  onAssign: (id: number, userId: string) => void,
  onStatusChange: (id: number, status: Status, comment: string) => void,
  onSubmitRCA: (id: number, rca: RCA) => void,
  onUpdateRCA: (id: number, rca: RCA) => void,
  onClose: (id: number) => void,
  onReturnToAnalyst: (id: number, analystId: string, comment: string) => void,
  onBack: () => void,
  history?: HistoryLog[],
  onGeneratePDF?: (ticket: Ticket) => void,
  onTemporaryClosure?: (id: number, criticidad?: Criticidad) => void,
  onVerificationSubmit?: (id: number, verification: EffectivenessVerification) => void,
  onMarkFollowUp?: (ticketId: number, followUpId: string, cumplimiento: 'Cumplió' | 'No Cumplió', observaciones?: string) => void,
  onEvaluateFollowUps?: (ticketId: number) => void
}) => {
  // Variables locales para guardar referencias a las funciones
  const onMarkFollowUp = onMarkFollowUpProp;
  const onEvaluateFollowUps = onEvaluateFollowUpsProp;
  const isAssignee = currentUser.id === currentTicket.assignedToId;
  const isAdmin = currentUser.role === 'Admin';
  const isQuality = currentUser.role === 'Responsable' && currentUser.department === 'Calidad';
  // ✅ Sandra Roa es Calidad, puede tener ID "u1" O "2" (depende de si viene de DB o de USERS)
  const isQualityLead = currentUser?.id === 'u1' || currentUser?.id === '2' || isQuality;
  const [isEditingRca, setIsEditingRca] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [verificationActions, setVerificationActions] = useState<VerificationAction[]>(
    currentTicket.effectiveness?.actions || []
  );
  const [verificationComments, setVerificationComments] = useState(
    currentTicket.effectiveness?.overallComments || ''
  );
  const [followUpNotes, setFollowUpNotes] = useState<Record<string,string>>({});
  const [followUpSelection, setFollowUpSelection] = useState<Record<string,'Cumplió'|'No Cumplió'>>({});
  
  const [rcaForm, setRcaForm] = useState<Partial<RCA>>({ 
    rootCause: currentTicket.rca?.rootCause || '', 
    correctiveAction: currentTicket.rca?.correctiveAction || '', 
    preventiveAction: currentTicket.rca?.preventiveAction || '' 
  });

  // Actualizar el formulario si el ticket cambia
  useEffect(() => {
    if (currentTicket.rca) {
      setRcaForm(currentTicket.rca);
    }
    if (currentTicket.effectiveness) {
      setVerificationActions(currentTicket.effectiveness.actions);
      setVerificationComments(currentTicket.effectiveness.overallComments);
    }
    if (currentTicket.followUps && currentTicket.followUps.length > 0) {
      const notes: Record<string,string> = {};
      const sel: Record<string,'Cumplió'|'No Cumplió'> = {};
      currentTicket.followUps.forEach(f => { notes[f.id] = f.observaciones || ''; if (f.cumplimiento) sel[f.id] = f.cumplimiento; });
      setFollowUpNotes(notes);
      setFollowUpSelection(sel);
    }
  }, [currentTicket]);

  return (
    <div className="bg-white p-8 rounded-xl shadow border border-gray-200 max-w-5xl mx-auto animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-6 pb-6 border-b">
          <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  {currentTicket.code}
                  <StatusBadge status={currentTicket.status} />
                  <span className="ml-3"><EficaciaResultBadge resultado={currentTicket.resultadoEficacia} /></span>
                </h2>
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-1"/> Creado: {new Date(currentTicket.createdAt).toLocaleString()}</span>
                    <span className="flex items-center"><User className="w-4 h-4 mr-1"/> Por: {users.find(u=>u.id===currentTicket.creatorId)?.name}</span>
                    <span className="flex items-center text-blue-600 font-medium"><AlertTriangle className="w-4 h-4 mr-1"/> Clasificación: {PQR_TYPES.find(p => p.id === currentTicket.pqrTypeId)?.name || 'N/A'}</span>
                </div>
          </div>
          <div className="text-right">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Tiempos de Respuesta</p>
              <DualSLATimer createdAt={currentTicket.createdAt} responsableSla={currentTicket.responsableSla || 5} clienteSla={currentTicket.clienteSla || 10} status={currentTicket.status} />
          </div>
      </div>

      {/* INFO GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <span className="block text-xs font-bold text-gray-500">Orden Compra</span>
            <span>{currentTicket.purchaseOrder || 'N/A'}</span>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <span className="block text-xs font-bold text-gray-500">Factura</span>
            <span>{currentTicket.invoiceNumber || 'N/A'}</span>
          </div>
          {currentTicket.returnQuantity && (
            <div className="bg-red-50 p-3 rounded border border-red-100">
              <span className="block text-xs font-bold text-red-600">Devolución</span>
              <span className="font-bold text-red-800">{currentTicket.returnQuantity} Unidades</span>
            </div>
          )}
          <div className="bg-gray-50 p-3 rounded">
            <span className="block text-xs font-bold text-gray-500">Lote</span>
            <span>{currentTicket.lote}</span>
          </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="font-bold text-gray-800 mb-2">Descripción del Caso</h3>
          <p className="text-gray-700">{currentTicket.description}</p>
      </div>

      {/* EVIDENCIAS Y ARCHIVOS */}
      <div className="bg-blue-50 p-6 rounded-lg mb-6 border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600"/> Evidencias y Archivos Adjuntos
          </h3>
          
          {currentTicket.evidenceLink && (
            <div className="mb-4 p-3 bg-white rounded border border-blue-200">
              <p className="text-xs font-bold text-gray-600 mb-1">Link Drive:</p>
              <a 
                href={currentTicket.evidenceLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm break-all flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3"/> {currentTicket.evidenceLink}
              </a>
            </div>
          )}

          {!currentTicket.evidenceLink && (
            <p className="text-sm text-gray-500 italic">No hay enlace de evidencia (Google Drive) agregado a este ticket.</p>
          )}
      </div>

      {/* BARRA DE ACCIONES */}

      {/* SECCIÓN: Seguimientos (Follow-ups) */}
      {currentTicket.followUps && currentTicket.followUps.length > 0 && (
        <div className="bg-white p-4 rounded-lg mb-6 border border-cyan-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-cyan-800">Seguimientos Programados</h3>
            <span className="text-xs bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full font-bold">
              {currentTicket.followUps.filter(f => f.status === 'Completado').length} / {currentTicket.followUps.length} completados
            </span>
          </div>
          <div className="space-y-3">
            {currentTicket.followUps.map(f => {
              const isCompleted = f.status === 'Completado';
              const isCumplido = f.cumplimiento === 'Cumplió';
              const isNoCumplido = f.cumplimiento === 'No Cumplió';
              
              return (
                <div key={f.id} className={`p-3 border rounded ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-cyan-50 border-cyan-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-bold flex items-center gap-2">
                        Seguimiento #{f.number}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-200 text-green-800">
                            ✓ Completado
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">{f.description}</div>
                      {isCompleted && f.completedBy && (
                        <div className="text-xs text-gray-500 mt-1">
                          Completado por: <strong>{users.find(u => u.id === f.completedBy)?.name || f.completedBy}</strong> el {f.completedAt ? new Date(f.completedAt).toLocaleDateString('es-CO') : ''}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold px-2 py-0.5 rounded ${isCumplido ? 'bg-green-200 text-green-800' : isNoCumplido ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'}`}>
                        {f.cumplimiento ? f.cumplimiento : 'Pendiente'}
                      </div>
                    </div>
                  </div>

                {/* Solo mostrar formulario si NO está completado */}
                {!isCompleted && isQuality && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                    <textarea
                      className="col-span-2 w-full border p-2 rounded text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      rows={2}
                      placeholder="Escriba observaciones del seguimiento..."
                      value={followUpNotes[f.id] || ''}
                      onChange={e => setFollowUpNotes(prev => ({ ...prev, [f.id]: e.target.value }))}
                    />

                    <div className="flex flex-col gap-2">
                      <select
                        value={followUpSelection[f.id] || ''}
                        onChange={e => setFollowUpSelection(prev => ({ ...prev, [f.id]: e.target.value as 'Cumplió' | 'No Cumplió' }))}
                        className="border rounded p-2 text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white"
                      >
                        <option value="">-- Seleccione --</option>
                        <option value="Cumplió">✓ Cumplió</option>
                        <option value="No Cumplió">✗ No Cumplió</option>
                      </select>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const sel = followUpSelection[f.id];
                            const note = followUpNotes[f.id] || '';

                            if (!sel) { 
                              alert('❌ Por favor selecciona Cumplió o No Cumplió'); 
                              return; 
                            }

                            // Guardar el seguimiento
                            try {
                              if (typeof onMarkFollowUp === 'function') {
                                onMarkFollowUp(currentTicket.id, f.id, sel, note);

                                // Limpiar formulario después de guardar
                                setFollowUpNotes(prev => {
                                  const updated = { ...prev };
                                  delete updated[f.id];
                                  return updated;
                                });
                                setFollowUpSelection(prev => {
                                  const updated = { ...prev };
                                  delete updated[f.id];
                                  return updated;
                                });
                                
                                alert(`✅ Seguimiento #${f.number} guardado exitosamente como: ${sel}`);
                              } else {
                                console.error('❌ onMarkFollowUp no es una función:', onMarkFollowUp);
                                alert('❌ Error: La función de guardado no está disponible');
                              }
                            } catch (error) {
                              console.error('❌ Error al guardar:', error);
                              alert(`❌ Error al guardar: ${error}`);
                            }
                          }}
                          className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 font-medium transition-colors"
                        >
                          ✓ Guardar
                        </button>

                        <button
                          onClick={() => { 
                            setFollowUpNotes(prev => {
                              const updated = { ...prev };
                              delete updated[f.id];
                              return updated;
                            }); 
                            setFollowUpSelection(prev => {
                              const updated = { ...prev };
                              delete updated[f.id];
                              return updated;
                            });
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-100 font-medium transition-colors"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mostrar resumen si está completado */}
                {isCompleted && (
                  <div className={`mt-3 p-3 rounded-lg ${isCumplido ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <div className="text-sm font-bold mb-1">
                      {isCumplido ? '✓ Cumplimiento Verificado' : '✗ Incumplimiento Registrado'}
                    </div>
                    {f.observaciones && (
                      <div className="text-xs text-gray-700 mb-1">
                        <strong>Observaciones:</strong> {f.observaciones}
                      </div>
                    )}
                    {f.completedAt && (
                      <div className="text-xs text-gray-600">
                        Registrado el: {new Date(f.completedAt).toLocaleDateString('es-CO', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} a las {new Date(f.completedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}

            <div className="flex justify-end">
              {isQuality && !currentTicket.resultadoEficacia && !isTicketClosed(currentTicket.status) && (
                <button onClick={() => { if (onEvaluateFollowUps) onEvaluateFollowUps(currentTicket.id); }} className="bg-emerald-600 text-white px-4 py-2 rounded">Evaluar y Cerrar Caso</button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
         <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-700"/>
            <span className="text-sm font-medium text-emerald-900">
              Responsable: <strong>{users.find(u => u.id === currentTicket.assignedToId)?.name || 'Sin Asignar'}</strong>
            </span>
         </div>

         <div className="flex gap-2">
            {onGeneratePDF && (
              <button 
                onClick={() => onGeneratePDF(currentTicket)}
                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium flex items-center gap-2"
                title="Descargar PDF del PQR"
              >
                <Download className="w-4 h-4"/> Descargar PDF
              </button>
            )}

            {isAdmin && currentTicket.status === 'Nuevo' && (
               <div className="flex gap-2">
                  <select id="assignSelect" className="text-sm border-gray-300 rounded p-1">
                     <option value="">Seleccionar...</option>
                     {users.filter(u => u.role === 'Responsable').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <button onClick={() => {
                      const selectEl = document.getElementById('assignSelect') as HTMLSelectElement | null;
                      if(selectEl && selectEl.value) onAssign(currentTicket.id, selectEl.value);
                  }} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700">Asignar</button>
               </div>
            )}

            {isAssignee && currentTicket.status === 'Asignado' && (
               <button onClick={() => onStatusChange(currentTicket.id, 'Pendiente RCA', 'Investigación Iniciada')} 
               className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">
                  Iniciar Investigación
               </button>
            )}

            {isAssignee && currentTicket.status === 'En Resolucion' && !isEditingRca && (
               <button onClick={() => setIsEditingRca(true)} 
               className="bg-orange-500 text-white px-4 py-2 rounded shadow hover:bg-orange-600 font-medium flex items-center">
                  <Edit className="w-4 h-4 mr-2"/> Editar Análisis
               </button>
            )}

            {isAssignee && currentTicket.status === 'En Resolucion' && !isEditingRca && (
               <button onClick={() => onStatusChange(currentTicket.id, 'Pendiente Cierre', 'Acciones Ejecutadas')} 
               className="bg-teal-600 text-white px-4 py-2 rounded shadow hover:bg-teal-700 font-medium">
                  Marcar como Resuelto
               </button>
            )}

            {(isAdmin || isQuality) && currentTicket.status === 'Pendiente Cierre' && (
              <>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      if (onTemporaryClosure) {
                        onTemporaryClosure(currentTicket.id);
                      }
                    }} className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                      Cierre Temporal
                    </button>
                      {!returnOpen && (
                        <button onClick={() => { setReturnOpen(true); setReturnComment(''); }} className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 font-medium">
                          Devolver al Investigador
                        </button>
                      )}

                      {returnOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white border rounded p-3 shadow-lg z-50 text-gray-800">
                          <label className="block text-xs font-bold text-gray-600">Comentario para el investigador</label>
                          <textarea className="w-full mt-2 p-2 border rounded text-sm" rows={3} value={returnComment} onChange={e => setReturnComment(e.target.value)} />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => { setReturnOpen(false); setReturnComment(''); }} className="px-3 py-1 border rounded text-sm">Cancelar</button>
                            <button onClick={() => {
                              const analystId = currentTicket.rca?.analystId || currentTicket.assignedToId;
                              if (!analystId) {
                                alert('No se encontró el investigador asignado para este análisis.');
                                return;
                              }
                              onReturnToAnalyst(currentTicket.id, analystId, returnComment || 'Se reenvía para revisión');
                              setReturnOpen(false);
                              setReturnComment('');
                            }} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Enviar Devolución</button>
                          </div>
                        </div>
                      )}
                    </div>
                )}

                {isQualityLead && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Criticidad</label>
                      <select id={`criticidad-select-${currentTicket.id}`} defaultValue="Observación" className="border rounded p-1 text-sm" onChange={() => {}}
                      >
                        <option>Crítica</option>
                        <option>Mayor Alta</option>
                        <option>Mayor Media</option>
                        <option>Menor Media</option>
                        <option>Menor Baja</option>
                        <option>Observación</option>
                      </select>
                    </div>

                    <button onClick={() => {
                      const select = document.getElementById(`criticidad-select-${currentTicket.id}`) as HTMLSelectElement | null;
                      const criticidad = select ? (select.value as Criticidad) : undefined;
                      if (onTemporaryClosure) {
                        onTemporaryClosure(currentTicket.id, criticidad);
                      }
                    }} 
                    className="bg-cyan-600 text-white px-4 py-2 rounded shadow hover:bg-cyan-700 font-medium">
                        Cierre Temporal + Verificación
                    </button>

                    <button onClick={() => onClose(currentTicket.id)} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 font-medium">
                      Cerrar Caso (Calidad)
                    </button>

                    <div className="relative">
                      {!returnOpen && (
                        <button onClick={() => { setReturnOpen(true); setReturnComment(''); }} className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 font-medium">
                          Devolver al Investigador
                        </button>
                      )}

                      {returnOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white border rounded p-3 shadow-lg z-50 text-gray-800">
                          <label className="block text-xs font-bold text-gray-600">Comentario para el investigador</label>
                          <textarea className="w-full mt-2 p-2 border rounded text-sm" rows={3} value={returnComment} onChange={e => setReturnComment(e.target.value)} />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => { setReturnOpen(false); setReturnComment(''); }} className="px-3 py-1 border rounded text-sm">Cancelar</button>
                            <button onClick={() => {
                              const analystId = currentTicket.rca?.analystId || currentTicket.assignedToId;
                              if (!analystId) {
                                alert('No se encontró el investigador asignado para este análisis.');
                                return;
                              }
                              onReturnToAnalyst(currentTicket.id, analystId, returnComment || 'Requiere ajustes por parte de Calidad');
                              setReturnOpen(false);
                              setReturnComment('');
                            }} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Enviar Devolución</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
         </div>
      </div>

      {/* RCA FORM */}
      {((isAssignee && currentTicket.status === 'Pendiente RCA') || isEditingRca) && (
         <div className="bg-white border-2 border-orange-100 rounded-lg p-6 animate-in slide-in-from-bottom-4">
            <h3 className="font-bold text-orange-800 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2"/> {isEditingRca ? 'Editando Análisis (RCA)' : 'Registro de Análisis (RCA)'}
            </h3>
            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Causa Raíz (5 Porqués)</label>
                  <textarea className="w-full border p-2 rounded" rows={2} 
                    value={rcaForm.rootCause} onChange={e => setRcaForm({...rcaForm, rootCause: e.target.value})}></textarea>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Acción Correctiva</label>
                     <textarea className="w-full border p-2 rounded" rows={2}
                       value={rcaForm.correctiveAction} onChange={e => setRcaForm({...rcaForm, correctiveAction: e.target.value})}></textarea>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Acción Preventiva</label>
                     <textarea className="w-full border p-2 rounded" rows={2}
                       value={rcaForm.preventiveAction} onChange={e => setRcaForm({...rcaForm, preventiveAction: e.target.value})}></textarea>
                  </div>
               </div>
               <div className="flex justify-end gap-2">
                  {isEditingRca && (
                    <button onClick={() => setIsEditingRca(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancelar</button>
                  )}
                  <button onClick={() => {
                      const newRcaData: RCA = {
                        ...rcaForm as RCA,
                        analystId: currentUser.id,
                        date: new Date().toISOString()
                      };
                      if (isEditingRca) {
                        onUpdateRCA(currentTicket.id, newRcaData);
                        setIsEditingRca(false);
                      } else {
                        onSubmitRCA(currentTicket.id, newRcaData);
                      }
                  }} className="bg-orange-600 text-white px-4 py-2 rounded font-medium hover:bg-orange-700">
                     {isEditingRca ? 'Actualizar Análisis' : 'Guardar Análisis'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* VISUALIZACIÓN RCA */}
      {currentTicket.rca && !isEditingRca && (
         <div className="bg-gray-50 p-4 rounded border border-gray-200 mt-4">
            <h3 className="font-bold text-gray-800 mb-2">Análisis Registrado</h3>
            <p className="text-sm"><strong>Causa:</strong> {currentTicket.rca?.rootCause || 'N/A'}</p>
            <p className="text-sm"><strong>Correctiva:</strong> {currentTicket.rca?.correctiveAction || 'N/A'}</p>
            <p className="text-sm"><strong>Preventiva:</strong> {currentTicket.rca?.preventiveAction || 'N/A'}</p>
         </div>
      )}

      {/* VERIFICACIÓN DE EFECTIVIDAD */}
      {(currentTicket.status === 'Cierre Temporal' || currentTicket.status === 'En Verificación de Acciones' || currentTicket.status === 'Cerrado Verificado') && currentTicket.effectiveness && (
         <div className="bg-lime-50 border-2 border-lime-200 rounded-lg p-6 mt-6">
            <h3 className="font-bold text-lime-900 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2"/> Verificación de Efectividad de Acciones
            </h3>

            {isQualityLead && currentTicket.effectiveness?.status === 'Pendiente' && (
              <div className="bg-white p-4 rounded border border-lime-300 mb-4">
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Programado para:</strong> {new Date(currentTicket.effectiveness?.scheduledDate || '').toLocaleDateString('es-CO')}
                </p>
                <button 
                      onClick={() => {
                    if (currentTicket.effectiveness) {
                      const updatedEffectiveness = {
                        ...currentTicket.effectiveness,
                        status: 'En Progreso' as const
                      };
                      onStatusChange(currentTicket.id, 'En Verificación de Acciones', 'Responsable de Calidad iniciando verificación de efectividad');
                    }
                  }}
                  className="bg-lime-600 text-white px-4 py-2 rounded hover:bg-lime-700 font-medium"
                >
                  Iniciar Verificación
                </button>
              </div>
            )}

            {isQualityLead && (currentTicket.effectiveness?.status === 'Pendiente' || currentTicket.effectiveness?.status === 'En Progreso') && (
              <div className="bg-white p-4 rounded border border-lime-300 mb-4">
                <h4 className="font-bold text-gray-800 mb-3">Acciones para Verificar</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-lime-100">
                        <th className="border border-lime-200 p-2 text-left font-bold">Acción RCA</th>
                        <th className="border border-lime-200 p-2 text-left font-bold">Estado</th>
                        <th className="border border-lime-200 p-2 text-left font-bold">% Cumpl.</th>
                        <th className="border border-lime-200 p-2 text-left font-bold">Evidencia</th>
                        <th className="border border-lime-200 p-2 text-left font-bold">Comentarios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verificationActions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="border border-lime-200 p-2 text-center text-gray-500">
                            <button 
                              onClick={() => {
                                const newAction: VerificationAction = {
                                  id: 'va' + Math.random().toString(36).substr(2, 9),
                                  description: currentTicket.rca?.correctiveAction || '',
                                  status: 'Cumplida',
                                  percentage: 100,
                                  evidence: [],
                                  comments: '',
                                  verifiedBy: currentUser.id
                                };
                                setVerificationActions([newAction]);
                              }}
                              className="text-lime-600 hover:text-lime-800 font-medium"
                            >
                              + Agregar Acción a Verificar
                            </button>
                          </td>
                        </tr>
                      ) : (
                        verificationActions.map((action, idx) => (
                          <tr key={action.id}>
                            <td className="border border-lime-200 p-2">
                              <input 
                                type="text"
                                value={action.description}
                                onChange={(e) => {
                                  const updated = [...verificationActions];
                                  updated[idx].description = e.target.value;
                                  setVerificationActions(updated);
                                }}
                                className="w-full border p-1 rounded text-xs"
                              />
                            </td>
                            <td className="border border-lime-200 p-2">
                              <select 
                                value={action.status}
                                onChange={(e) => {
                                  const updated = [...verificationActions];
                                  updated[idx].status = e.target.value as 'Cumplida' | 'Parcial' | 'Incumplida';
                                  setVerificationActions(updated);
                                }}
                                className="w-full border p-1 rounded text-xs"
                              >
                                <option value="Cumplida">Cumplida</option>
                                <option value="Parcial">Parcial</option>
                                <option value="Incumplida">Incumplida</option>
                              </select>
                            </td>
                            <td className="border border-lime-200 p-2">
                              <input 
                                type="number"
                                min="0"
                                max="100"
                                value={action.percentage}
                                onChange={(e) => {
                                  const updated = [...verificationActions];
                                  updated[idx].percentage = Number(e.target.value);
                                  setVerificationActions(updated);
                                }}
                                className="w-full border p-1 rounded text-xs"
                              />
                            </td>
                            <td className="border border-lime-200 p-2 text-xs text-gray-500">
                              {action.evidence.length > 0 ? `${action.evidence.length} archivos` : 'Agregar'}
                            </td>
                            <td className="border border-lime-200 p-2">
                              <input 
                                type="text"
                                value={action.comments}
                                onChange={(e) => {
                                  const updated = [...verificationActions];
                                  updated[idx].comments = e.target.value;
                                  setVerificationActions(updated);
                                }}
                                placeholder="Comentarios..."
                                className="w-full border p-1 rounded text-xs"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Comentarios Generales de la Verificación</label>
                  <textarea 
                    value={verificationComments}
                    onChange={(e) => setVerificationComments(e.target.value)}
                    rows={3}
                    className="w-full border p-2 rounded text-sm"
                    placeholder="Observaciones del responsable de Calidad..."
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => {
                      if (onVerificationSubmit && currentTicket.effectiveness) {
                        const updatedVerification: EffectivenessVerification = {
                          ...currentTicket.effectiveness,
                          actions: verificationActions,
                          overallComments: verificationComments,
                          completedDate: new Date().toISOString(),
                          verifiedBy: currentUser.id
                        };
                        onVerificationSubmit(currentTicket.id, updatedVerification);
                      }
                    }}
                    className="bg-lime-600 text-white px-6 py-2 rounded hover:bg-lime-700 font-medium"
                  >
                    Completar Verificación
                  </button>
                  <button 
                    onClick={() => {
                      setVerificationActions(currentTicket.effectiveness?.actions || []);
                      setVerificationComments(currentTicket.effectiveness?.overallComments || '');
                    }}
                    className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {currentTicket.effectiveness?.status === 'Completada' && (
              <div className="bg-white p-4 rounded border border-lime-300">
                <h4 className="font-bold text-gray-800 mb-3">Resultado de Verificación</h4>
                <div className="space-y-2 text-sm">
                  {(currentTicket.effectiveness?.actions || []).map(action => (
                    <div key={action.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{action.description}</p>
                        <p className="text-xs text-gray-600">{action.comments}</p>
                      </div>
                      <div className="flex gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          action.status === 'Cumplida' ? 'bg-green-100 text-green-800' :
                          action.status === 'Parcial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {action.status}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                          {action.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {currentTicket.effectiveness?.overallComments && (
                  <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs font-bold text-gray-600">Comentarios del Responsable de Calidad:</p>
                    <p className="text-sm text-gray-700 mt-1">{currentTicket.effectiveness?.overallComments}</p>
                  </div>
                )}
              </div>
            )}
         </div>
      )}

      <div className="mt-6">
         <h4 className="text-sm font-bold text-gray-700 mb-2">Historial del Caso</h4>
         <div className="bg-white border rounded p-3 space-y-2">
           {(!history || history.filter(h => h.ticketId === currentTicket.id).length === 0) && <div className="text-xs text-gray-500">No hay acciones registradas.</div>}
           {(history || []).filter(h => h.ticketId === currentTicket.id).map(h => (
             <div key={h.id} className="text-sm">
               <div className="text-xs text-gray-500">{h.timestamp} • <strong>{h.userName}</strong></div>
               <div>{h.action}</div>
             </div>
           ))}
         </div>
      </div>

      <div className="flex justify-end mt-6">
          <button onClick={onBack} className="text-emerald-700 font-medium hover:underline">Volver al Dashboard</button>
      </div>
    </div>
  );
};

const DefinitionsView = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Glosario de Términos</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="space-y-4">
        {DEFINITIONS.map(d => (
          <div key={d.term} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-bold text-emerald-800">{d.term}</h3>
            <p className="text-sm text-gray-600">{d.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- COMPONENTE CREATE TICKET FORM (RESTAURADO) ---
const CreateTicketForm = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel,
  onOpenDefinitions,
  currentUser,
  clients,
  products,
  users
}: {
  formData: any,
  setFormData: (data: any) => void,
  onSubmit: (e: React.FormEvent) => void,
  onCancel: () => void,
  onOpenDefinitions: () => void,
  currentUser: UserProfile,
  clients: any[],
  products: any[],
  users: UserProfile[]
}) => {
  const isReclamo = useMemo(() => {
    const type = PQR_TYPES.find(t => t.id === formData.pqrTypeId);
    return type?.category === 'Reclamo';
  }, [formData.pqrTypeId]);

  const canAssign = currentUser.role === 'Admin' || currentUser.role === 'Vendedor';

  return (
    <div className="w-full max-w-6xl mx-auto animate-in slide-in-from-bottom-2">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Radicar Nueva PQRSF</h2>
          <p className="text-xs sm:text-sm text-gray-500">Diligencie la información para iniciar el proceso de gestión.</p>
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 bg-white px-3 py-1 rounded border shadow-sm text-sm w-full sm:w-auto">
          Cancelar
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100 flex flex-col lg:flex-row max-h-[80vh]">
        <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
                <select 
                  required 
                  className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 text-sm"
                  value={formData.clientId}
                  onChange={e => setFormData({...formData, clientId: e.target.value})}
                >
                  <option value="">Seleccione...</option>
                    {CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fruta / Producto</label>
                <select 
                  required 
                  className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 text-sm"
                  value={formData.fruitId}
                  onChange={e => setFormData({...formData, fruitId: e.target.value})}
                >
                  <option value="">Seleccione Producto Importado...</option>
                  {products
                    .filter(f => !formData.clientId || !f.clientIds || f.clientIds.length === 0 || f.clientIds.includes(formData.clientId))
                    .map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orden de Compra</label>
                <input 
                  type="text" 
                  className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 p-2 text-sm"
                  placeholder="Ej. OC-9090"
                  value={formData.purchaseOrder || ''}
                  onChange={e => setFormData({...formData, purchaseOrder: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Factura</label>
                <input 
                  type="text" 
                  className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 p-2 text-sm"
                  placeholder="Ej. FE-1020"
                  value={formData.invoiceNumber || ''}
                  onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lote / Importación</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 p-2 text-sm"
                  placeholder="Ej. IMP-2023-885"
                  value={formData.lote}
                  onChange={e => setFormData({...formData, lote: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
               <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-emerald-700 uppercase">Clasificación PQRSF</label>
                  <button type="button" onClick={onOpenDefinitions} className="text-xs text-emerald-600 underline flex items-center">
                    <HelpCircle className="w-3 h-3 mr-1"/> Ver Definiciones
                  </button>
               </div>
               <select 
                  required 
                  className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 text-sm"
                  value={formData.pqrTypeId}
                  onChange={e => setFormData({...formData, pqrTypeId: e.target.value})}
                >
                  <option value="">Seleccione el tipo exacto...</option>
                  {PQR_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                
                {isReclamo && (
                  <div className="mt-4 animate-in slide-in-from-top-1">
                    <label className="block text-xs font-bold text-red-600 uppercase mb-1 flex items-center">
                      <ShoppingBag className="w-3 h-3 mr-1"/> Cantidad a Devolver (Unidades/Cajas)
                    </label>
                    <input 
                      type="number" 
                      required
                      className="w-full rounded-md border-red-300 border bg-red-50 p-2 text-sm focus:border-red-500 focus:ring-red-500"
                      placeholder="Ingrese cantidad..."
                      value={formData.returnQuantity || ''}
                      onChange={e => setFormData({...formData, returnQuantity: Number(e.target.value)})}
                    />
                  </div>
                )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link Evidencia (Drive)</label>
              <input 
                type="text" 
                className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 text-sm" 
                placeholder="https://drive.google.com/..."
                value={formData.evidenceLink}
                onChange={e => setFormData({...formData, evidenceLink: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción del Caso</label>
              <textarea 
                required 
                rows={4} 
                className="w-full rounded-md border-gray-300 border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 text-sm"
                placeholder="Describa los hechos..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <label className="block text-xs font-bold text-red-700 uppercase mb-1">🔴 Asignar Responsable (Obligatorio)</label>
              <select 
                className="w-full rounded-md border-red-300 border p-2 text-sm focus:border-red-500 focus:ring-red-500"
                value={formData.assignedToId || ''}
                onChange={e => setFormData({...formData, assignedToId: e.target.value})}
                required
              >
                <option value="">-- Selecciona un responsable --</option>
                {users.filter(u => u.role === 'Responsable' || u.department === 'Logística' || u.department === 'Bodega' || u.department === 'Producción' || u.department === 'Calidad').map(u => (
                  <option key={u.id} value={u.id}>{u.name} - {u.department}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                type="submit" 
                className="w-full md:w-auto px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg shadow-md hover:bg-emerald-700 transition-all"
              >
                Registrar Ticket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---

export default function QMSApp() {
  // Initialize users, clients, and products (will attempt to load from Supabase)
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Cargar usuarios desde Supabase al iniciar la aplicación (usar siempre datos del servidor)
  useEffect(() => {
    const loadUsersFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          console.warn('⚠️ Error al cargar usuarios desde Supabase:', error);
          // fallback a datos locales si es necesario
          setUsers(USERS);
          return;
        }

        if (data && data.length > 0) {
          const normalizedUsers = data.map((u: any) => ({
            id: u.id || u.user_id || '',
            name: u.name || '',
            email: u.email || '',
            phone: u.phone || '',
            role: u.role || 'Vendedor',
            department: u.department || '',
            whatsappPhone: u.whatsapp_phone || '',
            password: u.password || ''
          }));
          setUsers(normalizedUsers);
          console.log(`✅ ${normalizedUsers.length} usuarios cargados desde Supabase (App)`);
        } else {
          // Si no hay filas en la tabla, usar datos embebidos como fallback
          setUsers(USERS);
          console.log('ℹ️ No se encontraron usuarios en Supabase, usando datos locales');
        }
      } catch (err) {
        console.warn('Error cargando usuarios desde Supabase en App:', err);
        setUsers(USERS);
      }
    };

    loadUsersFromSupabase();

    // Recarga periódica para mantener datos sincronizados (cada 30 segundos)
    const interval = setInterval(() => {
      loadUsersFromSupabase();
    }, 30_000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar clients desde Supabase al iniciar la aplicación (mapear según esquema)
  useEffect(() => {
    const loadClientsFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, client_id, name, razon_social, sucursal, contacto, cargo, nit, direccion, telefono, email, created_at, updated_at')
          .order('id', { ascending: true });

        if (error) {
          console.warn('⚠️ Error al cargar clients desde Supabase:', error);
          return;
        }

        if (data && data.length > 0) {
          const normalized = data.map((c: any) => ({
            id: c.id,
            client_id: c.client_id || '',
            name: c.name || '',
            razonSocial: c.razon_social || '',
            sucursal: c.sucursal || '',
            contacto: c.contacto || '',
            cargo: c.cargo || '',
            nit: c.nit || '',
            direccion: c.direccion || '',
            telefono: c.telefono || '',
            email: c.email || ''
          }));
          setClients(normalized);
          console.log(`✅ ${normalized.length} clientes cargados desde Supabase`);
        } else {
          console.log('ℹ️ No se encontraron clients en Supabase, usando datos locales');
        }
      } catch (err) {
        console.warn('Error cargando clients desde Supabase:', err);
      }
    };

    loadClientsFromSupabase();
    const interval = setInterval(loadClientsFromSupabase, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [clients, setClients] = useState<Client[]>(CLIENTS);

  const [products, setProducts] = useState([
    { id: 'f1', name: 'Cereza Importada' },
    { id: 'f2', name: 'Ciruela Importada' },
    { id: 'f3', name: 'Kiwi Importado' },
    { id: 'f4', name: 'Limón Amarillo Importado' },
    { id: 'f5', name: 'Mandarina Importada' },
    { id: 'f6', name: 'Manzana Roja Importada' },
    { id: 'f7', name: 'Manzana Royal Gala Importada' },
    { id: 'f8', name: 'Manzana Pink Lady Importada' },
    { id: 'f9', name: 'Manzana Verde Importada' },
    { id: 'f10', name: 'Naranja Importada' },
    { id: 'f11', name: 'Pera Importada' },
    { id: 'f12', name: 'Pomelo Importado' },
    { id: 'f13', name: 'Uva Negra Sin Semilla Importada' },
    { id: 'f14', name: 'Uva Red Globe Importada' },
    { id: 'f15', name: 'Uva Verde Sin Semilla Importada' },
  ]);


  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'login' | 'dashboard' | 'create' | 'detail' | 'analytics' | 'history' | 'historico' | 'admin' | 'products' | 'clients'>('login');
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'email' | 'whatsapp'} | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState<Partial<Ticket>>({
    clientId: '', fruitId: '', pqrTypeId: '', lote: '', description: '', evidenceLink: ''
  });

  // Estado para configuración de PQR (prefijo y número consecutivo)
  const [pqrConfig, setPqrConfig] = useState({ prefix: 'PQR', next_number: 1 });

  // Keep-Alive para Supabase - Escribe cada 4 días para evitar que se pausa la BD
  useEffect(() => {
    const initializeKeepAlive = async () => {
      try {
        const lastWriteKey = 'supabase_last_keepalive_write';
        const lastWrite = localStorage.getItem(lastWriteKey);
        const now = Date.now();
        const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000; // 345,600,000 ms

        // Si no hay registro o pasaron más de 4 días, escribir en Supabase
        if (!lastWrite || (now - parseInt(lastWrite)) > FOUR_DAYS) {
          try {
            // Obtener el número consecutivo actual
            const { data, error: fetchError } = await supabase
              .from('keepalive_heartbeat')
              .select('sequence_number')
              .order('sequence_number', { ascending: false })
              .limit(1);

            if (fetchError) {
              // Tabla no existe aún - es normal, esperar a que ejecutes el SQL
              return;
            }

            const nextSequence = (data && data.length > 0) ? (data[0].sequence_number + 1) : 1;

            // Insertar nuevo registro
            const { error } = await supabase
              .from('keepalive_heartbeat')
              .insert([
                {
                  sequence_number: nextSequence,
                  last_write: new Date().toISOString(),
                  notes: 'Automatic keep-alive to prevent database pause'
                }
              ]);

            if (!error) {
              localStorage.setItem(lastWriteKey, now.toString());
              console.log(`✅ Keep-Alive Supabase: Registro #${nextSequence} insertado`);
            }
          } catch (innerErr) {
            // Silenciar errores de tabla inexistente
            if (innerErr?.message?.includes('keepalive_heartbeat')) {
              // La tabla no existe - es normal durante setup inicial
              return;
            }
            throw innerErr;
          }
        }
      } catch (err) {
        // Solo loguear errores reales (no tabla no existe)
        if (!err?.message?.includes('keepalive_heartbeat') && !err?.message?.includes('PGRST205')) {
          console.error('❌ Keep-Alive Supabase: Error', err);
        }
      }
    };

    initializeKeepAlive();
    
    // Verificar cada 24 horas si es necesario escribir
    const interval = setInterval(initializeKeepAlive, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar products desde Supabase al iniciar la aplicación (mapear según tu esquema)
  useEffect(() => {
    const loadProductsFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, product_id, name, description, price, sku, client_ids, created_at, updated_at')
          .order('id', { ascending: true });

        if (error) {
          console.warn('⚠️ Error al cargar productos desde Supabase:', error);
          return;
        }

        if (data && data.length > 0) {
          const normalized = data.map((p: any) => ({
            id: p.id,
            product_id: p.product_id || '',
            name: p.name || '',
            description: p.description || '',
            price: p.price ?? null,
            sku: p.sku || '',
            clientIds: (() => {
              try {
                if (!p.client_ids) return [];
                if (Array.isArray(p.client_ids)) return p.client_ids;
                return JSON.parse(p.client_ids);
              } catch (e) {
                try { return String(p.client_ids).split(',').map((s: string) => s.trim()).filter(Boolean); } catch { return []; }
              }
            })(),
            created_at: p.created_at,
            updated_at: p.updated_at
          }));
          setProducts(normalized);
          console.log(`✅ ${normalized.length} productos cargados desde Supabase`);
        } else {
          console.log('ℹ️ No se encontraron productos en Supabase, la lista de productos permanecerá vacía');
        }
      } catch (err) {
        console.warn('Error cargando productos desde Supabase:', err);
      }
    };

    loadProductsFromSupabase();
    const interval = setInterval(loadProductsFromSupabase, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar configuración de PQR desde Supabase
  useEffect(() => {
    const loadPqrConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('pqr_config')
          .select('prefix, next_number')
          .eq('id', 1)
          .single();

        if (!error && data) {
          setPqrConfig({ prefix: data.prefix, next_number: data.next_number });
          console.log(`✅ PQR Config cargada: ${data.prefix}-${data.next_number}`);
        }
      } catch (err) {
        console.warn('⚠️ PQR Config: Tabla no existe aún (es normal si es la primera vez)', err);
      }
    };

    loadPqrConfig();
  }, []);

  // Cargar tickets y RCAs desde Supabase
  useEffect(() => {
    const loadTicketsAndRCAFromSupabase = async () => {
      try {
        // Cargar tickets
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (ticketError) throw ticketError;
        if (!ticketData) return;

        // Cargar RCAs y Follow-ups en paralelo
        const { data: rcaData, error: rcaError } = await supabase
          .from('rca')
          .select('*');

        const { data: followUpData, error: followUpError } = await supabase
          .from('follow_ups')
          .select('*');

        const rcaMap = new Map();
        if (!rcaError && rcaData) {
          rcaData.forEach((rca: any) => {
            rcaMap.set(Number(rca.ticket_id), {
              rootCause: rca.root_cause || '',
              correctiveAction: rca.corrective_action || '',
              preventiveAction: rca.preventive_action || '',
              analystId: rca.analyst_id || '',
              date: rca.date || new Date().toISOString()
            });
          });
        }

        const followUpMap = new Map<number, FollowUp[]>();
        if (!followUpError && followUpData) {
          followUpData.forEach((fu: any) => {
            const ticketId = Number(fu.ticket_id);
            if (!followUpMap.has(ticketId)) {
              followUpMap.set(ticketId, []);
            }
            followUpMap.get(ticketId)!.push({
              id: fu.id || '',
              number: fu.number || 0,
              description: fu.description || '',
              status: fu.status || 'Pendiente',
              cumplimiento: fu.cumplimiento || null,
              observaciones: fu.observaciones || '',
              completedAt: fu.completed_at,
              completedBy: fu.completed_by
            });
          });
        }

        // Convertir datos de Supabase al formato de la app y relacionar RCAs + Follow-ups
        const formattedTickets: Ticket[] = ticketData.map((row: any) => ({
          id: row.id,
          code: row.code,
          clientId: row.client_id,
          fruitId: row.fruit_id,
          pqrTypeId: row.pqr_type_id,
          lote: row.lote || 'N/A',
          description: row.description || '',
          evidenceLink: row.evidence_link || '',
          purchaseOrder: row.purchase_order,
          invoiceNumber: row.invoice_number,
          returnQuantity: row.return_quantity,
          status: row.status as Status,
          creatorId: row.creator_id,
          assignedToId: row.assigned_to_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          closedAt: row.closed_at,
          slaDays: row.sla_days || 10,
          responsableSla: row.responsable_sla || 5,
          clienteSla: row.cliente_sla || 10,
          criticidad: row.criticidad || undefined,
          rca: rcaMap.get(row.id) || null,
          followUps: followUpMap.get(row.id) || [],
          resultadoEficacia: row.result_eficacia,
          cumplimientoCount: {
            cumplidos: row.cumplimiento_count_cumplidos || 0,
            noCumplidos: row.cumplimiento_count_no_cumplidos || 0
          }
        }));

        // ✓ Cargar directamente desde Supabase - permitir que la BD sea fuente de verdad
        // (La UI responde inmediatamente a cambios locales en handleStatusChange, 
        //  puis se sincroniza con Supabase en la siguiente recarga)
        setTickets(formattedTickets);
        
        // 🔍 DEBUG: mostrar tickets por estado
        const byStatus: {[key: string]: number} = {};
        formattedTickets.forEach(t => {
          byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        });
        console.log(`✅ ${formattedTickets.length} tickets cargados desde Supabase`);
        console.log(`   Por estado:`, byStatus);
        const pendienteCierre = formattedTickets.filter(t => t.status === 'Pendiente Cierre');
        if (pendienteCierre.length > 0) {
          console.log(`   🔴 ${pendienteCierre.length} tickets en "Pendiente Cierre":`, pendienteCierre.map(t => `#${t.id} (assignedTo: ${t.assignedToId})`));
        }
        
        console.log(`✅ ${rcaMap.size} RCAs y ${followUpMap.size} seguimientos cargados`);
      } catch (err) {
        console.warn('⚠️ Tickets/RCA/FollowUps: No se pudieron cargar desde Supabase', err);
      }
    };

    loadTicketsAndRCAFromSupabase();

    // Suscripción en tiempo real para mantener tickets sincronizados entre pestañas
    let ticketsChannel: any = null;
    try {
      ticketsChannel = supabase
        .channel('public:tickets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
          console.log('🔔 Cambio en tickets detectado:', payload);
          // Recargar lista completa para mantener consistencia de RCAs y follow-ups
          loadTicketsAndRCAFromSupabase();
        })
        .subscribe();
    } catch (err) {
      console.warn('No se pudo crear canal realtime para tickets:', err);
    }

    // Fallback: recarga periódica (cada 15s) por si realtime falla
    const interval = setInterval(() => {
      loadTicketsAndRCAFromSupabase();
    }, 15_000);

    return () => {
      clearInterval(interval);
      try {
        ticketsChannel?.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Cargar historial desde Supabase (si existe la tabla `history_logs`)
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('history_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (!error && data) {
          const formatted: HistoryLog[] = data.map((r: any) => ({
            id: String(r.id),
            ticketId: Number(r.ticket_id),
            userId: r.user_id || '',
            userName: r.user_name || r.user_name || 'Sistema',
            action: r.action || '',
            timestamp: new Date(r.timestamp).toLocaleString('es-CO')
          }));
          setHistory(formatted);
          console.log(`✅ Historial cargado (${formatted.length} registros)`);
        }
      } catch (err) {
        console.warn('⚠️ Historial: tabla `history_logs` no encontrada o error al cargar', err);
      }
    };

    loadHistory();
  }, []);

  const notifyUser = (userId: string | null, action: string) => {
    if (!userId) return;
    const user = users.find(u => u.id === userId);
    if (user) {
      setNotification({
        msg: `Enviando correo a ${user.email}${user.whatsappPhone ? ` y WhatsApp a ${user.whatsappPhone}` : ''}: "${action}"`,
        type: Math.random() > 0.5 ? 'email' : 'whatsapp'
      });
      // Enviar notificación por WhatsApp si está configurado
      if (user.whatsappPhone) {
        sendWhatsAppNotification(user.whatsappPhone, action);
      }
    }
  };

  // Función para enviar notificaciones por WhatsApp usando Twilio
  // IMPORTANTE: Requiere configurar variables de entorno:
  // VITE_TWILIO_ACCOUNT_SID, VITE_TWILIO_AUTH_TOKEN, VITE_TWILIO_WHATSAPP_NUMBER
  const sendWhatsAppNotification = async (toNumber: string, message: string) => {
    try {
      // En producción, esto sería un endpoint en el backend
      // Por ahora, solo simulamos la notificación en la UI
      console.log(`📱 WhatsApp enviado a ${toNumber}: ${message}`);
      // Endpoint futuro: await fetch('/api/send-whatsapp', { method: 'POST', body: JSON.stringify({ to: toNumber, message }) })
    } catch (error) {
      console.error('Error enviando WhatsApp:', error);
    }
  };

  // Función para generar y descargar PDF del PQR
  const generateTicketPDF = async (ticket: Ticket) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      let yPosition = margin;

      // ============ ENCABEZADO PROFESIONAL CON LOGO ============
      // Fondo decorativo en el encabezado
      doc.setFillColor(0, 100, 80);
      doc.rect(0, 0, pageWidth, 50, 'F');

      // Logo y Título en la misma fila
      const logoImg = new Image();
      logoImg.onload = function() {
        // Logo se cargará pero no bloqueará la ejecución
      };
      logoImg.src = 'https://lacaleracolombia.com.co/wp-content/uploads/2023/03/cropped-Logo-La-Calera-Estuardo-PNG.png';

      // Intentar cargar el logo (con fallback)
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function() {
            // Si se carga, agregarlo al PDF
            try {
              const imgData = canvas.toDataURL('image/png');
              doc.addImage(imgData, 'PNG', margin, margin + 2, 28, 28);
            } catch (e) {
              // Si falla, continuar sin logo
            }
          };
          img.src = 'https://lacaleracolombia.com.co/wp-content/uploads/2023/03/cropped-Logo-La-Calera-Estuardo-PNG.png';
        }
      } catch (e) {
        // Continuar sin logo si hay error
      }

      // Línea vertical decorativa
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(2);
      doc.line(margin + 32, margin + 2, margin + 32, margin + 28);

      // Título principal en blanco sobre fondo verde
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('LA CALERA', margin + 38, yPosition + 8);

      // Subtítulo
      doc.setFontSize(10);
      doc.setTextColor(200, 255, 200);
      doc.setFont(undefined, 'normal');
      doc.text('Sistema de Gestión de Calidad - PQRSF', margin + 38, yPosition + 15);

      // Información del documento en blanco
      doc.setFontSize(8);
      doc.setTextColor(220, 255, 220);
      doc.text(`REPORTE #${ticket.code}`, margin + 38, yPosition + 22);
      doc.text(`${new Date().toLocaleDateString('es-CO')}`, pageWidth - margin - 40, yPosition + 8);

      yPosition = 55;

      // ============ INFORMACIÓN BÁSICA EN TABLA ============
      const basicInfoData = [
        ['CÓDIGO', ticket.code, 'ESTADO', ticket.status],
        ['FECHA CREACIÓN', new Date(ticket.createdAt).toLocaleString('es-CO'), 'TIPO PQRSF', PQR_TYPES.find(p => p.id === ticket.pqrTypeId)?.name || 'N/A'],
        ['LOTE', ticket.lote, 'ORDEN COMPRA', ticket.purchaseOrder || 'N/A'],
        ['FACTURA', ticket.invoiceNumber || 'N/A', 'DEVOL. CANTIDAD', ticket.returnQuantity ? `${ticket.returnQuantity} unidades` : 'N/A'],
      ];

      doc.autoTable({
        body: basicInfoData,
        startY: yPosition,
        margin: margin,
        cellPadding: 3.5,
        columnStyles: {
          0: { fillColor: [0, 120, 100], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: (pageWidth - 2 * margin) / 4 },
          1: { fillColor: [242, 250, 248], textColor: [0, 0, 0], cellWidth: (pageWidth - 2 * margin) / 4 },
          2: { fillColor: [76, 175, 80], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: (pageWidth - 2 * margin) / 4 },
          3: { fillColor: [242, 250, 248], textColor: [0, 0, 0], cellWidth: (pageWidth - 2 * margin) / 4 }
        },
        theme: 'plain',
        fontSize: 9,
        lineColor: [200, 220, 215],
        lineWidth: 0.3,
        didDrawPage: function() {}
      });

      yPosition = doc.lastAutoTable.finalY + 6;

      // ============ INFORMACIÓN DEL CLIENTE EN TABLA ============
      const client = CLIENTS.find(c => c.id === ticket.clientId);
      if (client) {
        // Título con línea decorativa
        doc.setLineWidth(0.5);
        doc.setDrawColor(76, 175, 80);
        doc.line(margin, yPosition + 2.5, margin + 5, yPosition + 2.5);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 100, 80);
        doc.text('INFORMACIÓN DEL CLIENTE', margin + 8, yPosition + 3);
        yPosition += 7;

        const clientData = [
          [
            { content: 'Nombre Comercial:', styles: { fontStyle: 'bold', fillColor: [0, 120, 100], textColor: [255, 255, 255] } },
            { content: client.name || 'N/A', styles: { fillColor: [242, 250, 248] } }
          ],
          [
            { content: 'Razón Social:', styles: { fontStyle: 'bold', fillColor: [76, 175, 80], textColor: [255, 255, 255] } },
            { content: client.razonSocial || 'N/A', styles: { fillColor: [242, 250, 248] } }
          ],
          [
            { content: 'NIT:', styles: { fontStyle: 'bold', fillColor: [0, 120, 100], textColor: [255, 255, 255] } },
            { content: client.nit || 'N/A', styles: { fillColor: [242, 250, 248] } }
          ],
          [
            { content: 'Contacto:', styles: { fontStyle: 'bold', fillColor: [76, 175, 80], textColor: [255, 255, 255] } },
            { content: `${client.contacto || 'N/A'} (${client.cargo || 'N/A'})`, styles: { fillColor: [242, 250, 248] } }
          ],
          [
            { content: 'Teléfono / Email:', styles: { fontStyle: 'bold', fillColor: [0, 120, 100], textColor: [255, 255, 255] } },
            { content: `${client.telefono || 'N/A'} / ${client.email || 'N/A'}`, styles: { fillColor: [242, 250, 248] } }
          ],
          [
            { content: 'Dirección:', styles: { fontStyle: 'bold', fillColor: [76, 175, 80], textColor: [255, 255, 255] } },
            { content: client.direccion || 'N/A', styles: { fillColor: [242, 250, 248] } }
          ],
          [
            { content: 'Sucursal:', styles: { fontStyle: 'bold', fillColor: [0, 120, 100], textColor: [255, 255, 255] } },
            { content: client.sucursal || 'N/A', styles: { fillColor: [242, 250, 248] } }
          ]
        ];

        (doc as any).autoTable({
          body: clientData,
          startY: yPosition,
          margin: margin,
          cellPadding: 3,
          columnStyles: {
            0: { cellWidth: (pageWidth - 2 * margin) * 0.35 },
            1: { cellWidth: (pageWidth - 2 * margin) * 0.65 }
          },
          theme: 'plain',
          fontSize: 8,
          lineColor: [200, 220, 215],
          lineWidth: 0.3,
          didDrawPage: function() {}
        });

        yPosition = (doc as any).lastAutoTable.finalY + 6;
      }

      // Separador visual decorativo
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // ============ DESCRIPCIÓN DEL CASO ============
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = margin;
      }

      // Título con línea decorativa
      doc.setLineWidth(0.5);
      doc.setDrawColor(76, 175, 80);
      doc.line(margin, yPosition + 2.5, margin + 5, yPosition + 2.5);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 100, 80);
      doc.text('DESCRIPCIÓN DEL CASO', margin + 8, yPosition + 3);
      yPosition += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      
      // Recuadro para la descripción con colores corporativos
      doc.setFillColor(230, 245, 242);
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(0.5);
      
      const descriptionLines = doc.splitTextToSize(ticket.description, pageWidth - 2 * margin - 6);
      const descHeight = descriptionLines.length * 4 + 6;
      
      doc.rect(margin + 1.5, yPosition, pageWidth - 2 * margin - 3, descHeight, 'FD');
      
      doc.text(descriptionLines, margin + 4, yPosition + 3);
      yPosition += descHeight + 6;

      // Separador visual decorativo
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // ============ RCA (ANÁLISIS Y ACCIONES) ============
      if (ticket.rca) {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }

        // Título con línea decorativa
        doc.setLineWidth(0.5);
        doc.setDrawColor(76, 175, 80);
        doc.line(margin, yPosition + 2.5, margin + 5, yPosition + 2.5);
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 100, 80);
        doc.text('ANÁLISIS Y ACCIONES TOMADAS (RCA)', margin + 8, yPosition + 3);
        yPosition += 7;

        const rcaData = [
          [
            { content: 'Causa Raíz\nIdentificada', styles: { fontStyle: 'bold', fillColor: [0, 120, 100], textColor: [255, 255, 255], halign: 'center', valign: 'middle' } },
            { content: ticket.rca.rootCause || 'No especificada', styles: { fillColor: [242, 250, 248], halign: 'left', valign: 'top' } }
          ],
          [
            { content: 'Acción\nCorrectiva', styles: { fontStyle: 'bold', fillColor: [76, 175, 80], textColor: [255, 255, 255], halign: 'center', valign: 'middle' } },
            { content: ticket.rca.correctiveAction || 'No especificada', styles: { fillColor: [242, 250, 248], halign: 'left', valign: 'top' } }
          ],
          [
            { content: 'Acción\nPreventiva', styles: { fontStyle: 'bold', fillColor: [0, 120, 100], textColor: [255, 255, 255], halign: 'center', valign: 'middle' } },
            { content: ticket.rca.preventiveAction || 'No especificada', styles: { fillColor: [242, 250, 248], halign: 'left', valign: 'top' } }
          ]
        ];

        doc.autoTable({
          body: rcaData,
          startY: yPosition,
          margin: margin,
          cellPadding: 3,
          minCellHeight: 25,
          columnStyles: {
            0: { cellWidth: (pageWidth - 2 * margin) * 0.25 },
            1: { cellWidth: (pageWidth - 2 * margin) * 0.75 }
          },
          theme: 'plain',
          fontSize: 8,
          lineColor: [200, 220, 215],
          lineWidth: 0.3,
          didDrawPage: function() {}
        });

        yPosition = doc.lastAutoTable.finalY + 6;

        // Separador visual
        doc.setDrawColor(76, 175, 80);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }

      // ============ EVIDENCIAS Y ARCHIVOS ============
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = margin;
      }

      // Título con línea decorativa
      doc.setLineWidth(0.5);
      doc.setDrawColor(76, 175, 80);
      doc.line(margin, yPosition + 2.5, margin + 5, yPosition + 2.5);
      
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 100, 80);
      doc.text('EVIDENCIAS Y ARCHIVOS', margin + 8, yPosition + 3);
      yPosition += 7;

      doc.setFont(undefined, 'normal');

      if (ticket.evidenceLink) {
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('📎 Link de Evidencias (Google Drive):', margin, yPosition);
        yPosition += 4;
        
        doc.setTextColor(0, 102, 204);
        doc.setFont(undefined, 'underline');
        const linkLines = doc.splitTextToSize(ticket.evidenceLink, pageWidth - 2 * margin - 8);
        doc.text(linkLines, margin + 5, yPosition);
        doc.setFont(undefined, 'normal');
        yPosition += linkLines.length * 3 + 3;
      }

      yPosition += 3;
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // ============ HISTORIAL DE ACCIONES ============
      const ticketHistory = history.filter(h => h.ticketId === ticket.id);
      
      if (ticketHistory.length > 0) {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }

        // Título con línea decorativa
        doc.setLineWidth(0.5);
        doc.setDrawColor(76, 175, 80);
        doc.line(margin, yPosition + 2.5, margin + 5, yPosition + 2.5);
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 100, 80);
        doc.text('HISTORIAL DE ACCIONES', margin + 8, yPosition + 3);
        yPosition += 7;

        const historyData = ticketHistory.map(h => [
          new Date(h.timestamp).toLocaleDateString('es-CO') + ' ' + new Date(h.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          h.userName,
          h.action
        ]);

        doc.autoTable({
          head: [['Fecha y Hora', 'Usuario', 'Acción']],
          body: historyData,
          startY: yPosition,
          margin: margin,
          cellPadding: 2.5,
          columnStyles: {
            0: { fillColor: [0, 120, 100], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: (pageWidth - 2 * margin) * 0.25 },
            1: { fillColor: [76, 175, 80], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: (pageWidth - 2 * margin) * 0.2 },
            2: { fillColor: [0, 120, 100], textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: (pageWidth - 2 * margin) * 0.55 }
          },
          bodyStyles: {
            textColor: [0, 0, 0],
            fillColor: [242, 250, 248]
          },
          alternateRowStyles: {
            fillColor: [232, 245, 242]
          },
          theme: 'grid',
          fontSize: 8,
          lineColor: [200, 220, 215],
          lineWidth: 0.3,
          didDrawPage: function() {}
        });

        yPosition = doc.lastAutoTable.finalY + 3;
      }

      yPosition += 5;

      // ============ PIE DE PÁGINA CON NÚMEROS DE PÁGINA Y FIRMA ============
      // Separador final decorativo
      doc.setDrawColor(0, 100, 80);
      doc.setLineWidth(1);
      doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);

      // Cuadro de firma con colores corporativos
      doc.setFillColor(230, 245, 242);
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(0.5);
      doc.rect(margin, pageHeight - 32, pageWidth - 2 * margin, 18, 'FD');

      // Contenido de la firma
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.text('Autorizado por:', margin + 3, pageHeight - 27);
      
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 100, 80);
      doc.setFontSize(11);
      doc.text('Sandra Roa', margin + 3, pageHeight - 21);
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(76, 175, 80);
      doc.setFontSize(8);
      doc.text('Responsable de Calidad', margin + 3, pageHeight - 17);
      
      // Fecha y hora en el lado derecho
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const now = new Date();
      doc.text(`Generado: ${now.toLocaleDateString('es-CO')}`, pageWidth - margin - 50, pageHeight - 27);
      doc.text(`Hora: ${now.toLocaleTimeString('es-CO')}`, pageWidth - margin - 50, pageHeight - 21);

      // Números de página en el pie
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 6);
        
        // Línea separadora inferior
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 4, pageWidth - margin, pageHeight - 4);
      }

      // Descargar
      doc.save(`PQRSF-${ticket.code}.pdf`);
      setNotification({
        msg: `✅ PDF descargado: PQRSF-${ticket.code}.pdf`,
        type: 'email'
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      setNotification({
        msg: `❌ Error al generar PDF: ${error}`,
        type: 'email'
      });
    }
  };

  const addHistory = async (ticketId: number, action: string) => {
    if (!currentUser) return;
    const isoTs = new Date().toISOString();
    const displayTs = new Date().toLocaleString('es-CO');
    const newLog: HistoryLog = {
      id: Math.random().toString(36).substr(2, 9),
      ticketId,
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      timestamp: displayTs,
    };

    // Actualizar estado local inmediatamente
    setHistory(prev => [newLog, ...prev]);

    // Intentar persistir en Supabase (si la tabla existe)
    try {
      const payload = [{
        ticket_id: ticketId,
        user_name: currentUser.name,
        action,
        timestamp: isoTs,
        details: {}
      }];

      const { data, error } = await supabase.from('history_logs').insert(payload).select();
      if (error) {
        console.warn('Error insertando history_logs en Supabase:', error, 'payload:', payload);
        setNotification({ msg: '⚠️ No se pudo guardar historial en el servidor', type: 'email' });
      } else {
        // Opcional: reemplazar el id generado localmente por el id del servidor
        if (data && data[0] && data[0].id) {
          setHistory(prev => prev.map(h => h.ticketId === ticketId && h.action === action && h.timestamp === displayTs ? ({ ...h, id: String(data[0].id) }) : h));
        }
      }
    } catch (err) {
      console.warn('Excepción al insertar history_logs en Supabase:', err);
      setNotification({ msg: '⚠️ Error al guardar historial (ver consola)', type: 'email' });
    }
  };

  const handleLogin = (user: UserProfile, isAdminLogin: boolean = false) => {
    setCurrentUser(user);
    setIsAdmin(isAdminLogin && user.role === 'Admin');
    if (isAdminLogin && user.role === 'Admin') {
      setView('admin');
    } else {
      setView('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setView('login');
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Intentando crear ticket...', { createForm, currentUser: currentUser?.name });
    
    if (!createForm.clientId || !createForm.fruitId || !createForm.pqrTypeId || !createForm.assignedToId || !currentUser) {
      const missing = [];
      if (!createForm.clientId) missing.push('Cliente');
      if (!createForm.fruitId) missing.push('Producto');
      if (!createForm.pqrTypeId) missing.push('Tipo PQR');
      if (!createForm.assignedToId) missing.push('Responsable');
      if (!currentUser) missing.push('Usuario no autenticado');
      
      const msg = `❌ Faltan campos: ${missing.join(', ')}`;
      console.warn(msg);
      alert(msg);
      return;
    }

    const type = PQR_TYPES.find(t => t.id === createForm.pqrTypeId);
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    
    // Usar la configuración del PQR (prefijo y número consecutivo)
    const ticketSequence = String(pqrConfig.next_number).padStart(4, '0');
    
    const initialStatus: Status = 'Asignado';

    const newTicket: Ticket = {
      id: tickets.length + 1,
      code: `${pqrConfig.prefix}-${dateStr}-${ticketSequence}`,
      clientId: createForm.clientId!,
      fruitId: createForm.fruitId!,
      pqrTypeId: createForm.pqrTypeId!,
      lote: createForm.lote || 'N/A',
      description: createForm.description || '',
      evidenceLink: createForm.evidenceLink || '',
      purchaseOrder: createForm.purchaseOrder,
      invoiceNumber: createForm.invoiceNumber,
      returnQuantity: createForm.returnQuantity,
      status: initialStatus,
      creatorId: currentUser.id,
      assignedToId: createForm.assignedToId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedAt: null,
      slaDays: type?.sla || type?.responsableSla || 10,
      responsableSla: type?.responsableSla || 5,
      clienteSla: type?.clienteSla || 10,
    };

    setTickets([newTicket, ...tickets]);
    
    // Insertar ticket en Supabase y usar el id retornado por el servidor
    const localTempId = newTicket.id;
    const insertTicketToSupabase = async () => {
      try {
        console.log('🔄 Insertando ticket en Supabase con payload:', {
          code: newTicket.code,
          creator_id: newTicket.creatorId,
          assigned_to_id: newTicket.assignedToId,
          client_id: newTicket.clientId,
          fruit_id: newTicket.fruitId,
          pqr_type_id: newTicket.pqrTypeId,
          status: newTicket.status,
        });

        const { data: insertedData, error: insertError } = await supabase
          .from('tickets')
          .insert([{
            code: newTicket.code,
            creator_id: newTicket.creatorId,
            assigned_to_id: newTicket.assignedToId,
            client_id: newTicket.clientId,
            fruit_id: newTicket.fruitId,
            pqr_type_id: newTicket.pqrTypeId,
            status: newTicket.status,
            criticidad: 'Normal',
            description: newTicket.description,
            lote: newTicket.lote,
            purchase_order: newTicket.purchaseOrder,
            invoice_number: newTicket.invoiceNumber,
            return_quantity: newTicket.returnQuantity,
            evidence_link: newTicket.evidenceLink,
            sla_days: newTicket.slaDays,
            responsable_sla: newTicket.responsableSla,
            cliente_sla: newTicket.clienteSla,
            created_at: newTicket.createdAt,
            updated_at: newTicket.updatedAt,
            closed_at: null,
            result_eficacia: null,
            cumplimiento_count_cumplidos: 0,
            cumplimiento_count_no_cumplidos: 0,
          }])
          .select()
          .single();
        
        if (insertError) {
          console.error(`❌ Error Supabase al guardar ticket:`, {
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint
          });
          setNotification({ 
            msg: `❌ Error al guardar en Supabase: ${insertError.message}`, 
            type: 'email' 
          });
          return null;
        } else if (insertedData) {
          console.log(`✅ Ticket ${newTicket.code} guardado en Supabase con ID:`, insertedData.id);
          setNotification({ 
            msg: `✅ Ticket ${newTicket.code} creado exitosamente`, 
            type: 'email' 
          });
          return insertedData;
        }
      } catch (err) {
        console.error('❌ Excepción al insertar ticket:', err);
        setNotification({ 
          msg: `❌ Error interno al crear ticket (ver consola)`, 
          type: 'email' 
        });
        return null;
      }
      return null;
    };

    // Actualizar el número consecutivo en Supabase (no bloqueante)
    const updateNextNumber = async () => {
      try {
        const { error } = await supabase
          .from('pqr_config')
          .update({ next_number: pqrConfig.next_number + 1, last_updated: new Date().toISOString() })
          .eq('id', 1);
        
        if (!error) {
          setPqrConfig({ ...pqrConfig, next_number: pqrConfig.next_number + 1 });
          console.log(`✅ Número consecutivo incrementado a: ${pqrConfig.next_number + 1}`);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo actualizar número consecutivo (tabla no existe aún)', err);
      }
    };

    // Ejecutar inserción y esperar resultado para usar el id real en el historial
    (async () => {
      const serverRow = await insertTicketToSupabase();
      updateNextNumber();

      const finalId = serverRow && serverRow.id ? Number(serverRow.id) : localTempId;

      // Si el servidor devolvió un id, actualizar el id local del ticket temporal
      if (serverRow && serverRow.id) {
        setTickets(prev => prev.map(t => t.id === localTempId ? { ...t, id: Number(serverRow.id) } : t));
      }

      addHistory(finalId, `Radicación de PQRSF ${initialStatus === 'Asignado' ? 'con asignación inmediata' : ''}`);
    })();
    notifyUser(currentUser.id, `Ticket ${newTicket.code} creado exitosamente.`);
    
    if (newTicket.assignedToId) {
      notifyUser(newTicket.assignedToId, `Se te ha asignado el caso ${newTicket.code}`);
    } else {
      notifyUser('u1', `Nuevo Ticket ${newTicket.code} requiere atención.`);
    }
    
    setCreateForm({ clientId: '', fruitId: '', pqrTypeId: '', lote: '', description: '', evidenceLink: '' });
    setView('dashboard');
  };

  const handleAssign = (ticketId: number, assigneeId: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Asignado', assignedToId: assigneeId, updatedAt: new Date().toISOString() } : t));
    addHistory(ticketId, 'Ticket Asignado');
    notifyUser(assigneeId, 'Se te ha asignado un nuevo ticket.');
  };

  const handleStatusChange = (ticketId: number, newStatus: Status, comment: string) => {
    // Determinar el nuevo assignedToId (reasignar a Calidad si va a Pendiente Cierre)
    let newAssignedToId: string | null = null;
    // ✓ CORRECCIÓN: Asignar a Calidad para CUALQUIERA que marque "Pendiente Cierre"
    if (newStatus === 'Pendiente Cierre') {
      newAssignedToId = 'u1'; // SIEMPRE reasignar a Calidad (u1) SIN IMPORTAR EL ROL
    }

    // Actualizar estado local inmediatamente (UI responde al toque)
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const updated = { ...t, status: newStatus, updatedAt: new Date().toISOString() };
      if (newAssignedToId) {
        updated.assignedToId = newAssignedToId;
      }
      return updated;
    }));

    // Persistir cambio en Supabase con ESPERA para asegurar que se persista
    const persistStatusChange = async () => {
      try {
        const updatePayload: any = { 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        };
        if (newAssignedToId) {
          updatePayload.assigned_to_id = newAssignedToId;
        }

        console.log(`📤 [${new Date().toLocaleTimeString()}] Persistiendo en Supabase:`, {
          ticketId,
          newStatus,
          newAssignedToId,
          payload: updatePayload
        });

        const { data, error } = await supabase
          .from('tickets')
          .update(updatePayload)
          .eq('id', ticketId)
          .select();

        if (error) {
          console.error(`❌ [${new Date().toLocaleTimeString()}] ERROR Supabase:`, error);
          console.error(`   Detalles: ${error.message}`);
          setNotification({ msg: `❌ Error al actualizar: ${error.message}`, type: 'email' });
        } else {
          console.log(`✅ [${new Date().toLocaleTimeString()}] PERSISTIDO exitosamente en Supabase`);
          console.log(`   Datos retornados:`, data);
          // Forzar recarga inmediata después de persistir
          console.log(`⏱️ Recargando datos de Supabase en 500ms...`);
          setTimeout(() => {
            console.log(`🔄 Ejecutando recarga forzada...`);
            // La recarga automática se ejecutará en la próxima vuelta
          }, 500);
        }
      } catch (err) {
        console.error(`❌ Excepción al persistir:`, err);
        setNotification({ msg: '⚠️ Error al guardar', type: 'email' });
      }
    };
    
    // Ejecutar persistencia async (no bloquea UI)
    persistStatusChange();

    addHistory(ticketId, comment);

    // Notify Calidad if moved to Pendiente Cierre
    if (newStatus === 'Pendiente Cierre') {
      notifyUser('u1', `El caso #${ticketId} está listo para cierre. Requiere acción de Calidad.`);
    }
  };

  const handleTemporaryClosure = (ticketId: number, criticidad?: Criticidad) => {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 30);

    const followUpCount = getFollowUpCount(criticidad);
    const followUps: FollowUp[] = Array.from({ length: followUpCount }).map((_, idx) => ({
      id: 'fu' + Math.random().toString(36).substr(2, 9),
      number: idx + 1,
      description: `Seguimiento ${idx + 1}`,
      status: 'Pendiente',
      cumplimiento: null,
      observaciones: ''
    }));

    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      return {
        ...t,
        status: 'Cierre Temporal',
        assignedToId: 'u1',
        criticidad: criticidad,
        followUps,
        updatedAt: new Date().toISOString()
      };
    }));

    // Persistir cambios en Supabase (no bloquea la UI)
    (async () => {
      try {
        // 1. Actualizar ticket
        const { error: ticketError } = await supabase
          .from('tickets')
          .update({ 
            status: 'Cierre Temporal', 
            assigned_to_id: 'u1',
            criticidad: criticidad || null,
            updated_at: new Date().toISOString() 
          })
          .eq('id', ticketId)
          .select();

        if (ticketError) {
          console.warn(`⚠️ Error al actualizar cierre temporal:`, ticketError);
          setNotification({ msg: '⚠️ Error al actualizar cierre temporal en servidor', type: 'email' });
          return;
        }

        console.log(`✅ Cierre temporal persistido en Supabase para ticket ${ticketId}`);

        // 2. Insertar seguimientos (follow_ups)
        const followUpPayload = followUps.map(fu => ({
          id: fu.id,
          ticket_id: ticketId,
          number: fu.number,
          description: fu.description,
          status: fu.status,
          cumplimiento: fu.cumplimiento,
          observaciones: fu.observaciones
        }));

        const { error: followUpError, data: insertedFU } = await supabase
          .from('follow_ups')
          .insert(followUpPayload)
          .select();

        if (followUpError) {
          console.warn(`⚠️ Error al insertar seguimientos:`, followUpError);
          setNotification({ msg: '⚠️ Error al guardar seguimientos en servidor', type: 'email' });
        } else {
          console.log(`✅ ${followUpPayload.length} seguimientos insertados en Supabase para ticket ${ticketId}`);
        }
      } catch (err) {
        console.warn('Error persistiendo temporary closure:', err);
        setNotification({ msg: '⚠️ Error al procesar cierre temporal (ver consola)', type: 'email' });
      }
    })();

    addHistory(ticketId, `Cierre Temporal iniciado por ${currentUser?.name}. Criticidad: ${criticidad || 'N/A'}. Se programaron ${followUpCount} seguimientos.`);
    notifyUser('u1', `Ticket #${ticketId} requiere seguimientos (${followUpCount}). Criticidad: ${criticidad || 'N/A'}`);
  };

  const handleMarkFollowUp = (ticketId: number, followUpId: string, cumplimiento: 'Cumplió' | 'No Cumplió', observaciones?: string) => {
    // Permisos: solo Responsable (Calidad) o Admin pueden marcar seguimientos
    const isQualityUser = currentUser?.role === 'Responsable' && currentUser?.department === 'Calidad';
    if (!isQualityUser && currentUser?.role !== 'Admin') {
      setNotification({ msg: 'No tienes permisos para guardar seguimientos', type: 'email' });
      return;
    }

    const completedAt = new Date().toISOString();
    const completedBy = currentUser?.id || '';

    // Actualizar estado local inmediatamente
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const followUps = (t.followUps || []).map(f => f.id === followUpId ? ({
        ...f,
        status: 'Completado' as const,
        cumplimiento,
        observaciones: observaciones || f.observaciones || '',
        completedAt,
        completedBy
      }) : f);

      return { ...t, followUps, updatedAt: new Date().toISOString() };
    }));

    // Persistir en Supabase (no bloquea la UI)
    (async () => {
      try {
        const { error } = await supabase
          .from('follow_ups')
          .update({
            status: 'Completado',
            cumplimiento,
            observaciones: observaciones || '',
            completed_at: completedAt,
            completed_by: completedBy
          })
          .eq('id', followUpId)
          .select();

        if (error) {
          console.warn(`⚠️ Error al actualizar seguimiento en Supabase:`, error);
          setNotification({ msg: '⚠️ Error al guardar seguimiento en servidor', type: 'email' });
        } else {
          console.log(`✅ Seguimiento ${followUpId} persistido en Supabase`);
        }
      } catch (err) {
        console.warn('Error persistiendo follow-up:', err);
      }
    })();

    addHistory(ticketId, `Seguimiento guardado como ${cumplimiento}: ${observaciones || 'Sin observaciones adicionales'}`);
  };

  const handleEvaluateFollowUps = (ticketId: number) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error('Ticket no encontrado:', ticketId);
      return;
    }

    // Validación 1: Solo el responsable de Calidad (departamento Calidad) puede cerrar
    if (!(currentUser?.role === 'Responsable' && currentUser?.department === 'Calidad')) {
      setNotification({ msg: 'Solo el responsable de Calidad puede cerrar casos', type: 'email' });
      return;
    }

    // Validación 2: Todos los followUps deben estar completados
    const followUps = ticket.followUps || [];
    if (followUps.length === 0 || !followUps.every(f => f.status === 'Completado')) {
      setNotification({ msg: 'Completa TODOS los seguimientos antes de cerrar', type: 'email' });
      return;
    }

    // Validación 3: Evitar doble cierre
    if (ticket.resultadoEficacia) {
      setNotification({ msg: 'Este caso ya fue evaluado anteriormente', type: 'email' });
      return;
    }

    const cumplidos = followUps.filter(f => f.cumplimiento === 'Cumplió').length;
    const noCumplidos = followUps.filter(f => f.cumplimiento === 'No Cumplió').length;
    const resultado: ResultadoEficacia = noCumplidos > 0 ? 'NO EFICAZ' : 'EFICAZ';

    const closedAt = new Date().toISOString();

    // Persistir en Supabase primero
    (async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .update({
            result_eficacia: resultado,
            status: 'Cerrado Verificado',
            closed_at: closedAt,
            cumplimiento_count_cumplidos: cumplidos,
            cumplimiento_count_no_cumplidos: noCumplidos
          })
          .eq('id', ticketId)
          .select();

        if (error) {
          console.warn('⚠️ Error actualizando ticket en Supabase:', error);
          setNotification({ msg: '⚠️ Error al cerrar caso en servidor', type: 'email' });
          return;
        }

        // Actualizar estado local con los datos devueltos por el servidor (si vienen)
        setTickets(prev => prev.map(t => t.id === ticketId ? ({ ...t, resultadoEficacia: resultado, cumplimientoCount: { cumplidos, noCumplidos }, status: 'Cerrado Verificado', closedAt, updatedAt: new Date().toISOString() }) : t));

        addHistory(ticketId, `✅ CIERRE FINAL: ${cumplidos} cumplidos, ${noCumplidos} no cumplidos. EFICACIA: ${resultado}`);
        if (ticket.rca?.analystId) notifyUser(ticket.rca.analystId, `Caso #${ticketId} CERRADO. Eficacia: ${resultado}`);
        setNotification({ msg: `✅ Caso cerrado. Eficacia: ${resultado}`, type: 'email' });

        // Llevar al dashboard principal del usuario
        setSelectedTicketId(null);
        setView('dashboard');
      } catch (err) {
        console.warn('Error al persistir cierre en Supabase:', err);
        setNotification({ msg: '⚠️ Error al cerrar caso (ver consola)', type: 'email' });
      }
    })();
  };

  const handleVerificationSubmit = (ticketId: number, verification: EffectivenessVerification) => {
    const allCompliant = verification.actions.every(a => a.status === 'Cumplida' && a.percentage === 100);
    const newStatus = allCompliant ? 'Cerrado Verificado' : 'En Verificación de Acciones';
    
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      
      return {
        ...t,
        status: newStatus,
        effectiveness: {
          ...verification,
          completedDate: new Date().toISOString(),
          status: 'Completada'
        },
        updatedAt: new Date().toISOString()
      };
    }));

    // Persistir cambios en Supabase (no bloquea la UI)
    (async () => {
      try {
        const { error } = await supabase
          .from('tickets')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', ticketId)
          .select();

        if (error) {
          console.warn(`⚠️ Error al actualizar status de verificación:`, error);
        } else {
          console.log(`✅ Status actualizado a ${newStatus} en Supabase`);
        }
      } catch (err) {
        console.warn('Error persistiendo verification status:', err);
      }
    })();

    const ticket = tickets.find(t => t.id === ticketId);
    const statusMsg = allCompliant
      ? 'Todas las acciones cumplidas. Caso CERRADO VERIFICADO.'
      : 'Se requiere seguimiento adicional de acciones incumplidas.';
    
    addHistory(ticketId, `Verificación de Efectividad completada: ${statusMsg}`);
    
    if (ticket?.rca?.analystId) {
      notifyUser(ticket.rca.analystId, `Verificación completada para caso #${ticketId}: ${statusMsg}`);
    }
  };

  const handleSubmitRCA = (ticketId: number, rca: RCA) => {
    // Actualizar estado local inmediatamente
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'En Resolucion', rca, updatedAt: new Date().toISOString() } : t));
    
    // Guardar RCA en Supabase
    const saveRCAToSupabase = async () => {
      try {
        // Primero obtener el ticket para conseguir su code
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) {
          console.error('❌ Ticket no encontrado');
          return;
        }

        // Buscar si ya existe un RCA para este ticket
        const { data: existingRCA, error: selectError } = await supabase
          .from('rca')
          .select('id')
          .eq('ticket_id', ticket.id)
          .maybeSingle();

        let success = false;
        if (existingRCA) {
          // Actualizar RCA existente
          const { error: updateError } = await supabase
            .from('rca')
            .update({
              root_cause: rca.rootCause,
              corrective_action: rca.correctiveAction,
              preventive_action: rca.preventiveAction,
              analyst_id: currentUser?.id,
              updated_at: new Date().toISOString()
            })
            .eq('ticket_id', ticket.id);

          if (!updateError) {
            console.log(`✅ RCA actualizado para ticket ${ticket.code}`);
            success = true;
          } else {
            console.error(`❌ Error al actualizar RCA:`, updateError);
          }
        } else {
          // Insertar nuevo RCA
          const { error: insertError } = await supabase
            .from('rca')
            .insert([{
              ticket_id: ticket.id,
              root_cause: rca.rootCause,
              corrective_action: rca.correctiveAction,
              preventive_action: rca.preventiveAction,
              analyst_id: currentUser?.id,
              date: new Date().toISOString()
            }]);

          if (!insertError) {
            console.log(`✅ RCA guardado en Supabase para ticket ${ticket.code}`);
            success = true;
          } else {
            console.error(`❌ Error al guardar RCA:`, insertError);
          }
        }

        // Si la persitencia fue exitosa, asegurar que el ticket tenga el RCA sincronizado
        if (success) {
          setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, rca: rca } : t));
          
          // También actualizar el status del ticket a "En Resolucion" en Supabase
          try {
            const { error: statusError } = await supabase
              .from('tickets')
              .update({ status: 'En Resolucion', updated_at: new Date().toISOString() })
              .eq('id', ticketId);

            if (!statusError) {
              console.log(`✅ Status actualizado a En Resolucion para ticket ${ticketId}`);
            } else {
              console.warn(`⚠️ Error al actualizar status del ticket:`, statusError);
            }
          } catch (err) {
            console.warn('Error actualizando status del ticket:', err);
          }
        }
      } catch (err) {
        console.error('❌ Error en saveRCAToSupabase:', err);
      }
    };

    saveRCAToSupabase();
    addHistory(ticketId, 'RCA Guardado');
  };

  const handleUpdateRCA = (ticketId: number, rca: RCA) => {
    // Actualizar estado local inmediatamente
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, rca, updatedAt: new Date().toISOString() } : t));
    
    // Actualizar RCA en Supabase
    const updateRCAInSupabase = async () => {
      try {
        const { error } = await supabase
          .from('rca')
          .update({
            root_cause: rca.rootCause,
            corrective_action: rca.correctiveAction,
            preventive_action: rca.preventiveAction,
            analyst_id: currentUser?.id,
            updated_at: new Date().toISOString()
          })
          .eq('ticket_id', ticketId)
          .select();

        if (!error) {
          console.log(`✅ RCA actualizado en Supabase para ticket ${ticketId}`);
          // Re-sincronizar el ticket local con el RCA actualizado
          setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, rca: rca } : t));
        } else {
          console.error(`❌ Error al actualizar RCA:`, error);
          setNotification({ msg: '⚠️ Error al actualizar RCA en servidor', type: 'email' });
        }
      } catch (err) {
        console.error('❌ Error en updateRCAInSupabase:', err);
        setNotification({ msg: '⚠️ Error al actualizar RCA (ver consola)', type: 'email' });
      }
    };

    updateRCAInSupabase();
    addHistory(ticketId, 'RCA Actualizado (Edición)');
  };

  const handleClose = (ticketId: number) => {
    const closedAt = new Date().toISOString();
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Si no tiene ciclo de efectividad (sin seguimientos), marcar como EFICAZ automáticamente
    const hasEffectivenessCycle = ticket.effectiveness || (ticket.followUps && ticket.followUps.length > 0);
    const resultadoEficacia: ResultadoEficacia = hasEffectivenessCycle ? (ticket.resultadoEficacia || 'NO EFICAZ') : 'EFICAZ';

    // Actualizar estado local inmediatamente para reflejo en UI
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Cerrado', closedAt, updatedAt: closedAt, resultadoEficacia } : t));

    // Persistir en Supabase
    (async () => {
      try {
        const updatePayload: any = {
          status: 'Cerrado',
          closed_at: closedAt,
          updated_at: closedAt,
          result_eficacia: resultadoEficacia  // Siempre persiste la eficacia
        };

        const { error } = await supabase
          .from('tickets')
          .update(updatePayload)
          .eq('id', ticketId)
          .select();

        if (error) {
          console.warn('⚠️ Error al cerrar ticket en Supabase:', error);
          setNotification({ msg: '⚠️ Error al cerrar caso en servidor', type: 'email' });
          return;
        }

        console.log(`✅ Ticket ${ticketId} cerrado como ${resultadoEficacia} en Supabase`);

        addHistory(ticketId, `Caso Cerrado por ${currentUser?.name || 'Sistema'}${!hasEffectivenessCycle ? ' - Marcado como EFICAZ (sin ciclo de efectividad requerido)' : ''}`);
        notifyUser(currentUser?.id || null, `Has cerrado el caso #${ticketId}`);
        setNotification({ msg: `✅ Caso cerrado como ${resultadoEficacia}`, type: 'email' });
        setView('dashboard');
      } catch (err) {
        console.warn('Error al persistir cierre en Supabase:', err);
        setNotification({ msg: '⚠️ Error al cerrar caso (ver consola)', type: 'email' });
      }
    })();
  };

  const handleReturnToAnalyst = (ticketId: number, analystId: string, comment: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Determine target analyst with fallbacks
    let targetAnalyst: string | null = analystId || ticket.rca?.analystId || ticket.assignedToId || ticket.creatorId || null;
    if (!targetAnalyst) {
      const firstResp = users.find(u => u.role === 'Responsable');
      targetAnalyst = firstResp?.id || null;
    }
    if (!targetAnalyst) {
      alert('No se encontró un responsable válido para devolver el caso.');
      return;
    }

    // Actualizar estado local
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Asignado', assignedToId: targetAnalyst as string, updatedAt: new Date().toISOString() } : t));

    // Persistir la asignación en Supabase (no bloquear la UI si falla)
    (async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .update({ assigned_to_id: targetAnalyst, status: 'Asignado', updated_at: new Date().toISOString() })
          .eq('id', ticketId)
          .select();

        if (error) {
          console.warn('No se pudo persistir la devolución en Supabase:', error);
          setNotification({ msg: '⚠️ Error al persistir devolución en servidor', type: 'email' });
        } else {
          console.log(`✅ Devolución persistida en Supabase: ticket ${ticket.code} -> ${targetAnalyst}`);
        }
      } catch (err) {
        console.warn('Error al persistir devolución en Supabase:', err);
        setNotification({ msg: '⚠️ Error al persistir devolución (ver consola)', type: 'email' });
      }
    })();

    addHistory(ticketId, `Devolución a investigador: ${comment}`);
    notifyUser(targetAnalyst, `El caso ${ticket.code} ha sido devuelto por ${currentUser?.name}: ${comment}`);
  };

  const visibleTickets = useMemo(() => {
    if (!currentUser) {
      console.log('⚠️ currentUser es null, retornando array vacío');
      return [];
    }
    
    // ✅ SOLUCIÓN: Sandra Roa (ID=2, Responsable) debería ver tickets asignados a "u1" (Calidad)
    // Porque ella ES la calidad, solo que con rol Responsable en la BD
    if (currentUser.id === '2' || currentUser.id === 'u1') {
      // Sandra Roa - ver TODOS los tickets para cierre
      console.log(`✅ Usuario ${currentUser.name} es CALIDAD, mostrando todos los ${tickets.length} tickets`);
      return tickets;
    }
    
    if (currentUser.role === 'Admin') {
      console.log(`✅ Usuario ${currentUser.name} es Admin, mostrando todos los ${tickets.length} tickets`);
      return tickets;
    }
    
    if (currentUser.role === 'Responsable') {
      // Responsables ven: 
      // 1) Tickets asignados a ellos
      // 2) Tickets donde participaron (RCA, seguimientos, efectividad)
      const filtered =tickets.filter(t =>
        t.assignedToId === currentUser.id || // Asignado al responsable
        (t.rca && t.rca.analystId === currentUser.id) || // Hizo el RCA
        (t.effectiveness && t.effectiveness.inspectorId === currentUser.id) || // Hizo verificación de efectividad
        (t.followUps && t.followUps.some(f => f.completedBy === currentUser.id)) // Completó seguimientos
      );
      console.log(`👤 Usuario ${currentUser.name} es Responsable, mostrando ${filtered.length}/${tickets.length} tickets`);
      return filtered;
    }
    
    if (currentUser.role === 'Vendedor') {
      const filtered = tickets.filter(t => t.creatorId === currentUser.id);
      console.log(`📦 Usuario ${currentUser.name} es Vendedor, mostrando ${filtered.length}/${tickets.length} tickets`);
      return filtered;
    }
    
    if (currentUser.role === 'Gerente') {
      console.log(`🏢 Usuario ${currentUser.name} es Gerente, mostrando todos los ${tickets.length} tickets`);
      return tickets;
    }
    
    console.log(`❓ Usuario ${currentUser.name} tiene rol desconocido: ${currentUser.role}`);
    return [];
  }, [tickets, currentUser?.id, currentUser?.role]);

  if (view === 'login' || !currentUser) {
    return <LoginScreen onLogin={handleLogin} users={users} />;
  }

  // Admin View
  if (view === 'admin' && isAdmin) {
    return <AdminPanel 
      users={users} 
      setUsers={setUsers} 
      clients={clients} 
      setClients={setClients} 
      products={products} 
      setProducts={setProducts}
      tickets={tickets}
      onBack={() => {
        setView('dashboard');
        setIsAdmin(false);
      }} 
    />;
  }

  const currentTicket = tickets.find(t => t.id === selectedTicketId);
  const canSeeHistory = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Vendedor');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800 flex flex-col">
      <nav className="bg-emerald-900 text-white shadow-xl sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => { setView('dashboard'); setShowDefinitions(false); setShowMobileMenu(false); }}>
              <div className="w-9 h-9 bg-white text-emerald-900 rounded-lg flex items-center justify-center font-bold shadow-sm text-xs">LC</div>
              <span className="font-bold text-lg sm:text-xl tracking-tight truncate">La Calera <span className="text-emerald-300 font-light hidden sm:inline">QMS</span></span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs text-emerald-300 font-bold uppercase">Usuario Actual</span>
                <span className="text-sm font-medium">{currentUser.name}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="bg-emerald-800 p-2 rounded-lg border border-emerald-700 hover:bg-emerald-700 transition-colors"
                title="Cerrar Sesión / Cambiar Usuario"
              >
                <LogOut className="w-4 h-4 text-emerald-100"/>
              </button>
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden bg-emerald-800 p-2 rounded-lg border border-emerald-700 hover:bg-emerald-700 transition-colors"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden bg-emerald-800 border-t border-emerald-700 py-3 px-4 space-y-2">
              <button 
                onClick={() => { setView('dashboard'); setShowMobileMenu(false); }} 
                className={`w-full text-left px-3 py-2 rounded transition-colors flex items-center ${view === 'dashboard' ? 'font-bold text-emerald-300 bg-emerald-700' : 'text-emerald-100 hover:bg-emerald-700'}`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2"/> Operativo
              </button>
              <button 
                onClick={() => { setView('analytics'); setShowMobileMenu(false); }} 
                className={`w-full text-left px-3 py-2 rounded transition-colors flex items-center ${view === 'analytics' ? 'font-bold text-emerald-300 bg-emerald-700' : 'text-emerald-100 hover:bg-emerald-700'}`}
              >
                <BarChart3 className="w-4 h-4 mr-2"/> Estadísticas
              </button>
              {canSeeHistory && (
                <button 
                  onClick={() => { setView('history'); setShowMobileMenu(false); }} 
                  className={`w-full text-left px-3 py-2 rounded transition-colors flex items-center ${view === 'history' ? 'font-bold text-emerald-300 bg-emerald-700' : 'text-emerald-100 hover:bg-emerald-700'}`}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2"/> Historial
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => { setView('admin'); setShowMobileMenu(false); }} 
                  className={`w-full text-left px-3 py-2 rounded transition-colors flex items-center ${view === 'admin' ? 'font-bold text-emerald-300 bg-emerald-700' : 'text-emerald-100 hover:bg-emerald-700'}`}
                >
                  <Settings className="w-4 h-4 mr-2"/> Admin
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        
        {notification && (
          <NotificationToast 
            message={notification.msg} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}

        {!showDefinitions && (
          <div className="flex flex-wrap items-center gap-2 mb-6 text-xs sm:text-sm overflow-x-auto pb-2">
            <button 
              onClick={() => setView('dashboard')} 
              className={`px-3 py-1 rounded whitespace-nowrap hover:bg-gray-200 transition-colors flex items-center ${view === 'dashboard' ? 'font-bold text-emerald-800 bg-emerald-50' : 'text-gray-500'}`}
            >
              <LayoutDashboard className="w-4 h-4 mr-1"/> Operativo
            </button>
            <button 
              onClick={() => setView('analytics')} 
              className={`px-3 py-1 rounded whitespace-nowrap hover:bg-gray-200 transition-colors flex items-center ${view === 'analytics' ? 'font-bold text-emerald-800 bg-emerald-50' : 'text-gray-500'}`}
            >
              <BarChart3 className="w-4 h-4 mr-1"/> Estadísticas
            </button>
            {canSeeHistory && (
              <button 
                onClick={() => setView('history')} 
                className={`px-3 py-1 rounded whitespace-nowrap hover:bg-gray-200 transition-colors flex items-center ${view === 'history' ? 'font-bold text-emerald-800 bg-emerald-50' : 'text-gray-500'}`}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1"/> Historial Global
              </button>
            )}
            
            {view === 'create' && <><span className="text-gray-400">/</span> <span className="font-medium text-emerald-800">Radicar</span></>}
            {view === 'detail' && <><span className="text-gray-400">/</span> <span className="font-medium text-emerald-800">Detalle Caso</span></>}
          </div>
        )}

        <main className="relative">
          {showDefinitions ? (
            <DefinitionsView onClose={() => setShowDefinitions(false)} />
          ) : (
            <>
              {view === 'analytics' && (
                <AnalyticsDashboard 
                  tickets={tickets}
                  title={currentUser.role === 'Responsable' ? 'Mis Estadísticas' : 'Estadísticas Generales'} 
                />
              )}
              {view === 'historico' && currentUser && (
                <DashboardHistory tickets={tickets} users={users} currentUser={currentUser} />
              )}
              
              {view === 'history' && canSeeHistory && (
                <HistoryModule 
                  tickets={tickets} 
                  users={users} 
                  onViewDetail={(id) => { setSelectedTicketId(id); setView('detail'); }} 
                />
              )}
              
              {view === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">
                      {currentUser.role === 'Responsable' ? 'Mis Casos Asignados' : 'Gestión de Casos Activos'}
                    </h1>
                    <div className="flex gap-3">
                       <button onClick={() => setShowDefinitions(true)} className="px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium flex items-center">
                         <BookOpen className="w-4 h-4 mr-2"/> Glosario
                       </button>

                       <button onClick={() => setView('historico')} className={`px-4 py-2 bg-white border rounded-lg text-sm font-medium flex items-center ${view === 'historico' ? 'font-bold text-emerald-800 bg-emerald-50' : 'text-gray-500'}`}>
                         <FileText className="w-4 h-4 mr-2"/> Histórico
                       </button>

                       {(currentUser.role === 'Admin' || currentUser.role === 'Vendedor' || (currentUser.role === 'Responsable' && currentUser.id === 'u1')) && (
                          <button onClick={() => setView('create')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 text-sm font-medium flex items-center">
                            <PlusCircle className="w-4 h-4 mr-2"/> Crear Ticket
                          </button>
                       )}
                    </div>
                  </div>
                  
                  {(() => {
                    const abiertos = visibleTickets.filter(t => ['Nuevo', 'Asignado'].includes(t.status));
                    const enSeguimiento = visibleTickets.filter(t => ['En Investigacion', 'Pendiente RCA', 'En Resolucion', 'Pendiente Cierre', 'En Seguimiento', 'Cierre Temporal', 'En Verificación de Acciones'].includes(t.status));
                    const cerrados = visibleTickets.filter(t => isTicketClosed(t.status));

                    // 🔍 DEBUG
                    console.log(`📊 DASHBOARD DEBUG - Usuario: ${currentUser?.name} (${currentUser?.id}, ${currentUser?.role})`);
                    console.log(`   Total tickets cargados: ${tickets.length}`);
                    console.log(`   Visible tickets: ${visibleTickets.length}`);
                    console.log(`   - Abiertos (Nuevo, Asignado): ${abiertos.length}`);
                    console.log(`   - En Seguimiento (Inv, RCA, Resol, Pend.Cierre, Seg): ${enSeguimiento.length}`);
                    if (enSeguimiento.length > 0) {
                      console.log(`     Estados: ${enSeguimiento.map(t => `#${t.id}:${t.status}`).join(', ')}`);
                    }
                    console.log(`   - Cerrados: ${cerrados.length}`);
                    const pendientesCierre = visibleTickets.filter(t => t.status === 'Pendiente Cierre');
                    console.log(`   🔴 Pendiente Cierre específicamente: ${pendientesCierre.length}`);
                    if (pendientesCierre.length > 0) {
                      console.log(`      Tickets: ${pendientesCierre.map(t => `#${t.id} (assignedTo: ${t.assignedToId})`).join(', ')}`);
                    }

                    const renderTable = (tickets: Ticket[], title: string, colorClass: string) => (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className={`px-6 py-4 ${colorClass}`}>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {title === 'Abiertos' && <AlertTriangle className="w-5 h-5"/>}
                            {title === 'En Seguimiento' && <History className="w-5 h-5"/>}
                            {title === 'Cerrados' && <CheckCircle className="w-5 h-5"/>}
                            {title} ({tickets.length})
                          </h3>
                        </div>
                        {tickets.length === 0 ? (
                          <div className="px-6 py-12 text-center text-gray-500">
                            No hay tickets en esta sección
                          </div>
                        ) : (
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Radicado / Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vendedor</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Responsable</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Urgencia</th>
                                <th className="px-6 py-3 text-right"></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {tickets.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-gray-900">{t.code}</div>
                                    <div className="text-xs text-gray-500 flex items-center mt-1">
                                      <Calendar className="w-3 h-3 mr-1"/> {new Date(t.createdAt).toLocaleDateString()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="text-sm text-gray-900">{CLIENTS.find(c=>c.id===t.clientId)?.name}</div>
                                    <div className="text-xs text-gray-500">{PQR_TYPES.find(p=>p.id===t.pqrTypeId)?.name}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="text-sm font-medium">{users.find(u => u.id === t.creatorId)?.name || 'N/A'}</div>
                                    <div className="text-xs text-gray-400">{users.find(u => u.id === t.creatorId)?.email || ''} {users.find(u => u.id === t.creatorId)?.phone ? `• ${users.find(u => u.id === t.creatorId)?.phone}` : ''}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {users.find(u => u.id === t.assignedToId) ? (
                                      <div>
                                        <div className="text-sm font-medium">{users.find(u => u.id === t.assignedToId)?.name}</div>
                                        <div className="text-xs text-gray-400">{users.find(u => u.id === t.assignedToId)?.email || ''} {users.find(u => u.id === t.assignedToId)?.phone ? `• ${users.find(u => u.id === t.assignedToId)?.phone}` : ''}</div>
                                      </div>
                                    ) : <span className="text-gray-400 italic">Sin Asignar</span>}
                                  </td>
                                  <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                                  <td className="px-6 py-4">
                                    <DualSLATimer createdAt={t.createdAt} responsableSla={t.responsableSla || 5} clienteSla={t.clienteSla || 10} status={t.status} />
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button onClick={()=>{setSelectedTicketId(t.id); setView('detail');}} className="text-emerald-600 hover:text-emerald-900 text-sm font-medium flex items-center ml-auto">
                                      Ver <ChevronRight className="w-4 h-4"/>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );

                    return (
                      <div className="space-y-6">
                        {renderTable(abiertos, 'Abiertos', 'bg-red-600 text-white')}
                        {renderTable(enSeguimiento, 'En Seguimiento', 'bg-blue-600 text-white')}
                        {renderTable(cerrados, 'Cerrados', 'bg-green-600 text-white')}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {view === 'create' && currentUser && (
                <CreateTicketForm 
                  formData={createForm} 
                  setFormData={setCreateForm} 
                  onSubmit={handleCreateTicket} 
                  onCancel={() => setView('dashboard')}
                  onOpenDefinitions={() => setShowDefinitions(true)}
                  currentUser={currentUser}
                    clients={clients}
                    products={products}
                    users={users}
                />
              )}

              {view === 'detail' && currentTicket && (
                <TicketDetailView 
                  currentTicket={currentTicket}
                  currentUser={currentUser}
                    users={users}
                  onAssign={handleAssign}
                  onStatusChange={handleStatusChange}
                  onSubmitRCA={handleSubmitRCA}
                  onUpdateRCA={handleUpdateRCA}
                  onClose={handleClose}
                    onReturnToAnalyst={handleReturnToAnalyst}
                    onBack={() => setView('dashboard')}
                    history={history}
                    onGeneratePDF={generateTicketPDF}
                    onTemporaryClosure={handleTemporaryClosure}
                    onVerificationSubmit={handleVerificationSubmit}
                    onMarkFollowUp={handleMarkFollowUp}
                    onEvaluateFollowUps={handleEvaluateFollowUps}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}