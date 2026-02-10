import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Users,
  Package,
  Building2,
  BarChart3,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  Check,
  AlertCircle,
  Lock,
  Mail,
  Phone,
  User,
  Hash,
  DollarSign,
  Grid,
  ShoppingBag,
} from 'lucide-react';

export function AdminPanel({ users, setUsers, clients, setClients, products, setProducts, onBack, tickets }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notification, setNotification] = useState(null);
  const [keepaliveRecords, setKeepaliveRecords] = useState<any[]>([]);
  const [pqrConfig, setPqrConfig] = useState({ prefix: 'PQR', next_number: 1 });
  const [editingPqrConfig, setEditingPqrConfig] = useState({ prefix: 'PQR', next_number: 1 });
  const [showPqrConfigForm, setShowPqrConfigForm] = useState(false);

  // Users Management
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'Vendedor',
    department: '',
    password: '',
    showPassword: false,
  });

  // Products Management
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    sku: '',
    clientIds: [],
  });

  // Clients Management
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({
    id: '',
    name: '',
    razonSocial: '',
    sucursal: '',
    contacto: '',
    cargo: '',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
  });

  // Cargar registros de keep-alive
  useEffect(() => {
    const loadKeepaliveRecords = async () => {
      try {
        const { data, error } = await supabase
          .from('keepalive_heartbeat')
          .select('*')
          .order('sequence_number', { ascending: false })
          .limit(20);
        
        if (!error && data) {
          setKeepaliveRecords(data);
        }
      } catch (err) {
        console.warn('No se pudo cargar keep-alive (tabla no existe aún):', err);
      }
    };
    
    loadKeepaliveRecords();
    
    // Recargar cada 60 segundos
    const interval = setInterval(loadKeepaliveRecords, 60000);
    return () => clearInterval(interval);
  }, []);

  // Cargar configuración de PQR
  useEffect(() => {
    const loadPqrConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('pqr_config')
          .select('prefix, next_number')
          .eq('id', 1)
          .single();
        
        if (!error && data) {
          setPqrConfig(data);
          setEditingPqrConfig(data);
        }
      } catch (err) {
        console.warn('No se pudo cargar PQR config (tabla no existe aún):', err);
      }
    };
    
    loadPqrConfig();
  }, []);

  const handleSavePqrConfig = async () => {
    try {
      const { error } = await supabase
        .from('pqr_config')
        .update({ 
          prefix: editingPqrConfig.prefix, 
          next_number: editingPqrConfig.next_number,
          last_updated: new Date().toISOString()
        })
        .eq('id', 1);
      
      if (!error) {
        setPqrConfig(editingPqrConfig);
        showNotification('✅ Configuración PQR actualizada correctamente', 'success');
        setShowPqrConfigForm(false);
      } else {
        showNotification('❌ Error al actualizar configuración', 'error');
      }
    } catch (err) {
      console.error('Error guardando PQR config:', err);
      showNotification('❌ Error al guardar', 'error');
    }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Cargar usuarios desde Supabase
  const loadUsersFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('⚠️ Error al cargar usuarios desde Supabase:', error);
        showNotification('⚠️ Error al cargar usuarios', 'error');
        return;
      }

      if (data) {
        const normalizedUsers = data.map(u => ({
          id: u.id || '',
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role || 'Vendedor',
          department: u.department || '',
          password: u.password || '',
          whatsappPhone: u.whatsapp_phone || '',
          showPassword: false,
        }));
        setUsers(normalizedUsers);
        console.log(`✅ ${normalizedUsers.length} usuarios cargados desde Supabase`);
        showNotification(`✅ ${normalizedUsers.length} usuarios cargados`, 'success');
      }
    } catch (err) {
      console.warn('Error cargando usuarios desde Supabase:', err);
      showNotification('⚠️ Error al cargar usuarios', 'error');
    }
  };

  // Nota: la carga inicial de `users` se realiza a nivel de la App (QMSApp)

  // ===== USER MANAGEMENT =====
  const handleAddUser = () => {
    if (!userForm.name || !userForm.email || !userForm.password) {
      showNotification('Complete todos los campos requeridos', 'error');
      return;
    }

    if (editingUser) {
      // Update user - actualizar localmente primero
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { ...u, ...userForm, id: u.id }
          : u
      ));
      showNotification('Usuario actualizado correctamente', 'success');
      
      // Persistir en Supabase (no bloquea la UI)
      (async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .update({
              name: userForm.name,
              email: userForm.email,
              phone: userForm.phone,
              role: userForm.role,
              department: userForm.department,
              password: userForm.password,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingUser.id)
            .select()
            .single();

          if (error) {
            console.warn('⚠️ Error al actualizar usuario en Supabase:', error);
            showNotification('⚠️ Error al guardar cambios en servidor', 'error');
          } else if (data) {
            // reemplazar localmente con la fila del servidor
            const normalized = {
              id: data.id || data.user_id || editingUser.id,
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              role: data.role || 'Vendedor',
              department: data.department || '',
              password: data.password || '',
              whatsappPhone: data.whatsapp_phone || ''
            };
            setUsers(prev => prev.map(u => u.id === normalized.id ? normalized : u));
            console.log(`✅ Usuario ${normalized.id} actualizado en Supabase`);
          }
        } catch (err) {
          console.warn('Error persistiendo usuario en Supabase:', err);
          showNotification('⚠️ Error al sincronizar usuario', 'error');
        }
      })();
      
      setEditingUser(null);
    } else {
      // Create new user and persist to Supabase
      showNotification('Creando usuario...', 'success');
      (async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .insert({
              name: userForm.name,
              email: userForm.email,
              phone: userForm.phone,
              role: userForm.role,
              department: userForm.department,
              password: userForm.password,
              whatsapp_phone: userForm.whatsappPhone || null,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.warn('⚠️ Error al crear usuario en Supabase:', error);
            showNotification('⚠️ Error al crear usuario en servidor', 'error');
            // Fallback: añadir localmente para no bloquear la UX
            const fallback = { ...userForm, id: 'u' + (users.length + 1) };
            setUsers(prev => [...prev, fallback]);
          } else if (data) {
            const added = {
              id: data.id || (data.user_id || ('u' + (users.length + 1))),
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              role: data.role || 'Vendedor',
              department: data.department || '',
              password: data.password || '',
              whatsappPhone: data.whatsapp_phone || ''
            };
            setUsers(prev => [...prev, added]);
            showNotification('Usuario creado correctamente', 'success');
            console.log(`✅ Usuario ${added.id} creado en Supabase`);
          }
        } catch (err) {
          console.warn('Error persistiendo usuario en Supabase:', err);
          showNotification('⚠️ Error al crear usuario', 'error');
          const fallback = { ...userForm, id: 'u' + (users.length + 1) };
          setUsers(prev => [...prev, fallback]);
        }
      })();
    }

    setUserForm({
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'Vendedor',
      department: '',
      password: '',
      showPassword: false,
    });
    setShowUserForm(false);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    // Asegurar que todos los campos tengan valores (evitar undefined)
    setUserForm({
      id: user.id || '',
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'Vendedor',
      department: user.department || '',
      password: user.password || '',
      showPassword: false,
    });
    setShowUserForm(true);
  };

   const handleDeleteUser = (userId) => {
     if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
       setUsers(users.filter(u => u.id !== userId));
       showNotification('Usuario eliminado', 'success');
       (async () => {
         try {
           const { error } = await supabase
             .from('users')
             .delete()
             .eq('id', userId);
           if (error) console.warn('⚠️ Error al eliminar usuario en Supabase:', error);
           else console.log(`✅ Usuario eliminado en Supabase`);
         } catch (err) {
           console.warn('Error:', err);
         }
       })();
     }
   };

  // ===== PRODUCT MANAGEMENT =====
  const handleAddProduct = () => {
    if (!productForm.name) {
      showNotification('El nombre del producto es obligatorio', 'error');
      return;
    }

    if (editingProduct) {
      // Optimistic local update
      setProducts(products.map(p => 
        p.id === editingProduct.id 
          ? { ...p, ...productForm, id: p.id }
          : p
      ));
      showNotification('Producto actualizado', 'success');

      // Persistir en Supabase and sync returned row
      (async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .update({
              name: productForm.name,
              description: productForm.description,
              price: productForm.price ? parseFloat(productForm.price) : null,
              sku: productForm.sku,
              client_ids: productForm.clientIds && productForm.clientIds.length ? JSON.stringify(productForm.clientIds) : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingProduct.id)
            .select()
            .single();

          if (error) {
            console.warn('⚠️ Error al actualizar producto en Supabase:', error);
            showNotification('⚠️ Error al guardar en servidor', 'error');
          } else if (data) {
            // replace local with server row
            setProducts(prev => prev.map(p => p.id === data.id ? data : p));
            console.log(`✅ Producto ${data.id} actualizado en Supabase`);
          }
        } catch (err) {
          console.warn('Error persistiendo producto en Supabase:', err);
        }
      })();

      setEditingProduct(null);
    } else {
      // Create new product in Supabase and use DB id
      showNotification('Creando producto...', 'success');
      (async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .insert({
              product_id: productForm.product_id || `p${Date.now()}`,
              name: productForm.name,
              description: productForm.description,
              price: productForm.price ? parseFloat(productForm.price) : null,
              sku: productForm.sku,
              client_ids: productForm.clientIds && productForm.clientIds.length ? JSON.stringify(productForm.clientIds) : null,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.warn('⚠️ Error al crear producto en Supabase:', error);
            showNotification('⚠️ Error al guardar en servidor', 'error');
          } else if (data) {
            setProducts(prev => [...prev, data]);
            showNotification('Producto creado', 'success');
            console.log(`✅ Producto ${data.id} creado en Supabase`);
          }
        } catch (err) {
          console.warn('Error persistiendo producto en Supabase:', err);
          showNotification('⚠️ Error al guardar en servidor', 'error');
        }
      })();
    }

    setProductForm({ id: '', name: '', description: '', price: '', sku: '', clientIds: [] });
    setShowProductForm(false);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm(product);
    setShowProductForm(true);
  };

  const handleDeleteProduct = (productId) => {
    if (confirm('¿Eliminar este producto?')) {
      setProducts(products.filter(p => p.id !== productId));
      showNotification('Producto eliminado', 'success');
     // Persistir eliminación en Supabase
     (async () => {
       try {
         const { error } = await supabase
           .from('products')
           .delete()
           .eq('id', productId);

         if (error) {
           console.warn('⚠️ Error al eliminar producto en Supabase:', error);
           showNotification('⚠️ Error al eliminar en servidor', 'error');
         } else {
           console.log(`✅ Producto ${productId} eliminado en Supabase`);
         }
       } catch (err) {
         console.warn('Error eliminando producto en Supabase:', err);
       }
     })();
   }
 };

  // ===== CLIENT MANAGEMENT =====
   const handleAddClient = () => {
     if (!clientForm.name || !clientForm.nit) {
       showNotification('Nombre y NIT son obligatorios', 'error');
       return;
     }

     if (editingClient) {
       // Optimistic update
       setClients(clients.map(c =>
         c.id === editingClient.id
           ? { ...c, ...clientForm, id: c.id }
           : c
       ));
       showNotification('Cliente actualizado', 'success');

       (async () => {
         try {
           const { data, error } = await supabase
             .from('clients')
             .update({
               name: clientForm.name,
               razon_social: clientForm.razonSocial,
               sucursal: clientForm.sucursal,
               contacto: clientForm.contacto,
               cargo: clientForm.cargo,
               nit: clientForm.nit,
               direccion: clientForm.direccion,
               telefono: clientForm.telefono,
               email: clientForm.email,
               updated_at: new Date().toISOString()
             })
             .eq('id', editingClient.id)
             .select()
             .single();

           if (error) {
             console.warn('⚠️ Error al actualizar cliente en Supabase:', error);
             showNotification('⚠️ Error al sincronizar con servidor', 'error');
             return;
           }

           if (data) {
             const normalized = {
               id: data.id,
               client_id: data.client_id || '',
               name: data.name || '',
               razonSocial: data.razon_social || '',
               sucursal: data.sucursal || '',
               contacto: data.contacto || '',
               cargo: data.cargo || '',
               nit: data.nit || '',
               direccion: data.direccion || '',
               telefono: data.telefono || '',
               email: data.email || ''
             };
             setClients(prev => prev.map(c => c.id === normalized.id ? normalized : c));
             console.log(`✅ Cliente ${normalized.id} actualizado en Supabase`);
           }
         } catch (err) {
           console.warn('Error actualizando cliente en Supabase:', err);
         }
       })();

       setEditingClient(null);
     } else {
       showNotification('Creando cliente...', 'success');

       (async () => {
         try {
           const clientId = clientForm.client_id || `cl${Date.now()}`;
           const { data, error } = await supabase
             .from('clients')
             .insert({
               client_id: clientId,
               name: clientForm.name,
               razon_social: clientForm.razonSocial,
               sucursal: clientForm.sucursal,
               contacto: clientForm.contacto,
               cargo: clientForm.cargo,
               nit: clientForm.nit,
               direccion: clientForm.direccion,
               telefono: clientForm.telefono,
               email: clientForm.email,
               created_at: new Date().toISOString()
             })
             .select()
             .single();

           if (error) {
             console.warn('⚠️ Error al crear cliente en Supabase:', error);
             showNotification('⚠️ Error al crear cliente en servidor', 'error');
             // fallback: añadir localmente para no bloquear la UX
             const fallback = { ...clientForm, client_id: clientId, id: `c-local-${Date.now()}` };
             setClients(prev => [...prev, fallback]);
             return;
           }

           if (data) {
             const added = {
               id: data.id,
               client_id: data.client_id || '',
               name: data.name || '',
               razonSocial: data.razon_social || '',
               sucursal: data.sucursal || '',
               contacto: data.contacto || '',
               cargo: data.cargo || '',
               nit: data.nit || '',
               direccion: data.direccion || '',
               telefono: data.telefono || '',
               email: data.email || ''
             };
             setClients(prev => [...prev, added]);
             showNotification('Cliente creado correctamente', 'success');
             console.log(`✅ Cliente ${added.id} creado en Supabase`);
           }
         } catch (err) {
           console.warn('Error persistiendo cliente en Supabase:', err);
           showNotification('⚠️ Error al crear cliente', 'error');
           const fallback = { ...clientForm, client_id: `cl${Date.now()}`, id: `c-local-${Date.now()}` };
           setClients(prev => [...prev, fallback]);
         }
       })();
     }

     setClientForm({ id: '', client_id: '', name: '', razonSocial: '', sucursal: '', contacto: '', cargo: '', nit: '', direccion: '', telefono: '', email: '' });
     setShowClientForm(false);
   };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setClientForm(client);
    setShowClientForm(true);
  };

   const handleDeleteClient = (clientId) => {
     if (confirm('¿Eliminar este cliente?')) {
       setClients(clients.filter(c => c.id !== clientId));
       showNotification('Cliente eliminado', 'success');
       (async () => {
         try {
           const { error } = await supabase
             .from('clients')
             .delete()
             .eq('id', clientId);
           if (error) console.warn('⚠️ Error al eliminar cliente en Supabase:', error);
           else console.log(`✅ Cliente eliminado en Supabase`);
         } catch (err) {
           console.warn('Error:', err);
         }
       })();
     }
   };

  // ===== DASHBOARD STATS =====
  const stats = {
    totalUsers: users.length,
    totalProducts: products.length,
    totalClients: clients.length,
    totalTickets: tickets.length,
    activeTickets: tickets.filter(t => !['Cerrado','Cerrado Verificado'].includes(t.status)).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Panel de Administrador</h1>
            <button
              onClick={onBack}
              className="bg-purple-800 hover:bg-purple-600 px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mx-4 mt-4 p-4 rounded-lg flex items-center gap-3 ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-gray-200">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'users', label: 'Usuarios', icon: Users },
            { id: 'products', label: 'Productos', icon: Package },
            { id: 'clients', label: 'Clientes', icon: Building2 },
            { id: 'system', label: 'Sistema', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Usuarios', value: stats.totalUsers, icon: Users, color: 'blue' },
                { label: 'Productos', value: stats.totalProducts, icon: Package, color: 'green' },
                { label: 'Clientes', value: stats.totalClients, icon: Building2, color: 'purple' },
                { label: 'Tickets Totales', value: stats.totalTickets, icon: BarChart3, color: 'orange' },
                { label: 'Tickets Activos', value: stats.activeTickets, icon: AlertCircle, color: 'red' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                const bgColors = {
                  blue: 'bg-blue-50',
                  green: 'bg-green-50',
                  purple: 'bg-purple-50',
                  orange: 'bg-orange-50',
                  red: 'bg-red-50',
                };
                const iconColors = {
                  blue: 'text-blue-600',
                  green: 'text-green-600',
                  purple: 'text-purple-600',
                  orange: 'text-orange-600',
                  red: 'text-red-600',
                };

                return (
                  <div key={i} className={`${bgColors[stat.color]} rounded-lg p-6 border border-gray-200`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                      </div>
                      <Icon className={`w-8 h-8 ${iconColors[stat.color]}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tickets by Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4">Tickets por Estado</h3>
                <div className="space-y-3">
                  {['Nuevo', 'Asignado', 'En Investigacion', 'Pendiente RCA', 'En Resolucion', 'Pendiente Cierre', 'Cerrado'].map(status => {
                    const count = tickets.filter(t => t.status === status).length;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{status}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{
                                width: `${tickets.length ? (count / tickets.length) * 100 : 0}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Users by Role */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4">Usuarios por Rol</h3>
                <div className="space-y-3">
                  {['Admin', 'Vendedor', 'Responsable', 'Gerente'].map(role => {
                    const count = users.filter(u => u.role === role).length;
                    return (
                      <div key={role} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{role}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${users.length ? (count / users.length) * 100 : 0}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Gestión de Usuarios</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => loadUsersFromSupabase()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
                  title="Cargar datos actualizados desde Supabase"
                >
                  🔄 Recargar
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setUserForm({
                      id: '',
                      name: '',
                      email: '',
                      phone: '',
                      role: 'Vendedor',
                      department: '',
                      password: '',
                      showPassword: false,
                    });
                    setShowUserForm(true);
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4" /> Nuevo Usuario
                </button>
              </div>
            </div>

            {/* User Form Modal */}
            {showUserForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <div className="bg-gradient-to-r from-purple-900 to-purple-700 text-white p-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                    <button onClick={() => setShowUserForm(false)}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="w-4 h-4 inline mr-2" />
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Mail className="w-4 h-4 inline mr-2" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Phone className="w-4 h-4 inline mr-2" />
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={userForm.phone}
                        onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Departamento
                      </label>
                      <input
                        type="text"
                        value={userForm.department}
                        onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rol
                      </label>
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option>Admin</option>
                        <option>Vendedor</option>
                        <option>Responsable</option>
                        <option>Gerente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Lock className="w-4 h-4 inline mr-2" />
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={userForm.showPassword ? 'text' : 'password'}
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={() => setUserForm({ ...userForm, showPassword: !userForm.showPassword })}
                          className="absolute right-3 top-2.5"
                        >
                          {userForm.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleAddUser}
                        className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 font-medium"
                      >
                        <Save className="w-4 h-4" /> Guardar
                      </button>
                      <button
                        onClick={() => setShowUserForm(false)}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2 font-medium"
                      >
                        <X className="w-4 h-4" /> Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Departamento</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{user.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          user.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'Vendedor' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'Responsable' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.department || '-'}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Gestión de Productos</h2>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ id: '', name: '', description: '', price: '', sku: '', clientIds: [] });
                  setShowProductForm(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" /> Nuevo Producto
              </button>
            </div>

            {/* Product Form Modal */}
            {showProductForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                  <div className="bg-gradient-to-r from-purple-900 to-purple-700 text-white p-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                    <button onClick={() => setShowProductForm(false)}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Package className="w-4 h-4 inline mr-2" />
                        Nombre del Producto
                      </label>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows="3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Hash className="w-4 h-4 inline mr-2" />
                        SKU
                      </label>
                      <input
                        type="text"
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        Precio
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <ShoppingBag className="w-4 h-4 inline mr-2" />
                        Clientes Autorizados
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50">
                        {(clients || []).map(client => (
                          <label key={client.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={productForm.clientIds?.includes(client.id) || false}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProductForm({
                                    ...productForm,
                                    clientIds: [...(productForm.clientIds || []), client.id]
                                  });
                                } else {
                                  setProductForm({
                                    ...productForm,
                                    clientIds: productForm.clientIds?.filter(id => id !== client.id) || []
                                  });
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">{client.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Selecciona qué clientes pueden usar este producto</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleAddProduct}
                        className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 font-medium"
                      >
                        <Save className="w-4 h-4" /> Guardar
                      </button>
                      <button
                        onClick={() => setShowProductForm(false)}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Precio</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Clientes Autorizados</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Descripción</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{product.sku || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">${product.price || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {product.clientIds && product.clientIds.length > 0 
                          ? product.clientIds
                              .map(clientId => clients.find(c => c.id === clientId)?.name)
                              .filter(Boolean)
                              .join(', ')
                          : 'Todos'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{product.description || '-'}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTS TAB */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Gestión de Clientes</h2>
              <button
                onClick={() => {
                  setEditingClient(null);
                  setClientForm({ id: '', name: '', razonSocial: '', sucursal: '', contacto: '', cargo: '', nit: '', direccion: '', telefono: '', email: '' });
                  setShowClientForm(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" /> Nuevo Cliente
              </button>
            </div>

            {/* Client Form Modal */}
            {showClientForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="bg-gradient-to-r from-purple-900 to-purple-700 text-white p-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                    <button onClick={() => setShowClientForm(false)}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Building2 className="w-4 h-4 inline mr-2" />
                          Nombre Comercial
                        </label>
                        <input
                          type="text"
                          value={clientForm.name}
                          onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Nombre comercial"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Building2 className="w-4 h-4 inline mr-2" />
                          Razón Social
                        </label>
                        <input
                          type="text"
                          value={clientForm.razonSocial}
                          onChange={(e) => setClientForm({ ...clientForm, razonSocial: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Razón social"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Hash className="w-4 h-4 inline mr-2" />
                          NIT
                        </label>
                        <input
                          type="text"
                          value={clientForm.nit}
                          onChange={(e) => setClientForm({ ...clientForm, nit: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Nro. identificación"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sucursal
                        </label>
                        <input
                          type="text"
                          value={clientForm.sucursal}
                          onChange={(e) => setClientForm({ ...clientForm, sucursal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Sucursal o sede"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <User className="w-4 h-4 inline mr-2" />
                          Contacto
                        </label>
                        <input
                          type="text"
                          value={clientForm.contacto}
                          onChange={(e) => setClientForm({ ...clientForm, contacto: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Nombre del contacto"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cargo
                        </label>
                        <input
                          type="text"
                          value={clientForm.cargo}
                          onChange={(e) => setClientForm({ ...clientForm, cargo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Cargo del contacto"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Phone className="w-4 h-4 inline mr-2" />
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={clientForm.telefono}
                          onChange={(e) => setClientForm({ ...clientForm, telefono: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="+57 ..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Mail className="w-4 h-4 inline mr-2" />
                          Email
                        </label>
                        <input
                          type="email"
                          value={clientForm.email}
                          onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="correo@empresa.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección
                      </label>
                      <textarea
                        value={clientForm.direccion}
                        onChange={(e) => setClientForm({ ...clientForm, direccion: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows="2"
                        placeholder="Dirección completa"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleAddClient}
                        className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 font-medium"
                      >
                        <Save className="w-4 h-4" /> Guardar
                      </button>
                      <button
                        onClick={() => setShowClientForm(false)}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Clients Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            {/* PQR Configuration */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Configuración de PQRs</h2>
                <button
                  onClick={() => {
                    setShowPqrConfigForm(!showPqrConfigForm);
                    setEditingPqrConfig(pqrConfig);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
                >
                  <Settings className="w-4 h-4" /> Editar
                </button>
              </div>

              {showPqrConfigForm ? (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Prefijo de PQR</label>
                    <input
                      type="text"
                      maxLength="10"
                      value={editingPqrConfig.prefix}
                      onChange={(e) => setEditingPqrConfig({ ...editingPqrConfig, prefix: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ej: PQR, PQRS, RC"
                    />
                    <p className="text-xs text-blue-600 mt-1">Ej: PQR, PQRS, RC, etc.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Próximo Número Consecutivo</label>
                    <input
                      type="number"
                      min="1"
                      value={editingPqrConfig.next_number}
                      onChange={(e) => setEditingPqrConfig({ ...editingPqrConfig, next_number: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-blue-600 mt-1">El siguiente PQR usará este número. Ejemplo: {editingPqrConfig.prefix}-20260209-{String(editingPqrConfig.next_number).padStart(4, '0')}</p>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>⚠️ Importante:</strong> Los PQRs ya creados NO cambiarán su número. 
                      Solo los nuevos PQRs usarán esta configuración.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSavePqrConfig}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Guardar Cambios
                    </button>
                    <button
                      onClick={() => setShowPqrConfigForm(false)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 font-bold uppercase">Prefijo Actual</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">{pqrConfig.prefix}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 font-bold uppercase">Próximo Número</p>
                    <p className="text-3xl font-bold text-purple-900 mt-2">{String(pqrConfig.next_number).padStart(4, '0')}</p>
                    <p className="text-xs text-purple-600 mt-2">Siguiente PQR: {pqrConfig.prefix}-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-{String(pqrConfig.next_number).padStart(4, '0')}</p>
                  </div>
                </div>
              )}
            </div>

              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Nombre Comercial</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Razón Social</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">NIT</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{client.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{client.razonSocial || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{client.nit}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{client.contacto || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{client.email || '-'}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditClient(client)}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SYSTEM TAB */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Estado del Sistema & Keep-Alive</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium">Estado Keep-Alive</p>
                  <p className="text-2xl font-bold text-blue-900 mt-2">
                    {keepaliveRecords.length > 0 ? '✅ Activo' : '⚠️ No inicializado'}
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    {keepaliveRecords.length > 0 
                      ? `Último registro: ${new Date(keepaliveRecords[0].last_write).toLocaleDateString('es-CO')}`
                      : 'La tabla se creará con el primer registro automático'}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600 font-medium">Total de Registros</p>
                  <p className="text-2xl font-bold text-green-900 mt-2">{keepaliveRecords.length}</p>
                  <p className="text-xs text-green-700 mt-2">
                    Cada 4 días se inserta automáticamente un nuevo registro
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
                <p className="text-sm text-yellow-800 font-bold mb-2">📋 Instrucciones de Setup</p>
                <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
                  <li>Abre el archivo <code className="bg-yellow-100 px-2 py-1 rounded">SETUP_KEEPALIVE_SUPABASE.sql</code></li>
                  <li>Ve a tu proyecto en supabase.co → SQL Editor</li>
                  <li>Copia todo el contenido del .sql y pégalo en una nueva query</li>
                  <li>Haz clic en "Run" (botón verde)</li>
                  <li>¡Listo! La app escribirá automáticamente cada 4 días</li>
                </ol>
              </div>
            </div>

            {/* Keep-Alive Records Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">Historial de Keep-Alive (últimos 20 registros)</h3>
              </div>
              {keepaliveRecords.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">#</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Número de Secuencia</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Fecha Último Registro</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Fecha Creación</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {keepaliveRecords.map((record, idx) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-600">{idx + 1}</td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{record.sequence_number}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {new Date(record.last_write).toLocaleDateString('es-CO', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {new Date(record.created_at).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{record.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-sm">No hay registros de keep-alive aún.</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Una vez que crees la tabla en Supabase (ver instrucciones arriba), 
                    los registros comenzarán a aparecer cada 4 días automáticamente.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
