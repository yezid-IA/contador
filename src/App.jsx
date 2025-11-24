/**
 * ARCHIVO: ContadorPro.jsx
 * PROYECTO: Contador Pro
 * ARQUITECTO: Code Architect Pro
 * DESCRIPCIÓN: Aplicación principal React para gestión contable multi-usuario y avanzada.
 *
 * * NOTA IMPORTANTE DE INTEGRACIÓN:
 * 1. Este código utiliza la función 'useMockData' para simular Supabase en local.
 * 2. Busca el comentario "// TODO: INTEGRACIÓN SUPABASE REAL" para reemplazar las simulaciones
 * de lectura/escritura con llamadas a tu cliente de Supabase.
 * 3. Las funciones como 'updateTareas' simulan la inserción/actualización en el backend.
 * 4. La lógica de 'Cerrar Mes' es una simulación de inmutabilidad en la base de datos.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient'; // ¡NUEVO: Importamos el cliente de Supabase!

// =============================================================================
// 2. CONTEXTO Y UTILS (FUERA DE COMPONENTES)
// =============================================================================

/**
 * Función que simula la proyección de gastos recurrentes en el futuro.
 */
const projectRecurrences = (gastos, startDate, endDate) => {
    const projected = [];
    
    gastos.forEach(gasto => {
        // Ignorar gastos única si no están en el rango de filtrado principal
        if (gasto.recurrencia === 'Única' && (new Date(gasto.fecha) < startDate || new Date(gasto.fecha) > endDate)) {
            projected.push(gasto); // Se incluye el original por si acaso
            return;
        }
        
        // El punto de inicio es la fecha original del gasto
        let currentProjectionDate = new Date(gasto.fecha);
        
        while (currentProjectionDate <= endDate) {
            
            // Solo proyectamos si la fecha de proyección está en o antes del final del rango
            // y si es recurrente o si es un gasto único que cae en el rango.
            if (currentProjectionDate >= startDate || (gasto.recurrencia === 'Única' && isSameDay(currentProjectionDate, new Date(gasto.fecha)))) {
                
                 projected.push({
                    ...gasto,
                    original_id: gasto.id, // ID original para referencia
                    id: `p-${gasto.id}-${currentProjectionDate.getTime()}`, // ID único para la proyección
                    fecha: new Date(currentProjectionDate),
                    concepto: `${gasto.concepto} (${gasto.recurrencia === 'Mensual' ? 'Mensual' : 'Anual'})`,
                    isProjected: true // ADDED: Mark as projected
                });
            }
            
            // Avanzar al siguiente periodo
            if (gasto.recurrencia === 'Mensual') {
                currentProjectionDate.setMonth(currentProjectionDate.getMonth() + 1);
            } else if (gasto.recurrencia === 'Anual') {
                currentProjectionDate.setFullYear(currentProjectionDate.getFullYear() + 1);
            } else {
                break; // Gasto Único ya se manejó arriba
            }

            // Evitar bucles infinitos por si las moscas
            if (currentProjectionDate.getFullYear() > endDate.getFullYear() + 1) break;
        }
    });

    return projected;
};

const getStateBadge = (estado) => {
    const baseClass = "text-xs font-semibold px-2 py-0.5 rounded-full";
    let colorClass;
    switch (estado) {
        case 'Pendiente': colorClass = 'bg-yellow-500 text-yellow-900'; break;
        case 'En Proceso': colorClass = 'bg-blue-500 text-blue-100'; break;
        case 'Completada': colorClass = 'bg-green-500 text-green-100'; break;
        case 'Archivada': colorClass = 'bg-gray-500 text-gray-100'; break;
        default: colorClass = 'bg-gray-400 text-gray-800';
    }
    return <span className={`${baseClass} ${colorClass}`}>{estado}</span>;
};

const getEmpresaColor = (empresaId, empresas) => {
    const empresa = empresas.find(e => e.id === empresaId);
    return empresa?.color_hex || '#64748b';
}

const getResponsableName = (responsableId, auxiliaryUsers) => {
    const aux = auxiliaryUsers?.find(u => u.id === responsableId);
    return aux ? aux.nombre_completo : 'N/A';
}

/**
 * FIX DE FECHAS: Función para comparar si dos fechas caen en el mismo día.
 * Se asegura de interpretar las cadenas 'YYYY-MM-DD' en la zona horaria local
 * para evitar el desfase de medianoche (el error reportado).
 */
const isSameDay = (d1, d2) => {
    // Helper para robustamente crear un Date object desde una cadena 'YYYY-MM-DD'
    const getSafeDate = (input) => {
        if (input instanceof Date) return input;
        if (typeof input === 'string') {
             // FIX: Usar YYYY/MM/DD para forzar la interpretación local (no UTC).
             // Esto se aplica solo a las cadenas de fecha sin hora.
            return new Date(input.replace(/-/g, '/'));
        }
        return new Date(input);
    };

    const date1 = getSafeDate(d1);
    const date2 = getSafeDate(d2);
    
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(amount);
};

const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
        months.push(new Date(2000, i, 1).toLocaleDateString('es-CO', { month: 'long' }));
    }
    return months;
};

/**
 * Función de utilidad para obtener la hora en formato HH:MM (24h)
 */
const formatHour = (hour) => {
    if (!hour) return null;
    return hour.split(':').slice(0, 2).join(':'); // Asegura HH:MM
}

/**
 * Función para verificar si hay conflicto de horario
 * @param {string} newDate - Fecha YYYY-MM-DD
 * @param {string} newTime - Hora HH:MM
 * @param {array} allTareas - Lista completa de tareas
 * @returns {object|null} La tarea con la que hay conflicto, o null.
 */
const checkConflict = (newDate, newTime, allTareas) => {
    if (!newTime || !newDate) return null;

    const newDateTime = new Date(`${newDate.replace(/-/g, '/')} ${newTime}`);

    const conflict = allTareas.find(tarea => {
        // Solo verificamos conflictos con citas/reuniones que tengan hora y no estén completadas
        if (tarea.tipo !== 'Reunión' || !tarea.hora_vencimiento || tarea.estado === 'Completada') {
            return false;
        }

        // 1. Verificamos si es el mismo día
        const isSame = isSameDay(newDate, tarea.fecha_vencimiento);
        if (!isSame) return false;

        // 2. Verificamos si la hora coincide exactamente (simulación simple)
        const existingTime = formatHour(tarea.hora_vencimiento);
        
        // Simulación: Si tienen la misma hora, hay conflicto.
        if (existingTime === newTime) {
            return true;
        }

        return false;
    });

    return conflict || null;
}


// =============================================================================
// 3. COMPONENTES GLOBALES (HEADER, SIDEBAR, PORTAL, MODAL)
// =============================================================================

const Header = ({ currentRole, onLogout, adminId, allEmpresas, auxiliaryUsers, onToggleSidebar }) => {
    // ... [Lógica de Header y notificaciones sin cambios]
    const notifs = []; // TODO: Reemplazar con datos reales de Supabase
    const tareas = []; // TODO: Reemplazar con datos reales de Supabase
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const tareasUrgentes = useMemo(() => {
        const hoy = new Date();
        const futureDate = new Date();
        futureDate.setDate(hoy.getDate() + 3);
        
        return tareas
            .filter(t => t.estado === 'Pendiente' && new Date(t.fecha_vencimiento) <= futureDate)
            .map(t => {
                const empresa = allEmpresas.find(e => e.id === t.empresa_id)?.nombre_legal || 'Cliente Desconocido';
                return { 
                    id: t.id, 
                    mensaje: `¡URGENTE! Tarea de ${empresa} (${t.titulo}) vence pronto.`,
                    fecha: new Date(t.fecha_vencimiento)
                };
            });
    }, [tareas, allEmpresas]);
    
    const allNotifications = [...notifs, ...tareasUrgentes]
        .sort((a, b) => (new Date(b.fecha || b.fecha_creacion)) - (new Date(a.fecha || a.fecha_creacion)))
        .slice(0, 10);

    const currentUserName = getResponsableName(adminId, auxiliaryUsers) || 'Usuario';

    return (
        <header className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 shadow-md">
            <div className="flex items-center">
                <button onClick={onToggleSidebar} className="text-teal-400 p-2 rounded-lg hover:bg-slate-700 md:hidden mr-2">
                    <ion-icon name="menu-outline" className="text-2xl"></ion-icon>
                </button>
                <h1 className="text-xl font-semibold text-teal-400">Contador Pro</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
                <span className="text-sm text-gray-400 hidden sm:block">
                    Usuario: <span className="font-medium text-gray-200">{currentUserName}</span>
                </span>

                {currentRole !== 'client' && (
                    <div className="relative">
                        <button 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="text-gray-400 hover:text-white p-2 rounded-full relative"
                        >
                            <ion-icon name="notifications-outline" className="text-2xl"></ion-icon>
                            {allNotifications.length > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-800"></span>}
                        </button>
                        
                        {isDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-80 bg-slate-700 rounded-lg shadow-xl border border-slate-600 z-50 animate-fade-in-down">
                                <div className="p-3 font-semibold text-white border-b border-slate-600">Notificaciones</div>
                                <ul className="max-h-64 overflow-y-auto">
                                    {allNotifications.length === 0 ? (
                                        <li className="p-3 text-sm text-gray-400">No hay notificaciones</li>
                                    ) : (
                                        allNotifications.map(n => (
                                            <li key={n.id} className="p-3 text-sm text-gray-200 border-b border-slate-600 hover:bg-slate-600 cursor-pointer">
                                                <p>{n.mensaje}</p>
                                                <span className="text-xs text-gray-400">{new Date(n.fecha || n.fecha_creacion).toLocaleString('es-CO')}</span>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <button onClick={onLogout} className="flex items-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg shadow transition duration-200 text-sm sm:text-base">
                    <ion-icon name="log-out-outline" className="mr-2"></ion-icon>
                    <span className="hidden sm:inline">Salir</span>
                </button>
            </div>
        </header>
    );
};

const Sidebar = ({ currentPage, onNavigate, currentRole, isOpen, onClose }) => {
    
    const getLinkClass = (pageName) => {
        const baseClass = "flex items-center px-4 py-3 text-gray-300 hover:bg-slate-700 hover:text-teal-400 rounded-lg transition duration-200";
        const activeClass = "bg-slate-700 text-teal-400 font-bold shadow-inner";
        return `${baseClass} ${currentPage === pageName ? activeClass : ''}`;
    };

    const adminNav = [
        { page: 'dashboard', icon: 'grid-outline', label: 'Dashboard' },
        { page: 'clientes', icon: 'briefcase-outline', label: 'Clientes' },
        { page: 'daily-board', icon: 'checkbox-outline', label: 'Tablero Diario' },
        { page: 'calendario', icon: 'calendar-outline', label: 'Calendario' },
        { page: 'leads', icon: 'people-circle-outline', label: 'Leads' },
        { page: 'finanzas', icon: 'wallet-outline', label: 'Finanzas' },
        { page: 'users', icon: 'people-outline', label: 'Usuarios' }, // NUEVO MÓDULO
    ];
    
    const navItems = currentRole === 'admin' ? adminNav : adminNav.filter(item => item.page === 'dashboard' || item.page === 'clientes');

    const sidebarClasses = `
        w-64 h-full bg-slate-800 p-4 shadow-lg flex-shrink-0 flex-col
        transition-transform duration-300 ease-in-out
        md:flex md:relative md:translate-x-0
        ${isOpen ? 'fixed top-0 left-0 z-50 translate-x-0' : 'absolute -translate-x-full'}
    `;

    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose}></div>}
            <nav id="sidebar" className={sidebarClasses}>
                <div className="flex items-center mb-6">
                    <ion-icon name="calculator" className="text-3xl text-teal-400 mr-3"></ion-icon>
                    <span className="text-2xl font-bold text-white">Contador Pro</span>
                </div>
                
                <ul className="space-y-3">
                    {navItems.map(item => (
                        <li key={item.page}>
                            <button onClick={() => { onNavigate(item.page); onClose(); }} className={getLinkClass(item.page) + ' w-full text-left'}>
                                <ion-icon name={item.icon} className="mr-3 text-xl"></ion-icon>
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </>
    );
};

const LoginPortal = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });
            if (error) throw error;
            // onLogin will be handled by the session listener in App component
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen animate-fade-in">
            <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-center mb-6">
                    <ion-icon name="calculator" className="text-5xl text-teal-400 mr-3"></ion-icon>
                    <span className="text-3xl font-bold text-white">Contador Pro</span>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <h2 className="text-xl font-semibold text-white mb-3 text-center">Acceso al Sistema</h2>
                    
                    {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-lg text-center">{error}</p>}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Correo Electrónico</label>
                        <input 
                            type="email" 
                            placeholder="tu@email.com" 
                            className="input-form bg-slate-700 p-3" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Contraseña</label>
                        <input 
                            type="password" 
                            placeholder="Tu contraseña" 
                            className="input-form bg-slate-700 p-3" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <button type="submit" className="btn-accion bg-blue-600 hover:bg-blue-700 w-full" disabled={loading}>
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Iniciando...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center">
                                <ion-icon name="log-in-outline" className="mr-2"></ion-icon>
                                <span>Iniciar Sesión</span>
                            </div>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

const NewClientModal = ({ isOpen, onClose, updateEmpresas, isEditing, currentEmpresa = null }) => {
    
    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const newClient = {
            id: currentEmpresa?.id || null,
            nombre_legal: formData.get('nombre_legal'),
            nit: formData.get('nit'),
            actividad_economica: formData.get('actividad_economica'),
            telefono_contacto: formData.get('telefono_contacto'),
            email_contacto: formData.get('email_contacto'),
            color_hex: formData.get('color_hex'),
            client_password: formData.get('client_password'), // NUEVO: Contraseña de cliente
            fecha_creacion: currentEmpresa?.fecha_creacion || new Date().toISOString(),
        };

        // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por addDoc o updateDoc
        updateEmpresas(newClient);
        onClose();
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center p-4 py-10 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg animate-fade-in mb-auto overflow-y-auto max-h-full">
                <h3 className="text-2xl font-bold text-white mb-4">{isEditing ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h3>
                <div className="space-y-4">
                    <input name="nombre_legal" type="text" placeholder="Nombre Legal" className="input-form bg-slate-700 p-3" required defaultValue={currentEmpresa?.nombre_legal || ''} />
                    <input name="nit" type="text" placeholder="NIT (sin puntos ni guiones)" className="input-form bg-slate-700 p-3" required defaultValue={currentEmpresa?.nit || ''} />
                    <input name="actividad_economica" type="text" placeholder="Actividad Económica (CIIU)" className="input-form bg-slate-700 p-3" defaultValue={currentEmpresa?.actividad_economica || ''} />
                    <input name="telefono_contacto" type="text" placeholder="Teléfono" className="input-form bg-slate-700 p-3" defaultValue={currentEmpresa?.telefono_contacto || ''} />
                    <input name="email_contacto" type="email" placeholder="Email" className="input-form bg-slate-700 p-3" defaultValue={currentEmpresa?.email_contacto || ''} />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Color de la Empresa</label>
                        <input name="color_hex" type="color" className="input-form p-1 h-10 w-full" defaultValue={currentEmpresa?.color_hex || '#64748b'} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Contraseña de Acceso al Portal</label>
                        <input name="client_password" type="text" placeholder="Contraseña de cliente" className="input-form bg-slate-700 p-3" required defaultValue={currentEmpresa?.client_password || ''} />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cancelar</button>
                    <button type="submit" className="btn-accion bg-blue-600 hover:bg-blue-700 px-4 py-2">{isEditing ? 'Guardar Cambios' : 'Crear Cliente'}</button>
                </div>
            </form>
        </div>
    );
};

// NUEVO: Modal de Alerta de Conflicto de Agenda
const ConflictAlertModal = ({ isOpen, onClose, conflictTask, empresas, onOpenTaskModal }) => {
    if (!conflictTask) return null;

    const empresa = empresas.find(e => e.id === conflictTask.empresa_id);

    return (
        <div className={`fixed inset-0 bg-red-900/70 justify-center items-center p-4 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-sm animate-pop-in border-4 border-red-500">
                <h3 className="text-2xl font-bold text-red-400 mb-3 flex items-center">
                    <ion-icon name="warning-outline" className="mr-2 text-3xl"></ion-icon>
                    ¡Conflicto de Agenda!
                </h3>
                <p className="text-gray-300 mb-4">No se puede agendar esta cita. Ya existe un compromiso a las **{formatHour(conflictTask.hora_vencimiento)}** el **{new Date(conflictTask.fecha_vencimiento).toLocaleDateString('es-CO')}**.</p>
                
                <div className="p-3 bg-slate-700 rounded-lg border border-red-400 mb-4">
                    <p className="font-bold text-white">{conflictTask.titulo}</p>
                    <p className="text-sm text-gray-400">Cliente: {empresa?.nombre_legal || 'N/A'}</p>
                    <p className="text-sm text-gray-400">Tipo: {conflictTask.tipo}</p>
                </div>
                
                <div className="flex justify-between space-x-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium flex-grow">Aceptar</button>
                    <button 
                        onClick={() => { onClose(); onOpenTaskModal(conflictTask.id, true); }} 
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium flex-grow"
                    >
                        Ver Cita Actual
                    </button>
                </div>
            </div>
        </div>
    );
};


const NewTaskModal = ({ isOpen, onClose, allEmpresas, currentEmpresaId, updateTareas, responsableId, allTareas, onOpenConflictModal, isEditing = false, currentTask = null }) => {
    
    const isClientRole = !!currentEmpresaId;
    const clientEmpresa = isClientRole ? allEmpresas.find(e => e.id === currentEmpresaId) : null;
    
    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const empresaId = isEditing 
            ? currentTask.empresa_id 
            : (isClientRole ? currentEmpresaId : formData.get('empresa_id'));
        
        const newTime = formData.get('hora_vencimiento');
        const newDate = formData.get('fecha_vencimiento');
        const newType = formData.get('tipo');

        if (!empresaId) return alert("Debe seleccionar un cliente.");

        // LÓGICA DE DETECCIÓN DE CONFLICTO
        if (newType === 'Reunión' && newTime) {
            const conflict = checkConflict(newDate, newTime, allTareas.filter(t => t.id !== currentTask?.id));
            if (conflict) {
                // Si hay conflicto, abrir el modal de alerta y detener la creación/edición
                onOpenConflictModal(conflict);
                return;
            }
        }
        // FIN LÓGICA DE DETECCIÓN DE CONFLICTO

        const tareaData = {
            id: isEditing ? currentTask.id : null,
            empresa_id: empresaId,
            titulo: formData.get('titulo'),
            fecha_vencimiento: newDate,
            hora_vencimiento: newTime || null, 
            tipo: newType,
            recurrencia: formData.get('recurrencia'),
            estado: formData.get('estado') || 'Pendiente',
            fecha_creacion: isEditing ? currentTask.fecha_creacion : new Date(),
            fecha_completada: isEditing ? currentTask.fecha_completada : null,
            responsable_id: responsableId, 
        };
        
        // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por addDoc o updateDoc
        updateTareas(tareaData); 
        onClose();
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center p-4 py-10 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg animate-fade-in mb-auto overflow-y-auto max-h-full">
                <h3 className="text-2xl font-bold text-white mb-4">{isEditing ? 'Editar Tarea/Cita/Reunión' : 'Registrar Tarea/Cita/Reunión'}</h3>
                <div className="space-y-4">
                    
                    <label className="block text-sm font-medium text-gray-400">Cliente Asociado</label>
                    <select name="empresa_id" className="input-form bg-slate-700 p-3" required disabled={isClientRole || isEditing} defaultValue={isEditing ? currentTask?.empresa_id : (currentEmpresaId || '')}>
                        {isClientRole && !isEditing ? (
                            <option value={clientEmpresa?.id}>{clientEmpresa?.nombre_legal}</option>
                        ) : (
                            <>
                                <option value="">Seleccione un cliente...</option>
                                {allEmpresas.map(e => <option key={e.id} value={e.id}>{e.nombre_legal}</option>)}
                            </>
                        )}
                    </select>

                    <label className="block text-sm font-medium text-gray-400">Tipo de Obligación</label>
                    <select name="tipo" className="input-form bg-slate-700 p-3" required defaultValue={currentTask?.tipo || 'Fiscal'}>
                        <option value="Fiscal">Tarea Fiscal (Declaración, Pago)</option>
                        <option value="Reunión">Cita/Reunión</option>
                        <option value="Interna">Tarea Interna (Administrativa)</option>
                        <option value="Lead_FollowUp">Seguimiento Lead</option>
                        <option value="Otra">Otra</option>
                    </select>
                    
                    <input name="titulo" type="text" placeholder="Título (Ej: Reunión con cliente A)" className="input-form bg-slate-700 p-3" required defaultValue={currentTask?.titulo || ''} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Fecha Límite</label>
                            <input name="fecha_vencimiento" type="date" className="input-form bg-slate-700 p-3" required defaultValue={currentTask?.fecha_vencimiento || ''} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Hora (Solo para Citas/Reuniones)</label>
                            <input name="hora_vencimiento" type="time" className="input-form bg-slate-700 p-3" defaultValue={currentTask?.hora_vencimiento || ''} />
                        </div>
                    </div>
                    
                    <label className="block text-sm font-medium text-gray-400">Estado</label>
                    <select name="estado" className="input-form bg-slate-700 p-3" required defaultValue={currentTask?.estado || 'Pendiente'}>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Completada">Completada</option>
                    </select>

                    <label className="block text-sm font-medium text-gray-400">Recurrencia</label>
                    <select name="recurrencia" className="input-form bg-slate-700 p-3" required defaultValue={currentTask?.recurrencia || 'Única'}>
                        <option value="Única">Única</option>
                        <option value="Diaria">Diaria</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Mensual">Mensual</option>
                        <option value="Anual">Anual</option>
                    </select>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cancelar</button>
                    <button type="submit" className="btn-accion bg-green-600 hover:bg-green-700 px-4 py-2">{isEditing ? 'Guardar Cambios' : 'Guardar Obligación'}</button>
                </div>
            </form>
        </div>
    );
};

const NewLeadModal = ({ isOpen, onClose, updateLeads }) => {
    
    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const newLead = {
            id: null,
            nombre_empresa: formData.get('nombre_empresa'),
            contacto_principal: formData.get('contacto_principal'),
            celular: formData.get('celular'),
            email: formData.get('email'),
            ciudad: formData.get('ciudad'),
            pipeline_fase: formData.get('pipeline_fase'),
            proximo_seguimiento: formData.get('proximo_seguimiento') || null,
            fecha_creacion: new Date(),
        };

        // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por addDoc(leadsCol, newLead)
        updateLeads(newLead); 
        onClose();
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center p-4 py-10 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg animate-fade-in mb-auto overflow-y-auto max-h-full">
                <h3 className="text-2xl font-bold text-white mb-4">Registrar Nuevo Lead</h3>
                <div className="space-y-4">
                    <input name="nombre_empresa" type="text" placeholder="Nombre de la Empresa" className="input-form bg-slate-700 p-3" required />
                    <input name="contacto_principal" type="text" placeholder="Persona de Contacto" className="input-form bg-slate-700 p-3" />
                    <div className="grid grid-cols-2 gap-4">
                        <input name="celular" type="tel" placeholder="Celular / WhatsApp" className="input-form bg-slate-700 p-3" />
                        <input name="email" type="email" placeholder="Correo Electrónico" className="input-form bg-slate-700 p-3" />
                    </div>
                    <input name="ciudad" type="text" placeholder="Ciudad" className="input-form bg-slate-700 p-3" />

                    <label className="block text-sm font-medium text-gray-400">Fase del Pipeline</label>
                    <select name="pipeline_fase" className="input-form bg-slate-700 p-3" required defaultValue={'Contacto Inicial'}>
                        <option value="Contacto Inicial">Contacto Inicial</option>
                        <option value="Propuesta Enviada">Propuesta Enviada</option>
                        <option value="Negociación">Negociación</option>
                        <option value="Ganado">Ganado</option>
                        <option value="Perdido">Perdido</option>
                    </select>
                    
                    <label className="block text-sm font-medium text-gray-400">Próximo Seguimiento (Fecha)</label>
                    <input name="proximo_seguimiento" type="date" className="input-form bg-slate-700 p-3" />
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium">Cancelar</button>
                    <button type="submit" className="btn-accion bg-orange-600 hover:bg-orange-700 px-4 py-2">Guardar Lead</button>
                </div>
            </form>
        </div>
    );
};

const NewTransactionModal = ({ isOpen, onClose, updateData, type, allTags, responsableId, initialData = null }) => {
    
    const isIncome = type === 'ingreso';
    const [concepto, setConcepto] = useState('');
    const [tipoDetalle, setTipoDetalle] = useState(isIncome ? 'Factura' : 'Suscripción');
    const [monto, setMonto] = useState('');
    const [etiqueta, setEtiqueta] = useState(allTags.length > 0 ? allTags[0] : '');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [recurrencia, setRecurrencia] = useState('Única');

    useEffect(() => {
        if (initialData) {
            setConcepto(initialData.concepto || '');
            setTipoDetalle(initialData.tipo_detalle || (isIncome ? 'Factura' : 'Suscripción'));
            setMonto(initialData.monto || '');
            setEtiqueta(initialData.etiqueta || (allTags.length > 0 ? allTags[0] : ''));
            setFecha(initialData.fecha ? new Date(initialData.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setRecurrencia(initialData.recurrencia || 'Única');
        } else {
            // Reset for new transaction
            setConcepto('');
            setTipoDetalle(isIncome ? 'Factura' : 'Suscripción');
            setMonto('');
            setEtiqueta(allTags.length > 0 ? allTags[0] : '');
            setFecha(new Date().toISOString().split('T')[0]);
            setRecurrencia('Única');
        }
    }, [initialData, isOpen, isIncome, allTags]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        
        const transactionData = {
            id: initialData?.original_id || initialData?.id, // Keep id for updates
            concepto,
            tipo_detalle: tipoDetalle,
            monto: parseFloat(monto),
            fecha,
            recurrencia,
            etiqueta,
            responsable_id: responsableId,
            tipo_transaccion: isIncome ? 'Ingreso' : 'Gasto',
        };
        
        if (isNaN(transactionData.monto) || transactionData.monto <= 0) {
            alert("El monto debe ser un número positivo.");
            return;
        }

        updateData(transactionData);
        onClose();
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center p-4 py-10 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg animate-fade-in mb-auto overflow-y-auto max-h-full">
                <h3 className="text-2xl font-bold text-white mb-4">{(initialData ? 'Editar' : 'Registrar')} {isIncome ? 'Ingreso' : 'Gasto'}</h3>
                <div className="space-y-4">
                    
                    <input name="concepto" type="text" placeholder="Concepto" className="input-form bg-slate-700 p-3" required value={concepto} onChange={e => setConcepto(e.target.value)} />
                    
                    <label className="block text-sm font-medium text-gray-400">Tipo de {isIncome ? 'Ingreso' : 'Gasto'}</label>
                    <select name="tipo" className="input-form bg-slate-700 p-3" required value={tipoDetalle} onChange={e => setTipoDetalle(e.target.value)}>
                        {isIncome ? (
                            <>
                                <option value="Factura">Factura</option>
                                <option value="Adelanto">Adelanto</option>
                                <option value="Otro">Otro Ingreso</option>
                            </>
                        ) : (
                            <>
                                <option value="Suscripción">Suscripción (Software)</option>
                                <option value="Fijo">Gasto Fijo (Alquiler)</option>
                                <option value="Servicio">Servicio (Teléfono, Internet)</option>
                                <option value="Imprevisto">Imprevisto</option>
                            </>
                        )}
                    </select>
                    
                    <label className="block text-sm font-medium text-gray-400">Monto</label>
                    <input name="monto" type="number" step="100" placeholder="Monto (sin puntos ni comas)" className="input-form bg-slate-700 p-3" required value={monto} onChange={e => setMonto(e.target.value)} />
                    
                    <label className="block text-sm font-medium text-gray-400">Etiqueta</label>
                     <select name="etiqueta" className="input-form bg-slate-700 p-3" required value={etiqueta} onChange={e => setEtiqueta(e.target.value)}>
                        {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                    </select>

                    <label className="block text-sm font-medium text-gray-400">Fecha de Transacción</label>
                    <input name="fecha" type="date" className="input-form bg-slate-700 p-3" required value={fecha} onChange={e => setFecha(e.target.value)} />

                    {/* Campo de Recurrencia (Solo para Gastos Fijos) */}
                    {!isIncome && (
                         <>
                            <label className="block text-sm font-medium text-gray-400">Recurrencia (Para futuros gastos)</label>
                            <select name="recurrencia" className="input-form bg-slate-700 p-3" required value={recurrencia} onChange={e => setRecurrencia(e.target.value)}>
                                <option value="Única">Única (Solo este mes)</option>
                                <option value="Mensual">Mensual (Gasto Fijo)</option>
                                <option value="Anual">Anual</option>
                            </select>
                        </>
                    )}
                    
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cancelar</button>
                    <button type="submit" className={`btn-accion ${isIncome ? 'bg-green-600' : 'bg-red-600'} px-4 py-2`}>{initialData ? 'Guardar Cambios' : 'Guardar'}</button>
                </div>
            </form>
        </div>
    );
};

// NUEVO: Modal de Gestión de Etiquetas
const TagManagementModal = ({ isOpen, onClose, allTags, updateTags }) => {
    const [newTag, setNewTag] = useState('');
    const [isEditingTag, setIsEditingTag] = useState(null); // Almacena la etiqueta que se está editando

    const handleCancelEdit = () => { // DEFINICIÓN DE LA FUNCIÓN FALTANTE
        setIsEditingTag(null);
        setNewTag('');
    };

    const handleAddOrEditTag = () => {
        if (newTag.trim() === '') return;
        
        if (isEditingTag) {
            // Lógica de EDICIÓN
            if (newTag.trim() === isEditingTag) {
                // No hay cambios, solo cerrar edición
                handleCancelEdit();
                return;
            }
            // TODO: INTEGRACIÓN SUPABASE REAL: updateTags({ type: 'EDIT', oldTag: isEditingTag, newTag: newTag.trim() })
            updateTags({ type: 'EDIT', oldTag: isEditingTag, newTag: newTag.trim() });
            handleCancelEdit();
        } else {
            // Lógica de AGREGAR
            if (allTags.includes(newTag.trim())) {
                alert("La etiqueta ya existe.");
                return;
            }
            // TODO: INTEGRACIÓN SUPABASE REAL: updateTags({ type: 'ADD', tag: newTag.trim() })
            updateTags({ type: 'ADD', tag: newTag.trim() });
            setNewTag('');
        }
    };
    
    const handleStartEdit = (tag) => {
        setIsEditingTag(tag);
        setNewTag(tag);
    };

    const handleDeleteTag = (tag) => {
        if (window.confirm(`¿Estás seguro de eliminar la etiqueta "${tag}"?`)) {
            // TODO: INTEGRACIÓN SUPABASE REAL: updateTags({ type: 'DELETE', tag: tag })
            updateTags({ type: 'DELETE', tag: tag });
            if (isEditingTag === tag) {
                handleCancelEdit();
            }
        }
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center items-center p-4 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-4">Gestión de Etiquetas (Finanzas)</h3>
                
                {/* Agregar/Editar Etiqueta */}
                <div className="flex space-x-2 mb-6 p-3 bg-slate-700 rounded-lg">
                    <input
                        type="text"
                        placeholder={isEditingTag ? "Editando..." : "Nueva Etiqueta (Ej: Marketing)"}
                        className="input-form bg-slate-600 p-2 flex-grow"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddOrEditTag();
                            }
                        }}
                    />
                    <button onClick={handleCancelEdit} className="btn-accion bg-slate-500 px-3 py-2 text-sm">
                        {isEditingTag ? 'Cancelar' : 'Agregar'}
                    </button>
                    <button onClick={handleAddOrEditTag} className={`btn-accion ${isEditingTag ? 'bg-blue-600' : 'bg-teal-600'} px-3 py-2 text-sm`}>
                        <ion-icon name={isEditingTag ? 'save-outline' : 'add-circle-outline'}></ion-icon>
                    </button>
                </div>
                
                {/* Lista de Etiquetas */}
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {allTags.map(tag => (
                        <div key={tag} className="flex justify-between items-center p-2 bg-slate-700 rounded">
                            <span className={`text-gray-200 font-medium ${isEditingTag === tag ? 'text-yellow-400 font-bold' : ''}`}>{tag}</span>
                            <div className="flex space-x-2">
                                {/* Botón Editar */}
                                <button onClick={() => handleStartEdit(tag)} className="text-blue-400 hover:text-blue-300 transition p-1">
                                    <ion-icon name="create-outline"></ion-icon>
                                </button>
                                {/* Botón Eliminar */}
                                <button onClick={() => handleDeleteTag(tag)} className="text-red-400 hover:text-red-300 transition p-1">
                                    <ion-icon name="trash-outline"></ion-icon>
                                </button>
                            </div>
                        </div>
                    ))}
                    {allTags.length === 0 && <p className="text-gray-500 text-sm">No hay etiquetas creadas.</p>}
                </div>

                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

const LeadDetailModal = ({ isOpen, onClose, lead, allInteraccionesLeads, updateInteraccionesLeads, responsableId, auxiliaryUsers }) => {
    const [newInteraction, setNewInteraction] = useState(''); 
    
    const leadInteracciones = useMemo(() => {
        if (!lead) return []; 
        return allInteraccionesLeads.filter(i => i.lead_id === lead.id)
            .sort((a, b) => new Date(b.fecha_interaccion) - new Date(a.fecha_interaccion)); 
    }, [allInteraccionesLeads, lead]); 

    if (!lead) return null; 

    const handleInteractionSubmit = (e) => {
        e.preventDefault();
        if (newInteraction.trim() === '') return;

        const nuevaInteraccion = {
            lead_id: lead.id,
            texto: newInteraction,
            responsable_id: responsableId,
            fecha_interaccion: new Date(),
        };

        // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por addDoc(interaccionesLeadsCol, nuevaInteraccion)
        updateInteraccionesLeads(nuevaInteraccion);
        setNewInteraction('');
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center items-center p-4 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-xl animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-4">Ficha de Lead: {lead.nombre_empresa}</h3>
                
                <div className="grid grid-cols-2 gap-4 border-b border-slate-700 pb-4 mb-4">
                    {/* Columna de Detalles */}
                    <div className="space-y-2">
                        <div>
                            <label className="text-sm font-medium text-gray-400">Fase:</label>
                            <p className="text-lg text-yellow-400 font-semibold">{lead.pipeline_fase}</p>
                        </div>
                         <div>
                            <label className="text-sm font-medium text-gray-400">Contacto:</label>
                            <p className="text-lg text-white">{lead.contacto_principal}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Ciudad:</label>
                            <p className="text-lg text-white">{lead.ciudad}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Email:</label>
                            <p className="text-md text-white">{lead.email}</p>
                        </div>
                    </div>
                    
                    {/* Columna de Fechas y Contacto */}
                    <div className="space-y-2">
                         <div>
                            <label className="text-sm font-medium text-gray-400">Teléfono/WhatsApp:</label>
                            <p className="text-lg text-white">{lead.celular}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Próximo Seguimiento:</label>
                            <p className="text-lg text-red-400 font-bold">{lead.proximo_seguimiento ? new Date(lead.proximo_seguimiento.replace(/-/g, '/')).toLocaleDateString('es-CO') : 'Sin Fecha'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Fecha de Creación:</label>
                            <p className="text-md text-white">{lead.fecha_creacion ? new Date(lead.fecha_creacion).toLocaleDateString('es-CO') : 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Sección de Historial de Interacciones (Punto 1) */}
                <div className="mt-4">
                    <h4 className="text-xl font-semibold text-orange-400 mb-2">Historial de Interacciones ({leadInteracciones.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-3 p-2 bg-slate-700 rounded-lg mb-3">
                        {leadInteracciones.length === 0 ? (
                            <p className="text-gray-500 text-sm">No hay interacciones registradas.</p>
                        ) : (
                            leadInteracciones.map(i => (
                                <div key={i.id} className="border-b border-slate-600 pb-2 last:border-b-0">
                                    <p className="text-sm text-gray-200">{i.texto}</p>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {getResponsableName(i.responsable_id, auxiliaryUsers)} - {new Date(i.fecha_interaccion).toLocaleDateString('es-CO')}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Formulario para Añadir Interacción */}
                    <form onSubmit={handleInteractionSubmit} className="flex space-x-2">
                        <input
                            type="text"
                            placeholder="Añadir nueva interacción..."
                            className="input-form bg-slate-700 p-2 flex-grow"
                            value={newInteraction}
                            onChange={(e) => setNewInteraction(e.target.value)}
                        />
                        <button type="submit" className="btn-accion bg-orange-600 px-3 py-2 text-sm">
                            <ion-icon name="send-outline"></ion-icon>
                        </button>
                    </form>
                </div>

                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cerrar</button>
                </div>
            </div>
        </div>
    );
}

const TaskDetailModal = ({ isOpen, onClose, task, empresas, allComentarios, updateComentarios, responsableId, auxiliaryUsers, onEditTask }) => {
    
    const [newComment, setNewComment] = useState(''); 
    
    const taskComentarios = useMemo(() => { 
        if (!task) return []; 
        return allComentarios.filter(c => c.tarea_id === task.id)
            .sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion));
    }, [allComentarios, task]); 

    if (!task) return null; 

    const empresa = empresas.find(e => e.id === task.empresa_id);
    
    const handleCommentSubmit = (e) => {
        e.preventDefault();
        if (newComment.trim() === '') return;

        const nuevoComentario = {
            tarea_id: task.id,
            texto: newComment,
            responsable_id: responsableId,
            fecha_creacion: new Date(),
        };

        // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por addDoc(comentariosCol, nuevoComentario)
        updateComentarios(nuevoComentario); // <--- FUNCIONALIDAD CORREGIDA AQUÍ
        setNewComment('');
    };

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center items-center p-4 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-xl animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-4">Ficha de Tarea: {task.titulo}</h3>
                
                <div className="grid grid-cols-2 gap-4 border-b border-slate-700 pb-4 mb-4">
                    {/* Columna de Detalles */}
                    <div className="space-y-2">
                        <div>
                            <label className="text-sm font-medium text-gray-400">Empresa:</label>
                            <p className="text-lg text-white font-semibold" style={{ color: empresa?.color_hex || 'white' }}>{empresa?.nombre_legal || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Tipo:</label>
                            <p className="text-lg text-white">{task.tipo}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Estado:</label>
                            <div className="mt-1">{getStateBadge(task.estado)}</div>
                        </div>
                    </div>
                    
                    {/* Columna de Fechas y Auditoría */}
                    <div className="space-y-2">
                        <div>
                            <label className="text-sm font-medium text-gray-400">Creado por:</label>
                            <p className="text-lg text-white">{getResponsableName(task.responsable_id, auxiliaryUsers)}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Fecha de Creación:</label>
                            <p className="text-md text-white">{task.fecha_creacion ? new Date(task.fecha_creacion).toLocaleDateString('es-CO') : 'N/A'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-400">Fecha Límite:</label>
                            <p className="text-md text-red-400 font-bold">{new Date(task.fecha_vencimiento.replace(/-/g, '/')).toLocaleDateString('es-CO')}</p>
                        </div>
                        {task.hora_vencimiento && 
                            <div>
                                <label className="text-sm font-medium text-gray-400">Hora:</label>
                                <p className="text-md text-white">{task.hora_vencimiento}</p>
                            </div>
                        }
                    </div>
                </div>

                {/* Sección de Comentarios (Punto 5) */}
                <div className="mt-4">
                    <h4 className="text-xl font-semibold text-teal-400 mb-2">Comentarios ({taskComentarios.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-3 p-2 bg-slate-700 rounded-lg mb-3">
                        {taskComentarios.length === 0 ? (
                            <p className="text-gray-500 text-sm">No hay comentarios en esta ficha.</p>
                        ) : (
                            taskComentarios.map(c => (
                                <div key={c.id} className="border-b border-slate-600 pb-2 last:border-b-0">
                                    <p className="text-sm text-gray-200">{c.texto}</p>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {getResponsableName(c.responsable_id, auxiliaryUsers)} - {new Date(c.fecha_creacion).toLocaleDateString('es-CO')}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="flex space-x-2">
                        <input
                            type="text"
                            placeholder="Añadir comentario..."
                            className="input-form bg-slate-700 p-2 flex-grow"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                        />
                        <button type="submit" className="btn-accion bg-blue-600 px-3 py-2 text-sm">
                            <ion-icon name="send-outline"></ion-icon>
                        </button>
                    </form>
                </div>

                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onEditTask} className="mr-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Editar</button>
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cerrar</button>
                </div>
            </div>
        </div>
    );
}

// NUEVO: Modal de Agenda Diaria por Horas
const DailyAgendaModal = ({ isOpen, onClose, selectedDate, tasksForDay, empresas, onOpenTaskModal }) => {
    
    if (!selectedDate) return null;

    const formattedDate = selectedDate.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const agendaSlots = useMemo(() => {
        const slots = [];
        // Creamos slots de 8:00 a 20:00 (12 horas)
        for (let h = 8; h <= 20; h++) {
            const time = `${String(h).padStart(2, '0')}:00`;
            slots.push({ time, events: [] });
        }
        return slots;
    }, []);

    const agendaEvents = useMemo(() => {
        const slots = agendaSlots.map(s => ({...s, events: []}));
        const unscheduledTasks = [];

        tasksForDay.forEach(task => {
            if (task.hora_vencimiento) {
                const hour = formatHour(task.hora_vencimiento).split(':')[0]; // Obtener solo la hora
                const slotIndex = parseInt(hour) - 8;
                
                if (slotIndex >= 0 && slotIndex < slots.length) {
                    slots[slotIndex].events.push(task);
                }
            } else {
                unscheduledTasks.push(task);
            }
        });
        
        return { slots, unscheduledTasks };
    }, [tasksForDay, agendaSlots]);

    return (
        <div className={`fixed inset-0 bg-black/70 justify-center p-4 py-10 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-2xl animate-fade-in mb-auto overflow-y-auto max-h-full">
                <h3 className="text-2xl font-bold text-teal-400 mb-2">Agenda Diaria</h3>
                <p className="text-xl text-white mb-4">{formattedDate}</p>

                {/* Tareas sin Hora (Vencimiento) */}
                {agendaEvents.unscheduledTasks.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-900/40 border-l-4 border-yellow-500 rounded-lg">
                        <h4 className="text-lg font-semibold text-yellow-400 mb-2">Tareas de Vencimiento (Sin Hora)</h4>
                        <div className="space-y-1">
                            {agendaEvents.unscheduledTasks.map(task => (
                                <div key={task.id} className="flex justify-between items-center text-sm text-gray-200">
                                    <span className="truncate">{task.titulo}</span>
                                    <button onClick={() => onOpenTaskModal(task.id, true)} className="text-teal-400 hover:text-teal-300 ml-2 text-xs">Ver Ficha</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Agenda por Horas */}
                <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
                    {agendaEvents.slots.map(slot => (
                        <div key={slot.time} className="grid grid-cols-4 gap-2 border-b border-slate-700 py-2 items-start">
                            <span className="col-span-1 font-bold text-gray-400 text-right pr-4">{slot.time}</span>
                            <div className="col-span-3 space-y-1 min-h-[2rem]">
                                {slot.events.length === 0 ? (
                                    <span className="text-gray-500 text-sm italic">Disponible</span>
                                ) : (
                                    slot.events.map(task => {
                                        const empresa = empresas.find(e => e.id === task.empresa_id);
                                        return (
                                            <div 
                                                key={task.id} 
                                                className="p-2 rounded-lg text-sm shadow-md cursor-pointer hover:opacity-80 transition"
                                                style={{ backgroundColor: task.tipo === 'Reunión' ? '#374151' : '#1f2937', borderLeft: `4px solid ${empresa?.color_hex || '#64748b'}` }}
                                                onClick={() => onOpenTaskModal(task.id, true)}
                                            >
                                                <span className="font-semibold text-white">{task.titulo}</span>
                                                <span className="text-xs text-gray-400 block">{task.tipo} | {empresa?.nombre_legal}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cerrar Agenda</button>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// 4. PÁGINAS PRINCIPALES
// =============================================================================

const DashboardPage = ({ allEmpresas, allTareas, onOpenTaskModal }) => {
    // ... [DashboardPage sin cambios estructurales, solo la visualización]
    const [activeTab, setActiveTab] = useState('hoy');

    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const tomorrow = useMemo(() => { const d = new Date(today); d.setDate(today.getDate() + 1); return d; }, [today]);
    const endOfWeek = useMemo(() => { const d = new Date(today); d.setDate(today.getDate() + (6 - today.getDay())); return d; }, [today]);
    const endOfMonth = useMemo(() => { const d = new Date(today.getFullYear(), today.getMonth() + 1, 0); return d; }, [today]);

    const tareasFiltradas = useMemo(() => {
        return allTareas
            .filter(t => t.estado !== 'Completada' && t.estado !== 'Archivada')
            .map(t => ({
                ...t, 
                empresa: allEmpresas.find(e => e.id === t.empresa_id)
            }))
            .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
    }, [allTareas, allEmpresas]);

    const tareasUrgentes = useMemo(() => {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return tareasFiltradas
            .filter(t => t.tipo !== 'Reunión' && new Date(t.fecha_vencimiento) <= nextWeek)
            .slice(0, 5);
    }, [tareasFiltradas, today]);

    // 2. Citas y Reuniones (Agrupadas) - CON HORA
    const reunionesAgrupadas = useMemo(() => {
        const reuniones = tareasFiltradas.filter(t => t.tipo === 'Reunión');

        const hoy = reuniones.filter(t => isSameDay(t.fecha_vencimiento, today));
        const manana = reuniones.filter(t => isSameDay(t.fecha_vencimiento, tomorrow));
        const estaSemana = reuniones.filter(t => {
            const taskDate = new Date(t.fecha_vencimiento.replace(/-/g, '/')); // FIX DE FECHAS
            return isSameDay(taskDate, taskDate) && taskDate > tomorrow && taskDate <= endOfWeek;
        });
        const esteMes = reuniones.filter(t => {
            const taskDate = new Date(t.fecha_vencimiento.replace(/-/g, '/')); // FIX DE FECHAS
            return isSameDay(taskDate, taskDate) && taskDate > endOfWeek && taskDate <= endOfMonth;
        });

        return { hoy, manana, estaSemana, esteMes };
    }, [tareasFiltradas, today, tomorrow, endOfWeek, endOfMonth]);


    const renderReunionList = (list) => {
        // MODIFICADO: Añadido botón "Ver Detalle" y la hora
        return list.length === 0 ? (
            <p className="text-gray-500">No hay citas/reuniones.</p>
        ) : (
            list.map(tarea => (
                <div key={tarea.id} 
                    className="p-3 bg-slate-700 rounded-lg shadow-md flex justify-between items-center"
                    style={{ borderLeft: `4px solid ${tarea.empresa?.color_hex || '#64748b'}` }}>
                    <div>
                        <p className="font-bold text-white text-sm">{tarea.titulo}</p>
                        <p className="text-xs text-gray-400">
                             {tarea.hora_vencimiento ? `${tarea.hora_vencimiento} - ` : ''} 
                             {tarea.empresa?.nombre_legal}
                        </p>
                    </div>
                    <ActionButton icon="eye-outline" text="Ver Detalle" color="teal" small onClick={() => onOpenTaskModal(tarea.id, true)} />
                </div>
            ))
        );
    };

    const renderActiveReuniones = () => {
        switch (activeTab) {
            case 'hoy': return renderReunionList(reunionesAgrupadas.hoy);
            case 'manana': return renderReunionList(reunionesAgrupadas.manana);
            case 'semana': return renderReunionList(reunionesAgrupadas.estaSemana);
            case 'mes': return renderReunionList(reunionesAgrupadas.esteMes);
            default: return null;
        }
    };


    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Dashboard Principal</h2>
            
            {/* Panel de Citas y Reuniones */}
            <div className="bg-slate-800 p-4 md:p-6 rounded-lg shadow-xl mb-8">
                <h3 className="text-lg md:text-xl font-semibold text-yellow-400 mb-4 flex items-center">
                    <ion-icon name="calendar-number-outline" className="mr-2"></ion-icon> Próximas Citas y Reuniones
                </h3>
                
                <div className="border-b border-slate-700 mb-4 overflow-x-auto">
                    <div className="flex -mb-px">
                        {[
                            { id: 'hoy', label: `Hoy (${reunionesAgrupadas.hoy.length})`, color: 'text-red-400' },
                            { id: 'manana', label: `Mañana (${reunionesAgrupadas.manana.length})`, color: 'text-yellow-400' },
                            { id: 'semana', label: `Esta Semana (${reunionesAgrupadas.estaSemana.length})`, color: 'text-teal-400' },
                            { id: 'mes', label: `Este Mes (${reunionesAgrupadas.esteMes.length})`, color: 'text-blue-400' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-shrink-0 px-3 py-2 font-medium text-sm md:text-base md:px-4 border-b-2 transition duration-200 ${
                                    activeTab === tab.id
                                        ? `border-teal-400 ${tab.color}`
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 min-h-[100px]">
                    {renderActiveReuniones()}
                </div>
            </div>


            {/* Sección de Tareas Urgentes (Fiscal/General) */}
            <div className="bg-slate-800 p-4 md:p-6 rounded-lg shadow-xl">
                <h3 className="text-lg md:text-xl font-semibold text-teal-400 mb-4">Próximos Vencimientos (Fiscal/General)</h3>
                <div className="space-y-4">
                    {tareasUrgentes.length === 0 ? (
                        <p className="text-gray-400">¡Todo al día! No hay vencimientos urgentes.</p>
                    ) : (
                        tareasUrgentes.map(tarea => (
                            <div key={tarea.id} 
                                 className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-700 rounded-lg shadow-md"
                                 style={{ borderLeft: `4px solid ${tarea.empresa?.color_hex || '#64748b'}` }}>
                                <div>
                                    <h4 className="font-bold text-base md:text-lg text-white">{tarea.titulo}</h4>
                                    <p className="text-sm text-gray-400">
                                        Cliente: <span className="text-teal-300">{tarea.empresa?.nombre_legal}</span>
                                    </p>
                                </div>
                                <div className="mt-2 sm:mt-0 text-right">
                                    <span className="text-base md:text-lg font-bold text-red-400">
                                        {new Date(tarea.fecha_vencimiento.replace(/-/g, '/')).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
                                    </span>
                                    <div className="flex items-center justify-end space-x-2 mt-1">
                                        {getStateBadge(tarea.estado)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// ... [ClientesPage y ClienteDetallePage sin cambios significativos]

const ClientesPage = ({ allEmpresas, onSelectEmpresa, onOpenClientModal }) => {
    // MODIFICADO: Añadido onOpenClientModal
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroNit, setFiltroNit] = useState('');

    const empresasFiltradas = useMemo(() => {
        return allEmpresas.filter(empresa => {
            return (
                empresa.nombre_legal.toLowerCase().includes(filtroNombre.toLowerCase()) &&
                empresa.nit.includes(filtroNit)
            );
        });
    }, [allEmpresas, filtroNombre, filtroNit]);
    
    // FIX DOM NESTING: Se modifica para manejar el array vacío dentro del useMemo
    const tableRows = useMemo(() => {
        if (empresasFiltradas.length === 0) {
             return [
                <tr key="no-clients">
                    <td colSpan="4" className="p-3 text-center text-gray-500">No hay clientes.</td>
                </tr>
            ];
        }
        return empresasFiltradas.map(empresa => (
            <tr key={empresa.id} className="border-b border-slate-700 hover:bg-slate-700">
                <td className="p-3 font-medium text-white">{empresa.nombre_legal}</td>
                <td className="p-3 text-gray-300">{empresa.nit}</td>
                <td className="p-3 text-yellow-400">{empresa.client_password}</td> {/* Mostrar Contraseña */}
                <td className="p-3 flex space-x-2">
                    <button onClick={() => onSelectEmpresa(empresa.id)} className="bg-teal-600 hover:bg-teal-700 text-white py-1 px-3 rounded-lg text-sm font-medium transition duration-200">
                        Ver
                    </button>
                    <button onClick={() => onOpenClientModal(empresa, true)} className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg text-sm font-medium transition duration-200">
                        Editar
                    </button>
                </td>
            </tr>
        ));
    }, [empresasFiltradas, onSelectEmpresa, onOpenClientModal]);

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Gestión de Clientes</h2>
                <ActionButton icon="person-add-outline" text="Nuevo Cliente" color="blue" onClick={() => onOpenClientModal(null, false)} />
            </div>

            <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl font-semibold text-teal-400 mb-4">Historial de Clientes</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input type="text" placeholder="Filtrar por Nombre Legal..." className="input-form" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
                    <input type="text" placeholder="Filtrar por NIT..." className="input-form" value={filtroNit} onChange={(e) => setFiltroNit(e.target.value)} />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-left">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-3 text-sm font-semibold text-gray-400">Nombre Legal</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">NIT</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Contraseña</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ClienteDetallePage = ({ empresaId, onBack, allEmpresas, allTareas, allNotas, allDocumentos, updateTareas, updateNotas, onOpenTaskModal }) => {
    
    const empresa = allEmpresas.find(e => e.id === empresaId);
    
    // Filtramos la data mockeada del contexto global
    const tareasCliente = allTareas.filter(t => t.empresa_id === empresaId);
    const notasCliente = allNotas.filter(n => n.empresa_id === empresaId);
    const documentosCliente = allDocumentos.filter(d => d.empresa_id === empresaId);

    const handleCompletarTarea = (tarea) => {
        if (tarea.estado === 'Completada') return;

        const updatedTarea = { ...tarea, estado: 'Completada', fecha_completada: new Date() };
        // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por updateDoc(tareaRef, updatedTarea)
        updateTareas(updatedTarea); 

        if (tarea.recurrencia !== 'Única') {
            const fechaVencimientoActual = new Date(tarea.fecha_vencimiento);
            let proximaFechaVencimiento = new Date(fechaVencimientoActual);

            switch (tarea.recurrencia) {
                case 'Diaria': proximaFechaVencimiento.setDate(proximaFechaVencimiento.getDate() + 1); break;
                case 'Semanal': proximaFechaVencimiento.setDate(proximaFechaVencimiento.getDate() + 7); break;
                case 'Mensual': proximaFechaVencimiento.setMonth(proximaFechaVencimiento.getMonth() + 1); break;
                case 'Anual': proximaFechaVencimiento.setFullYear(proximaFechaVencimiento.getFullYear() + 1); break;
            }

            const nuevaTarea = {
                empresa_id: tarea.empresa_id,
                titulo: tarea.titulo,
                tipo: tarea.tipo,
                fecha_vencimiento: proximaFechaVencimiento.toISOString().split('T')[0],
                hora_vencimiento: tarea.hora_vencimiento,
                estado: 'Pendiente',
                recurrencia: tarea.recurrencia,
                fecha_creacion: new Date(),
                responsable_id: tarea.responsable_id,
            };
            // TODO: INTEGRACIÓN SUPABASE REAL: Reemplazar por addDoc(tareasCol, nuevaTarea)
            updateTareas(nuevaTarea);
        }
    };
    
    if (!empresa) return <p>Cargando detalles del cliente...</p>;

    return (
        <div className="animate-fade-in">
            {/* Solo muestra el botón de volver si es Admin */}
            {onBack && (
                <button onClick={onBack} className="flex items-center text-teal-400 hover:text-teal-300 mb-4">
                    <ion-icon name="arrow-back-outline" className="mr-2"></ion-icon>
                    Volver a Clientes
                </button>
            )}

            {/* Info de la Empresa */}
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl mb-6" style={{ borderLeft: `6px solid ${empresa.color_hex}` }}>
                <h2 className="text-3xl font-bold text-white mb-2">{empresa.nombre_legal}</h2>
                <p className="text-gray-400">NIT: <span className="text-gray-200">{empresa.nit}</span></p>
                <p className="text-gray-400">Email: <span className="text-gray-200">{empresa.email_contacto || 'N/A'}</span></p>
            </div>

            {/* Contenedor de Tareas y Notas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Columna de Tareas/Obligaciones */}
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-teal-400">Tareas y Obligaciones</h3>
                        <ActionButton icon="add" text="Nueva Tarea" color="green" small onClick={() => onOpenTaskModal(empresaId)} />
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {tareasCliente.map(tarea => {
                            const isCompletada = tarea.estado === 'Completada';
                            return (
                                <div key={tarea.id} className={`p-4 rounded-lg shadow-md ${isCompletada ? 'bg-slate-900 opacity-60' : 'bg-slate-700'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold ${isCompletada ? 'text-gray-500 line-through' : 'text-white'}`}>
                                            {tarea.titulo}
                                        </span>
                                        {!isCompletada && (
                                            <button onClick={() => handleCompletarTarea(tarea)} className="bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-lg text-xs font-bold" title="Marcar como completada">
                                                <ion-icon name="checkmark-done-outline"></ion-icon>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400">
                                        Vence: <span className="text-red-400 font-medium">{new Date(tarea.fecha_vencimiento.replace(/-/g, '/')).toLocaleDateString('es-CO')} {tarea.hora_vencimiento}</span>
                                    </p>
                                    <div className="flex justify-between items-center text-xs mt-2">
                                        <span className="text-gray-500 capitalize">{tarea.recurrencia}</span>
                                        {getStateBadge(tarea.estado)}
                                    </div>
                                </div>
                            );
                        })}
                        {tareasCliente.length === 0 && <p className="text-gray-500">No hay tareas asignadas.</p>}
                    </div>
                </div>

                {/* Columna de Notas */}
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-teal-400">Notas Rápidas</h3>
                         <ActionButton icon="add" text="Nueva Nota" color="blue" small />
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {notasCliente.map(nota => (
                            <div key={nota.id} className="bg-slate-700 p-4 rounded-lg shadow">
                                <h4 className="font-bold text-white">{nota.titulo}</h4>
                                <p className="text-sm text-gray-300 mb-2">{nota.contenido}</p>
                                <p className="text-xs text-gray-500 text-right">{new Date(nota.fecha_creacion).toLocaleDateString('es-CO')}</p>
                            </div>
                        ))}
                        {notasCliente.length === 0 && <p className="text-gray-500">No hay notas para este cliente.</p>}
                    </div>
                </div>

                {/* Columna de Documentos */}
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <h3 className="text-xl font-semibold text-teal-400 mb-4">Documentos</h3>
                    
                    <div className="mb-4 space-y-2">
                        <input type="file" className="input-form file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" />
                        <ActionButton icon="cloud-upload-outline" text="Subir Documento" color="blue" className="w-full text-sm py-2" />
                    </div>
                    
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {documentosCliente.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                                <div className="flex items-center truncate">
                                    <ion-icon name="document-text-outline" className="text-teal-400 text-xl mr-3"></ion-icon>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-white font-medium truncate hover:text-teal-300" title={doc.nombre}>
                                        {doc.nombre}
                                    </a>
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(doc.fecha_subida).toLocaleDateString('es-CO')}</span>
                            </div>
                        ))}
                        {documentosCliente.length === 0 && <p className="text-gray-500">No hay documentos subidos.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CalendarioPage = ({ allEmpresas, allTareas, onOpenTaskModal, onOpenDailyAgenda }) => { 
    // MODIFICADO: Añadido onOpenDailyAgenda
    const [currentDate, setCurrentDate] = useState(new Date()); // Nov 15, 2025 (para ver datos del mock)

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendarData = useMemo(() => {
        const today = new Date();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Domingo, 1 = Lunes...

        // Lógica optimizada para agrupar todas las tareas de todas las empresas
        const tareasPorDia = allTareas.reduce((acc, tarea) => {
            // FIX DE FECHAS: Usar replace(/-/g, '/') para forzar la interpretación como fecha LOCAL.
            const fecha = new Date(tarea.fecha_vencimiento.replace(/-/g, '/')); 
            
            if (fecha.getFullYear() === year && fecha.getMonth() === month) {
                const dia = fecha.getDate();
                if (!acc[dia]) acc[dia] = [];
                acc[dia].push(tarea);
            }
            return acc;
        }, {});

        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ key: `empty-${i}`, type: 'empty' });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const isCurrentDay = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            days.push({ 
                key: `day-${i}`, 
                type: 'day', 
                day: i, 
                dateObj: new Date(year, month, i),
                tareas: tareasPorDia[i] || [],
                isCurrentDay
            });
        }
        return days;
    }, [allTareas, year, month]);

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6">Calendario de Vencimientos</h2>
            
            <div className="flex justify-between items-center mb-4 bg-slate-800 p-4 rounded-lg shadow-lg">
                <button onClick={() => setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() - 1)))} className="text-teal-400 p-2 rounded-lg hover:bg-slate-700">
                    <ion-icon name="chevron-back-outline" className="text-2xl"></ion-icon>
                </button>
                <h3 className="text-xl sm:text-2xl font-semibold text-white text-center">
                    {currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() + 1)))} className="text-teal-400 p-2 rounded-lg hover:bg-slate-700">
                    <ion-icon name="chevron-forward-outline" className="text-2xl"></ion-icon>
                </button>
            </div>

            <div className="bg-slate-800 p-2 sm:p-4 rounded-lg shadow-xl overflow-x-auto">
                <div className="grid grid-cols-7 min-w-[30rem] sm:min-w-full">
                    {weekDays.map(day => (
                        <div key={day} className="text-center font-bold text-xs text-gray-400 py-2 uppercase">
                            <span className="hidden sm:inline">{day}</span>
                            <span className="sm:hidden">{day.slice(0,1)}</span>
                        </div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1 min-w-[30rem] sm:min-w-full">
                    {calendarData.map(dayInfo => (
                        <div key={dayInfo.key} className={`h-32 rounded-md p-2 overflow-hidden ${dayInfo.type === 'empty' ? 'bg-slate-800' : 'bg-slate-700 border border-slate-600'} ${dayInfo.isCurrentDay ? 'bg-yellow-400 border-2 border-yellow-500' : ''}`}>
                            {dayInfo.type === 'day' && (
                                <div 
                                    onClick={() => onOpenDailyAgenda(dayInfo.dateObj, dayInfo.tareas)} 
                                    className="w-full h-full text-left cursor-pointer"
                                >
                                    <span className={`font-bold text-sm ${dayInfo.isCurrentDay ? 'text-slate-900' : 'text-white'} block`}>{dayInfo.day}</span>
                                    <div className="mt-1 space-y-1 overflow-y-auto max-h-24">
                                        {dayInfo.tareas.map(tarea => (
                                            <button 
                                                key={tarea.id}
                                                onClick={(e) => { e.stopPropagation(); onOpenTaskModal(tarea.id, true); }} 
                                                className="p-1 bg-slate-900 rounded text-xs truncate w-full text-left transition flex items-center hover:bg-slate-600"
                                                title={`${tarea.titulo} (${allEmpresas.find(e => e.id === tarea.empresa_id)?.nombre_legal})`}
                                            >
                                                <span 
                                                    style={{ backgroundColor: getEmpresaColor(tarea.empresa_id, allEmpresas) }} 
                                                    className="w-2 h-2 rounded-full inline-block mr-1 flex-shrink-0"></span>
                                                <span className="text-gray-300 truncate">{tarea.titulo}</span>
                                                {tarea.hora_vencimiento && <ion-icon name="time-outline" className="text-yellow-400 ml-1 flex-shrink-0"></ion-icon>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            
        </div>
    );
};

const LeadsPage = ({ allLeads, updateLeads, allInteraccionesLeads, updateInteraccionesLeads, responsableId, onOpenNewLeadModal, onViewLead, auxiliaryUsers }) => {
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroFase, setFiltroFase] = useState('Todos'); 
    
    const leadsFiltrados = useMemo(() => {
        return allLeads.filter(lead => {
            const matchNombre = lead.nombre_empresa.toLowerCase().includes(filtroNombre.toLowerCase());
            const matchFase = filtroFase === 'Todos' || lead.pipeline_fase === filtroFase;
            return matchNombre && matchFase;
        });
    }, [allLeads, filtroNombre, filtroFase]);

    const fasesPipeline = ['Todos', 'Contacto Inicial', 'Propuesta Enviada', 'Negociación', 'Ganado', 'Perdido'];

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Gestión de Leads (CRM)</h2>
                <ActionButton icon="call-outline" text="Nuevo Lead" color="orange" onClick={onOpenNewLeadModal} />
            </div>

            <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl font-semibold text-teal-400 mb-4">Pipeline de Ventas</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input type="text" placeholder="Filtrar por Empresa..." className="input-form" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
                    <select className="input-form" value={filtroFase} onChange={(e) => setFiltroFase(e.target.value)}>
                        {fasesPipeline.map(fase => <option key={fase} value={fase}>{fase}</option>)}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-left">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-3 text-sm font-semibold text-gray-400">Empresa</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Fase</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Ciudad</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Próx. Seguimiento</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leadsFiltrados.length === 0 ? (
                                <tr><td colSpan="5" className="p-3 text-center text-gray-500">No hay leads registrados.</td></tr>
                            ) : (
                                leadsFiltrados.map(lead => (
                                    <tr key={lead.id} className="border-b border-slate-700 hover:bg-slate-700">
                                        <td className="p-3 font-medium text-white">{lead.nombre_empresa}</td>
                                        <td className="p-3">
                                            <span className={`text-xs font-bold py-1 px-2 rounded-full ${lead.pipeline_fase === 'Propuesta Enviada' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-200'}`}>
                                                {lead.pipeline_fase}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-300">{lead.ciudad || 'N/A'}</td>
                                        <td className="p-3 text-red-400">{lead.proximo_seguimiento ? new Date(lead.proximo_seguimiento.replace(/-/g, '/')).toLocaleDateString('es-CO') : 'Sin Fecha'}</td>
                                        <td className="p-3">
                                            {/* FIX 1: Al hacer clic en "Ver Ficha", enviamos TRUE para activar el modo de visualización */}
                                            <button onClick={() => onViewLead(lead.id, true)} className="bg-teal-600 hover:bg-teal-700 text-white py-1 px-3 rounded-lg text-sm font-medium transition duration-200">
                                                Ver Ficha
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


/**
 * Componente: FinanzasPage
 */
const FinanzasPage = ({ allIngresos, allGastos, updateIngresos, updateGastos, allMesesCerrados, updateMesesCerrados, onOpenTransactionModal, onOpenTagModal, allTags, responsableId, auxiliaryUsers }) => {

    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [filterType, setFilterType] = useState('Todos');
    const [filterTag, setFilterTag] = useState('Todas');
    

    
    const tagOptions = ['Todas', ...allTags];

    // 1. Proyectar gastos futuros y recurrentes en un rango de dos años.
    const projectedGastos = useMemo(() => {
        const projectionStart = new Date(currentYear - 1, 0, 1);
        const projectionEnd = new Date(currentYear + 2, 11, 31);
        return projectRecurrences(allGastos, projectionStart, projectionEnd);
    }, [allGastos, currentYear]);


    // 2. Filtrar transacciones por el mes/año seleccionado (para el resumen y la tabla)
    const filteredTransacciones = useMemo(() => {
        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);

        const filteredIngresos = allIngresos.filter(i => {
            const date = new Date(i.fecha);
            return date >= startOfMonth && date <= endOfMonth;
        });

        const filteredGastos = projectedGastos.filter(g => {
            const date = new Date(g.fecha);
            return date >= startOfMonth && date <= endOfMonth;
        });

        return { filteredIngresos, filteredGastos };
    }, [allIngresos, projectedGastos, selectedMonth, selectedYear]);


    // 3. Cálculos del Resumen
    const { totalIngresos, totalGastos, beneficioNeto } = useMemo(() => {
        const totalIngresos = filteredTransacciones.filteredIngresos.reduce((sum, item) => sum + item.monto, 0);
        const totalGastos = filteredTransacciones.filteredGastos.reduce((sum, item) => sum + item.monto, 0);
        return { totalIngresos, totalGastos, beneficioNeto: totalIngresos - totalGastos };
    }, [filteredTransacciones]);


    // 4. Combinar y ordenar para la tabla + aplicar filtros adicionales
    const allTransacciones = useMemo(() => {
        let ingresos = filteredTransacciones.filteredIngresos.map(t => ({ ...t, type: 'Ingreso', color: 'text-green-400' }));
        let gastos = filteredTransacciones.filteredGastos.map(t => ({ ...t, type: 'Gasto', color: 'text-red-400' }));
        
        let combined = [...ingresos, ...gastos];
        
        if (filterType !== 'Todos') {
            combined = combined.filter(t => t.type === filterType);
        }
        
        if (filterTag !== 'Todas') {
            combined = combined.filter(t => t.etiqueta === filterTag);
        }

        return combined.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }, [filteredTransacciones, filterType, filterTag]);


    const monthOptions = getMonthOptions();
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
    







    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center">
                <ion-icon name="wallet-outline" className="mr-3 text-2xl"></ion-icon> Control de Finanzas Personales
            </h2>

            {/* Selectores de Mes y Año */}
            <div className="flex space-x-4 mb-4 bg-slate-800 p-4 rounded-lg shadow-md">
                <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))} 
                    className="input-form bg-slate-700 p-3 w-1/3"
                >
                    {monthOptions.map((name, index) => (
                        <option key={index} value={index}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
                    ))}
                </select>
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))} 
                    className="input-form bg-slate-700 p-3 w-1/3"
                >
                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </select>

            </div>
            


            {/* 1. Resumen Financiero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <SummaryCard title="Ingresos Totales" value={totalIngresos} color="bg-green-600" icon="arrow-up-circle-outline" />
                <SummaryCard title="Gastos Totales" value={totalGastos} color="bg-red-600" icon="arrow-down-circle-outline" />
                <SummaryCard title="Beneficio Neto" value={beneficioNeto} color={beneficioNeto >= 0 ? "bg-teal-600" : "bg-orange-600"} icon="stats-chart-outline" />
            </div>

            {/* 2. Botones de Acción */}
            <div className="flex space-x-4 mb-6">
                <ActionButton icon="add-circle-outline" text="Registrar Ingreso" color="green" onClick={() => onOpenTransactionModal('ingreso')} />
                <ActionButton icon="remove-circle-outline" text="Registrar Gasto" color="red" onClick={() => onOpenTransactionModal('gasto')} />
                <ActionButton icon="pricetags-outline" text="Gestionar Etiquetas" color="purple" onClick={onOpenTagModal} />
            </div>

            {/* 3. Historial de Transacciones */}
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl font-semibold text-teal-400 mb-4">Historial de Transacciones</h3>
                
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-left">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-3 text-sm font-semibold text-gray-400">
                                    <select className="bg-slate-700 text-gray-400" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                        <option value="Todos">Tipo</option>
                                        <option value="Ingreso">Ingreso</option>
                                        <option value="Gasto">Gasto</option>
                                    </select>
                                </th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Fecha</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Concepto</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">
                                    <select className="bg-slate-700 text-gray-400" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
                                        {tagOptions.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                                    </select>
                                </th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Responsable</th>
                                <th className="p-3 text-sm font-semibold text-gray-400 text-right">Monto</th>
                                <th className="p-3 text-sm font-semibold text-gray-400 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allTransacciones.length === 0 ? (
                                <tr><td colSpan="6" className="p-3 text-center text-gray-500">No hay transacciones registradas para este periodo.</td></tr>
                            ) : (
                                allTransacciones.map(t => (
                                    <tr key={t.id} className="border-b border-slate-700 hover:bg-slate-700">
                                        <td className={`p-3 font-medium ${t.type === 'Ingreso' ? 'text-green-400' : 'text-red-400'}`}>{t.type}</td>
                                        <td className="p-3 text-gray-300">{new Date(t.fecha).toLocaleDateString('es-CO')}</td>
                                        <td className="p-3 text-white">{t.concepto}</td>
                                        <td className="p-3 text-gray-300 capitalize">{t.etiqueta || 'N/A'}</td>
                                        <td className="p-3 text-gray-400">{getResponsableName(t.responsable_id, auxiliaryUsers)}</td>
                                        <td className={`p-3 font-bold text-right ${t.type === 'Ingreso' ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(t.monto)}</td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => onOpenTransactionModal(t.type.toLowerCase(), t)} 
                                                className="text-blue-400 hover:text-blue-300 p-1"
                                            >
                                                <ion-icon name="create-outline"></ion-icon>
                                            </button>
                                            <button onClick={() => {
                                                if (window.confirm(`¿Estás seguro de eliminar "${t.concepto}"?`)) {
                                                    if (t.type === 'Ingreso') {
                                                        updateIngresos({ id: t.id });
                                                    } else {
                                                        const idToDelete = t.original_id || t.id;
                                                        updateGastos({ id: idToDelete });
                                                    }
                                                }
                                            }} 
                                            className="text-red-400 hover:text-red-300 p-1"
                                            >
                                                <ion-icon name="trash-outline"></ion-icon>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Componente para las tarjetas de resumen financiero
const SummaryCard = ({ title, value, color, icon }) => (
    <div className={`p-5 rounded-lg shadow-xl text-white ${color}`}>
        <div className="flex justify-between items-center">
            <h4 className="text-lg font-medium">{title}</h4>
            <ion-icon name={icon} className="text-3xl"></ion-icon>
        </div>
        <p className="text-3xl font-bold mt-2">{formatCurrency(value)}</p>
    </div>
);


/**
 * NUEVO COMPONENTE: CompletedTasksHistory (Historial de completadas)
 */
const CompletedTasksHistory = ({ completedTasks, allEmpresas, auxiliaryUsers }) => {
    const [filtroTitulo, setFiltroTitulo] = useState('');
    const [filtroCliente, setFiltroCliente] = useState('Todos');

    const clientesOptions = useMemo(() => {
        const ids = [...new Set(completedTasks.map(t => t.empresa_id))];
        return ['Todos', ...ids.map(id => allEmpresas.find(e => e.id === id)?.nombre_legal || 'N/A')];
    }, [completedTasks, allEmpresas]);

    const filteredHistory = useMemo(() => {
        return completedTasks.filter(t => {
            const matchTitulo = t.titulo.toLowerCase().includes(filtroTitulo.toLowerCase());
            const matchCliente = filtroCliente === 'Todos' || t.empresa?.nombre_legal === filtroCliente;
            return matchTitulo && matchCliente;
        }).sort((a, b) => new Date(b.fecha_completada) - new Date(a.fecha_completada));
    }, [completedTasks, filtroTitulo, filtroCliente]);

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl mt-6">
            <h3 className="text-xl font-semibold text-teal-400 mb-4">Historial de Tareas Completadas (Días Anteriores)</h3>
            
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="p-3 text-sm font-semibold text-gray-400">
                                <input type="text" placeholder="Filtrar Título" className="bg-slate-700 text-gray-200 p-1 w-full rounded" value={filtroTitulo} onChange={(e) => setFiltroTitulo(e.target.value)} />
                            </th>
                            <th className="p-3 text-sm font-semibold text-gray-400">
                                <select className="bg-slate-700 text-gray-200 p-1 w-full rounded" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
                                    {clientesOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </th>
                            <th className="p-3 text-sm font-semibold text-gray-400">Completada</th>
                            <th className="p-3 text-sm font-semibold text-gray-400">Vencimiento</th>
                            <th className="p-3 text-sm font-semibold text-gray-400">Responsable</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredHistory.length === 0 ? (
                            <tr><td colSpan="5" className="p-3 text-center text-gray-500">No hay historial de tareas completadas.</td></tr>
                        ) : (
                            filteredHistory.map(t => (
                                <tr key={t.id} className="border-b border-slate-700 hover:bg-slate-700">
                                    <td className="p-3 font-medium text-white">{t.titulo}</td>
                                    <td className="p-3 text-gray-300" style={{ color: t.empresa?.color_hex }}>{t.empresa?.nombre_legal || 'N/A'}</td>
                                    <td className="p-3 text-green-400">{new Date(t.fecha_completada).toLocaleDateString('es-CO')}</td>
                                    <td className="p-3 text-red-400">{new Date(t.fecha_vencimiento).toLocaleDateString('es-CO')}</td>
                                    <td className="p-3 text-gray-400">{getResponsableName(t.responsable_id, auxiliaryUsers)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


/**
 * NUEVO COMPONENTE: DailyTaskBoard (Tablero Kanban Simple)
 */
const DailyTaskBoard = ({ allTareas, allEmpresas, updateTareas, onOpenTaskModal, auxiliaryUsers }) => {
    
    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

    const moveToNextState = (tarea) => {
        let nextState = 'Pendiente';
        if (tarea.estado === 'Pendiente') nextState = 'En Proceso';
        else if (tarea.estado === 'En Proceso') nextState = 'Completada';
        else return;
        
        const { empresa, ...taskData } = tarea;
        updateTareas({ 
            ...taskData, 
            estado: nextState, 
            fecha_completada: nextState === 'Completada' ? new Date() : tarea.fecha_completada 
        });
    };

    const tasksByState = useMemo(() => {
        const boardTasks = allTareas
            .map(t => ({
                ...t,
                empresa: allEmpresas.find(e => e.id === t.empresa_id)
            }))
            .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
            
        // 3. Tareas Completadas HOY y Tareas Completadas ANTERIORES
        const completedToday = [];
        const completedHistory = [];

        boardTasks.filter(t => t.estado === 'Completada' && t.fecha_completada).forEach(t => {
            if (isSameDay(t.fecha_completada, today)) {
                completedToday.push(t);
            } else {
                completedHistory.push(t);
            }
        });

        return {
            'Pendiente': boardTasks.filter(t => t.estado === 'Pendiente'),
            'En Proceso': boardTasks.filter(t => t.estado === 'En Proceso'),
            'Completada Hoy': completedToday,
            'Historial Completo': completedHistory,
        };
    }, [allTareas, allEmpresas, today]);

    const statusColumns = ['Pendiente', 'En Proceso', 'Completada Hoy'];

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center">
                    <ion-icon name="checkbox-outline" className="mr-3 text-2xl"></ion-icon>
                    Tablero Diario de Tareas (Kanban)
                </h2>
                 {/* MODIFICADO: Botón de crear tarea en el módulo Kanban */}
                <ActionButton icon="add-circle-outline" text="Nueva Tarea" color="green" onClick={() => onOpenTaskModal(null, false)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statusColumns.map(status => (
                    <div key={status} className="bg-slate-800 p-4 rounded-lg shadow-xl h-full flex flex-col">
                        <h3 className={`text-xl font-semibold mb-4 ${status === 'Pendiente' ? 'text-yellow-400' : status === 'En Proceso' ? 'text-blue-400' : 'text-green-400'}`}>
                            {status} ({tasksByState[status].length})
                        </h3>
                        
                        <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                            {tasksByState[status].map(tarea => (
                                <div 
                                    key={tarea.id} 
                                    className="p-3 bg-slate-700 rounded-lg shadow-md"
                                    style={{ borderLeft: `4px solid ${tarea.empresa?.color_hex || '#64748b'}` }}
                                >
                                    <h4 className="font-bold text-white text-md">{tarea.titulo}</h4>
                                    <p className="text-xs text-gray-400">Cliente: {tarea.empresa?.nombre_legal || 'N/A'}</p>
                                    <p className="text-xs text-red-400 mt-1">Vence: {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-CO')} {tarea.hora_vencimiento}</p>
                                    <p className="text-xs text-gray-500">Creado por: {getResponsableName(tarea.responsable_id, auxiliaryUsers)}</p>
                                    
                                    {(status === 'Pendiente' || status === 'En Proceso') && (
                                        <button 
                                            onClick={() => moveToNextState(tarea)}
                                            className={`mt-2 w-full py-1 text-xs font-semibold rounded transition duration-200 ${status === 'Pendiente' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                                        >
                                            {status === 'Pendiente' ? 'Mover a En Proceso' : 'Marcar como Completada'}
                                        </button>
                                    )}
                                </div>
                            ))}
                            {tasksByState[status].length === 0 && <p className="text-gray-500 text-sm">No hay tareas en esta fase.</p>}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Historial de Tareas Completadas (Días Anteriores) */}
            <CompletedTasksHistory completedTasks={tasksByState['Historial Completo']} allEmpresas={allEmpresas} auxiliaryUsers={auxiliaryUsers} />
        </div>
    );
};

const UserManagementPage = ({ auxiliaryUsers, updateAuxiliaryUsers, allEmpresas }) => {
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    const openUserModal = (user = null) => {
        // TODO: Reemplazar con autenticación real de Supabase
        alert("La gestión de usuarios ahora se hace desde el panel de Supabase (Authentication > Users). Esta sección es solo de consulta.");
        return;
        setCurrentUser(user);
        setIsEditing(!!user);
        setIsUserModalOpen(true);
    };

    const handleCreateUser = (newUser) => {
        // Simular creación con un ID nuevo
        const newUserId = `aux${Date.now()}`;
        updateAuxiliaryUsers({ ...newUser, id: newUserId });
    };

    const handleUpdateUser = (updatedUser) => {
        updateAuxiliaryUsers(updatedUser);
    };

    const handleDeleteUser = (userId) => {
        if (window.confirm("¿Estás seguro de eliminar este usuario?")) {
            // FIX 3: Llamar a updateAuxiliaryUsers con solo el ID para activar la lógica de eliminación en useMockData
            // La convención es pasar un objeto con solo la clave 'id'.
            updateAuxiliaryUsers({ id: userId });
        }
    };

    const UserModal = ({ isOpen, onClose, user, isEditing, onSubmit }) => {
        const [nombre, setNombre] = useState(user?.nombre || '');
        const [password, setPassword] = useState(user?.password || '');
        
        const handleSubmit = (e) => {
            e.preventDefault();
            if (nombre.trim() && password.trim()) {
                onSubmit({ id: user?.id, nombre, password });
                onClose();
            } else {
                alert("Nombre y Contraseña son obligatorios.");
            }
        };

        return (
            <div className={`fixed inset-0 bg-black/70 justify-center items-center p-4 z-50 ${isOpen ? 'flex' : 'hidden'}`}>
                <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-sm animate-fade-in">
                    <h3 className="text-2xl font-bold text-white mb-4">{isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario Auxiliar'}</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nombre" className="input-form bg-slate-700 p-3" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                        <input type="text" placeholder="Contraseña de Ingreso" className="input-form bg-slate-700 p-3" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">Cancelar</button>
                        <button type="submit" className="btn-accion bg-blue-600 hover:bg-blue-700 px-4 py-2">{isEditing ? 'Guardar Cambios' : 'Crear Usuario'}</button>
                    </div>
                </form>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Gestión de Usuarios Auxiliares</h2>
                <ActionButton icon="person-add-outline" text="Nuevo Usuario" color="blue" onClick={() => openUserModal(null)} />
            </div>

            <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl font-semibold text-teal-400 mb-4">Lista de Usuarios</h3>
                
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-left">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-3 text-sm font-semibold text-gray-400">Nombre Completo</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">ID de Usuario</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Rol</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Filas de Usuarios Auxiliares */}
                            {auxiliaryUsers?.map(user => (
                                <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-700">
                                    <td className="p-3 font-medium text-white">{user.nombre_completo}</td>
                                    <td className="p-3 text-gray-300">{user.id}</td>
                                    <td className="p-3 text-yellow-400">{user.rol}</td>
                                    <td className="p-3 space-x-2">
                                        <button onClick={() => openUserModal(user)} className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg text-sm transition duration-200 disabled:opacity-50" disabled>
                                            Editar
                                        </button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-lg text-sm transition duration-200 disabled:opacity-50" disabled>
                                            Borrar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isUserModalOpen && (
                <UserModal
                    isOpen={isUserModalOpen}
                    onClose={() => setIsUserModalOpen(false)}
                    user={currentUser}
                    isEditing={isEditing}
                    onSubmit={isEditing ? handleUpdateUser : handleCreateUser}
                />
            )}
        </div>
    );
};


// =============================================================================
// 6. COMPONENTE PRINCIPAL (APP)
// =============================================================================

function App() {
    const [session, setSession] = useState(null);
    const [page, setPage] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [selectedEmpresaId, setSelectedEmpresaId] = useState(null); // ADDED
    const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false); // ADDED
    const [selectedTaskId, setSelectedTaskId] = useState(null); // ADDED
    const [selectedEmpresaIdForNewTask, setSelectedEmpresaIdForNewTask] = useState(null); // ADDED
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false); // ADDED
    
    // ESTADOS PARA LOS DATOS
    const [allEmpresas, setAllEmpresas] = useState([]);
    const [allTareas, setAllTareas] = useState([]);
    const [allNotas, setAllNotas] = useState([]);
    const [allComentarios, setAllComentarios] = useState([]);
    const [allLeads, setAllLeads] = useState([]);
    const [allInteraccionesLeads, setAllInteraccionesLeads] = useState([]);
    const [allDocumentos, setAllDocumentos] = useState([]);
    const [allTransacciones, setAllTransacciones] = useState([]);
    const [allMesesCerrados, setAllMesesCerrados] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [auxiliaryUsers, setAuxiliaryUsers] = useState([]);

    // --- GESTIÓN DE SESIÓN DE SUPABASE ---
    useEffect(() => {
        // 1. Obtenemos la sesión activa al cargar el componente
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                setPage('dashboard');
            }
        });

        // 2. Escuchamos cambios en el estado de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                setPage('dashboard');
            } else {
                setPage(null); // Si no hay sesión, va al login
                setSelectedEmpresaId(null); // Corrected: Now refers to the declared state setter
            }
        });

        // 3. Limpiamos la suscripción al desmontar el componente
        return () => subscription.unsubscribe();
    }, []);


    // Las funciones de 'update' ahora necesitarán lógica para llamar a Supabase
    const updateEmpresas = async (clientData) => {
        if (clientData.id) {
            // --- LÓGICA DE ACTUALIZACIÓN ---
            const { data, error } = await supabase
                .from('empresas')
                .update(clientData)
                .eq('id', clientData.id)
                .select();

            if (error) {
                console.error('Error actualizando empresa:', error);
                alert(`Error actualizando empresa: ${error.message}`);
            } else if (data) {
                setAllEmpresas(prev => prev.map(e => e.id === clientData.id ? data[0] : e));
            }
        } else {
            // --- LÓGICA DE CREACIÓN ---
            const { data: existing } = await supabase.from('empresas').select('nit').eq('nit', clientData.nit).single();
            if (existing) {
                alert(`Error: El NIT "${clientData.nit}" ya está registrado.`);
                return;
            }
            const { id, ...newClientData } = clientData;
            const { data, error } = await supabase.from('empresas').insert(newClientData).select();
            if (error) {
                console.error('Error creando empresa:', error);
                alert(`Error creando empresa: ${error.message}`);
            } else if (data) {
                setAllEmpresas(prev => [...prev, data[0]]);
            }
        }
    };

    const handleMutation = async (tableName, data, stateSetter) => {
        // Check if it's a projected item
        if (data.isProjected) {
            if (Object.keys(data).length === 1 && data.id) { // Delete operation for projected item
                stateSetter(prev => prev.filter(item => item.id !== data.id));
            } else if (data.id) { // Update operation for projected item
                stateSetter(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item));
            }
            // For projected items, we don't interact with Supabase, so we return here.
            return;
        }

        let response;
        if (data.id && Object.keys(data).length > 1) {
            response = await supabase.from(tableName).update(data).eq('id', data.id).select();
            if (!response.error && response.data && response.data.length > 0) {
                stateSetter(prev => prev.map(item => item.id === data.id ? response.data[0] : item));
            }
        } else if (data.id && Object.keys(data).length === 1) {
            response = await supabase.from(tableName).delete().eq('id', data.id);
            if (!response.error) stateSetter(prev => prev.filter(item => item.id !== data.id));
        } else {
            const { id, ...insertData } = data;
            response = await supabase.from(tableName).insert(insertData).select();
            if (!response.error && response.data && response.data.length > 0) {
                stateSetter(prev => [...prev, response.data[0]]);
            }
        }

        if (response.error) {
            console.error(`Error en tabla '${tableName}':`, response.error);
            alert(`Error en '${tableName}': ${response.error.message}`);
        }
    };

    const updateTareas = async (data) => {
        // FIX: Al crear una tarea, usar el ID de usuario real de Supabase para evitar el error de UUID inválido.
        if (!data.id) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                data.responsable_id = user.id;
            }
        }
        handleMutation('tareas', data, setAllTareas);
    };
    const updateNotas = (data) => handleMutation('notas', data, setAllNotas);
    const updateComentarios = (data) => handleMutation('comentarios', data, setAllComentarios);
    const updateLeads = (data) => handleMutation('leads', data, setAllLeads);
    const updateInteraccionesLeads = (data) => handleMutation('interacciones_leads', data, setAllInteraccionesLeads);
    const updateDocumentos = (data) => handleMutation('documentos', data, setAllDocumentos);
    const updateTransacciones = (data) => handleMutation('transacciones', data, setAllTransacciones);
    
    const updateMesesCerrados = async (action) => {
        if (action.type === 'ADD') {
            const { error } = await supabase.from('meses_cerrados').insert({ id: action.monthKey });
            if (error) {
                alert(`Error cerrando el mes: ${error.message}`);
            } else {
                setAllMesesCerrados(prev => [...prev, action.monthKey]);
            }
        } else if (action.type === 'DELETE') {
            const { error } = await supabase.from('meses_cerrados').delete().eq('id', action.monthKey);
            if (error) {
                alert(`Error reabriendo el mes: ${error.message}`);
            } else {
                setAllMesesCerrados(prev => prev.filter(m => m !== action.monthKey));
            }
        }
    };

    const updateTags = async (action) => {
        if (action.type === 'ADD') {
            const { data, error } = await supabase.from('etiquetas_finanzas').insert({ nombre: action.tag }).select();
            if (error) {
                console.error('Error creando etiqueta:', error);
                alert(`Error creando etiqueta: ${error.message}`);
            } else if (data) {
                setAllTags(prev => [...prev, data[0].nombre].sort());
            }
        } else if (action.type === 'DELETE') {
            const { error } = await supabase.from('etiquetas_finanzas').delete().eq('nombre', action.tag);
            if (error) {
                console.error('Error eliminando etiqueta:', error);
                alert(`Error eliminando etiqueta: ${error.message}`);
            } else {
                setAllTags(prev => prev.filter(t => t !== action.tag));
            }
        } else if (action.type === 'EDIT') {
            const { error } = await supabase.from('etiquetas_finanzas').update({ nombre: action.newTag }).eq('nombre', action.oldTag);
            if (error) {
                console.error('Error editando etiqueta:', error);
                alert(`Error al editar: ${error.message}`);
            } else {
                setAllTags(prev => prev.map(t => t === action.oldTag ? action.newTag : t).sort());
            }
        }
    };
    const updateAuxiliaryUsers = (data) => {
        console.log('TODO: Actualizar usuario en Supabase', data);
        alert("La gestión de perfiles de usuario debe hacerse desde el panel de Supabase por seguridad.");
    };

    // Unificar ingresos y gastos para simplificar
    const allIngresos = useMemo(() => allTransacciones.filter(t => t.tipo_transaccion === 'Ingreso'), [allTransacciones]);
    const allGastos = useMemo(() => allTransacciones.filter(t => t.tipo_transaccion === 'Gasto'), [allTransacciones]);
    const updateIngresos = updateTransacciones;
    const updateGastos = updateTransacciones;

    // EFECTO PARA CARGAR DATOS DESDE SUPABASE
    useEffect(() => {
        const fetchInitialData = async () => {
            console.log("Cargando datos desde Supabase...");
            const { data: empresasData, error: empresasError } = await supabase.from('empresas').select('*');
            if (empresasError) console.error('Error cargando empresas:', empresasError); else setAllEmpresas(empresasData || []);

            const { data: tareasData, error: tareasError } = await supabase.from('tareas').select('*');
            if (tareasError) console.error('Error cargando tareas:', tareasError); else setAllTareas(tareasData || []);

            // --- COMPLETANDO LA CARGA DE DATOS ---
            const { data: notasData, error: notasError } = await supabase.from('notas').select('*');
            if (notasError) console.error('Error cargando notas:', notasError); else setAllNotas(notasData || []);

            const { data: comentariosData, error: comentariosError } = await supabase.from('comentarios').select('*');
            if (comentariosError) console.error('Error cargando comentarios:', comentariosError); else setAllComentarios(comentariosData || []);

            const { data: leadsData, error: leadsError } = await supabase.from('leads').select('*');
            if (leadsError) console.error('Error cargando leads:', leadsError); else setAllLeads(leadsData || []);

            const { data: interaccionesData, error: interaccionesError } = await supabase.from('interacciones_leads').select('*');
            if (interaccionesError) console.error('Error cargando interacciones:', interaccionesError); else setAllInteraccionesLeads(interaccionesData || []);

            const { data: documentosData, error: documentosError } = await supabase.from('documentos').select('*');
            if (documentosError) console.error('Error cargando documentos:', documentosError); else setAllDocumentos(documentosData || []);

            const { data: transaccionesData, error: transaccionesError } = await supabase.from('transacciones').select('*');
            if (transaccionesError) console.error('Error cargando transacciones:', transaccionesError); else setAllTransacciones(transaccionesData || []);

            const { data: perfilesData, error: perfilesError } = await supabase.from('perfiles').select('*');
            if (perfilesError) console.error('Error cargando perfiles (usuarios):', perfilesError); else setAuxiliaryUsers(perfilesData || []);

            const { data: etiquetasData, error: etiquetasError } = await supabase.from('etiquetas_finanzas').select('nombre');
            if (etiquetasError) console.error('Error cargando etiquetas:', etiquetasError);
            else setAllTags((etiquetasData || []).map(e => e.nombre).sort());
        };

        fetchInitialData();
    }, []);
    
    // ESTADO DE MODALES
    const [isClientModalOpen, setIsClientModalOpen] = useState(false); // NUEVO: Modal de Clientes
    const [clientModalContext, setClientModalContext] = useState({ empresa: null, isEditing: false });
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskModalContextId, setTaskModalContextId] = useState(null);
    const [isViewingTaskDetail, setIsViewingTaskDetail] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState(null);
    const [transactionToEdit, setTransactionToEdit] = useState(null);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    
    // ESTADO DEL CALENDARIO/AGENDA
    const [isDailyAgendaOpen, setIsDailyAgendaOpen] = useState(false);
    const [agendaDate, setAgendaDate] = useState(null);
    const [agendaTasks, setAgendaTasks] = useState([]);
    const [isConflictAlertOpen, setIsConflictAlertOpen] = useState(false); // NUEVO
    const [conflictTask, setConflictTask] = useState(null); // NUEVO
    const [currentDate, setCurrentDate] = useState(new Date());

    const handlePrevMonth = () => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // Lógica del Modal de Clientes
    const openClientModal = (empresa = null, isEditing = false) => {
        setClientModalContext({ empresa, isEditing });
        setIsClientModalOpen(true);
    };
    const closeClientModal = () => setIsClientModalOpen(false);

    // Lógica del Modal de Tareas/Leads
    const openTaskModal = (id, isViewMode = false) => {
        setTaskModalContextId(id);
        setIsViewingTaskDetail(isViewMode);
        setIsTaskModalOpen(true);
        if (isViewMode) { // ADDED: Open TaskDetailModal when in view mode
            setIsTaskDetailModalOpen(true);
        }
    };
    const closeTaskModal = () => {
        setIsTaskModalOpen(false);
        setTaskModalContextId(null);
        setIsViewingTaskDetail(false);
        setIsTaskDetailModalOpen(false); // ADDED
    };

    const handleOpenTaskModal = (empresaIdOrTaskId, isViewing = false) => {
        if (isViewing) {
            setSelectedTaskId(empresaIdOrTaskId);
            setIsTaskDetailModalOpen(true);
        } else {
            // Es para crear una nueva tarea para una empresa
            setSelectedEmpresaIdForNewTask(empresaIdOrTaskId);
            setIsNewTaskModalOpen(true);
        }
    };

    const handleOpenEditTaskModal = (task) => {
        if (isTaskDetailModalOpen) {
            setIsTaskDetailModalOpen(false);
        }
        setTaskToEdit(task);
        setIsEditTaskModalOpen(true);
    };
    
    // Lógica del Modal de Transacciones (Finanzas)
    const openTransactionModal = (type, transaction = null) => {
        setTransactionType(type);
        setTransactionToEdit(transaction);
        setIsTransactionModalOpen(true);
    };
    const closeTransactionModal = () => {
        setIsTransactionModalOpen(false);
        setTransactionType(null);
        setTransactionToEdit(null);
    };
    
    // Lógica del Modal de Etiquetas
    const openTagModal = () => setIsTagModalOpen(true);
    const closeTagModal = () => setIsTagModalOpen(false);

    // Lógica de Agenda Diaria (NUEVO)
    const openDailyAgenda = (dateObj, tasks) => {
        setAgendaDate(dateObj);
        setAgendaTasks(tasks);
        setIsDailyAgendaOpen(true);
    };
    const closeDailyAgenda = () => {
        setIsDailyAgendaOpen(false);
        setAgendaDate(null);
        setAgendaTasks([]);
    };

    // Lógica de Alerta de Conflicto (NUEVO)
    const openConflictModal = (task) => {
        setConflictTask(task);
        setIsConflictAlertOpen(true);
    };
    const closeConflictModal = () => {
        setIsConflictAlertOpen(false);
        setConflictTask(null);
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
        }
    };

    const navigateTo = (pageName) => {
        setPage(pageName);
        setSelectedEmpresaId(null);
    };
    
    const handleSelectEmpresa = (id) => {
        setSelectedEmpresaId(id);
        setPage('cliente-detalle');
    };
    
    // Tarea seleccionada (si estamos en modo "Ver Detalle" Y el ID es de Tarea)
    const selectedTask = useMemo(() => {
        if (isViewingTaskDetail && allTareas.some(t => t.id === taskModalContextId)) {
            return allTareas.find(t => t.id === taskModalContextId);
        }
        return null;
    }, [allTareas, isViewingTaskDetail, taskModalContextId]);
    
    // Lead seleccionado para detalle (si estamos en modo "Ver Detalle" Y el ID es de Lead)
    const selectedLead = useMemo(() => {
        if (isViewingTaskDetail && allLeads.some(l => l.id === taskModalContextId)) {
            return allLeads.find(l => l.id === taskModalContextId);
        }
        return null;
    }, [allLeads, isViewingTaskDetail, taskModalContextId]);


    // Muestra el Portal si no hay rol asignado
    if (!session) {
        return <LoginPortal />;
    }
    
    const renderPage = () => {
        if (selectedEmpresaId && page === 'cliente-detalle') {
            return (
                <ClienteDetallePage 
                    empresaId={selectedEmpresaId} 
                    onBack={() => navigateTo('clientes')}
                    allEmpresas={allEmpresas}
                    allTareas={allTareas}
                    allNotas={allNotas}
                    allDocumentos={allDocumentos}
                    updateTareas={updateTareas}
                    updateNotas={updateNotas}
                    onOpenTaskModal={openTaskModal}
                />
            );
        }

        switch (page) {
            case 'dashboard':
                return <DashboardPage allEmpresas={allEmpresas} allTareas={allTareas} onOpenTaskModal={openTaskModal} />;
            case 'clientes':
                return <ClientesPage allEmpresas={allEmpresas} onSelectEmpresa={handleSelectEmpresa} onOpenClientModal={openClientModal} />;
            case 'calendario':
                // MODIFICADO: Pasamos la función onOpenDailyAgenda
                return (
                    <CalendarioPage 
                        allEmpresas={allEmpresas} 
                        allTareas={allTareas} 
                        onOpenTaskModal={openTaskModal} 
                        onOpenDailyAgenda={openDailyAgenda}
                    />
                );
            case 'leads':
                return (
                    <LeadsPage 
                        allLeads={allLeads} 
                        updateLeads={updateLeads}
                        allInteraccionesLeads={allInteraccionesLeads}
                        updateInteraccionesLeads={updateInteraccionesLeads}
                        responsableId={session.user.id}
                        auxiliaryUsers={auxiliaryUsers}
                        onOpenNewLeadModal={() => openTaskModal(null, false)} // Función para abrir modal de CREACIÓN
                        onViewLead={openTaskModal} // Función para abrir modal de VISUALIZACIÓN
                    />
                );
            case 'finanzas':
                return (
                    <FinanzasPage 
                        allIngresos={allIngresos}
                        allGastos={allGastos}
                        updateIngresos={updateIngresos}
                        updateGastos={updateGastos}
                        allMesesCerrados={allMesesCerrados}
                        updateMesesCerrados={updateMesesCerrados}
                        onOpenTransactionModal={openTransactionModal}
                        onOpenTagModal={openTagModal} // NUEVO
                        allTags={allTags}
                        responsableId={session.user.id}
                        auxiliaryUsers={auxiliaryUsers}
                    />
                );
            case 'daily-board':
                 return (
                    <DailyTaskBoard
                        allTareas={allTareas}
                        allEmpresas={allEmpresas}
                        updateTareas={updateTareas}
                        onOpenTaskModal={openTaskModal} // Reutilizado para crear tareas desde Kanban
                    />
                );
            case 'users':
                return (
                    <UserManagementPage 
                        auxiliaryUsers={auxiliaryUsers} 
                        updateAuxiliaryUsers={updateAuxiliaryUsers}
                        allEmpresas={allEmpresas} // Puede ser útil para auditoría futura
                    />
                );
            default:
                return <DashboardPage allEmpresas={allEmpresas} allTareas={allTareas} onOpenTaskModal={openTaskModal} />;
        }
    };

    return (
        <div id="app-container" className="flex h-screen bg-slate-900 text-gray-200 font-sans">
            
            <Sidebar 
                currentPage={page} 
                onNavigate={navigateTo} 
                currentRole="admin" 
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <Header 
                    currentRole="admin" 
                    onLogout={handleLogout} 
                    adminId={session.user.id} 
                    allEmpresas={allEmpresas} 
                    auxiliaryUsers={auxiliaryUsers}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />
                
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-900 p-6 md:p-8">
                    {renderPage()}
                </main>
            </div>
            
            {/* Modal de CREACIÓN/EDICIÓN de Clientes */}
            <NewClientModal
                isOpen={isClientModalOpen}
                onClose={closeClientModal}
                updateEmpresas={updateEmpresas}
                isEditing={clientModalContext.isEditing}
                currentEmpresa={clientModalContext.empresa}
            />

            {/* Modal de CREACIÓN de Tareas */}
                        {(isTaskModalOpen && !isViewingTaskDetail && page !== 'leads') && (
                            <NewTaskModal
                                isOpen={isTaskModalOpen}
                                onClose={closeTaskModal}
                                allEmpresas={allEmpresas}
                                currentEmpresaId={taskModalContextId}
                                updateTareas={updateTareas}
                                responsableId={session.user.id}
                                allTareas={allTareas} // Para chequear conflictos
                                onOpenConflictModal={openConflictModal} // Para abrir alerta
                            />
                        )}
                        {/* Modal de EDICIÓN de Tareas */}
                        <NewTaskModal
                            isOpen={isEditTaskModalOpen}
                            onClose={() => setIsEditTaskModalOpen(false)}
                            allEmpresas={allEmpresas}
                            updateTareas={updateTareas}
                            responsableId={session?.user?.id}
                            allTareas={allTareas}
                            onOpenConflictModal={openConflictModal}
                            isEditing={true}
                            currentTask={taskToEdit}
                        />            
            {/* Modal de CREACIÓN de Leads */}
            {(isTaskModalOpen && !isViewingTaskDetail && page === 'leads') && (
                <NewLeadModal 
                    isOpen={isTaskModalOpen}
                    onClose={closeTaskModal}
                    updateLeads={updateLeads}
                />
            )}

            {/* Modal de VISUALIZACIÓN (Detalle/Comentarios de TAREA) */}
                        <TaskDetailModal
                            isOpen={isTaskDetailModalOpen}
                            onClose={() => setIsTaskDetailModalOpen(false)}
                            task={selectedTask}
                            empresas={allEmpresas}
                            allComentarios={allComentarios}
                            updateComentarios={updateComentarios}
                            responsableId={session.user.id}
                            auxiliaryUsers={auxiliaryUsers}
                            onEditTask={() => handleOpenEditTaskModal(selectedTask)}
                        />            
             {/* Modal de VISUALIZACIÓN (Detalle de LEAD) */}
            {isViewingTaskDetail && selectedLead && (
                <LeadDetailModal 
                    isOpen={isTaskModalOpen}
                    onClose={closeTaskModal}
                    lead={selectedLead}
                    allInteraccionesLeads={allInteraccionesLeads}
                    updateInteraccionesLeads={updateInteraccionesLeads}
                    responsableId={session.user.id}
                    auxiliaryUsers={auxiliaryUsers}
                />
            )}
            
            {/* Modal de Registro de Ingresos/Gastos */}
            <NewTransactionModal
                isOpen={isTransactionModalOpen}
                onClose={closeTransactionModal}
                updateData={transactionType === 'ingreso' ? updateIngresos : updateGastos}
                type={transactionType}
                allTags={allTags}
                responsableId={session.user.id}
                initialData={transactionToEdit}
            />
            
            {/* Modal de Gestión de Etiquetas */}
            <TagManagementModal
                isOpen={isTagModalOpen}
                onClose={closeTagModal}
                allTags={allTags}
                updateTags={updateTags}
            />
            
            {/* Modal de Agenda Diaria */}
            <DailyAgendaModal
                isOpen={isDailyAgendaOpen}
                onClose={closeDailyAgenda}
                selectedDate={agendaDate}
                tasksForDay={agendaTasks}
                empresas={allEmpresas}
                onOpenTaskModal={openTaskModal}
            />

            {/* Modal de Alerta de Conflicto */}
            <ConflictAlertModal
                isOpen={isConflictAlertOpen}
                onClose={closeConflictModal}
                conflictTask={conflictTask}
                empresas={allEmpresas}
                onOpenTaskModal={openTaskModal} // Para ver la cita conflictiva
            />

        </div>
    );
}

// -----------------------------------------------------------------------------
// UTILIDAD FUERA DEL COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
const ActionButton = ({ icon, text, color, className = '', small = false, onClick, disabled = false }) => {
    const colorClasses = {
        green: 'bg-green-600 hover:bg-green-700',
        red: 'bg-red-600 hover:bg-red-700',
        blue: 'bg-blue-600 hover:bg-blue-700',
        purple: 'bg-purple-600 hover:bg-purple-700',
        orange: 'bg-orange-500 hover:bg-orange-600',
        teal: 'bg-teal-600 hover:bg-teal-700'
    };
    const sizeClasses = small ? 'py-2 px-3 text-sm' : 'py-3 px-4';
    
    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center justify-center text-white font-bold rounded-lg shadow-lg transition duration-200 transform ${colorClasses[color] || colorClasses.blue} ${sizeClasses} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
        >
            <ion-icon name={icon} className="text-xl mr-2"></ion-icon>
            <span className="text-sm">{text}</span>
        </button>
    );
};

export default App;