"use client"

import {
  IceCream,
  Users,
  BadgeCheck,
  Calendar,
  Plus,
  Search,
  TrendingUp,
  Share2,
  LogOut,
  Filter,
  Edit3,
  PhoneCall,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  History,
  Info,
  ChartBarIcon,
  ChartNoAxesCombined,
  User,
  Settings,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GoogleSheetsManager from './components/GoogleSheetsManager';
import SurvivalCurveModal from './components/SurvivalCurveModal';
import AddContactModal from './components/AddContactModal';
import ManageTemplatesModal from './components/ManageTemplatesModal';
// import AddClientModal from './components/AddClientModal';
import { Client, WhatsAppLog } from "@/app/types/types";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { saveClientsToDB, loadClientsFromDB, saveOrdersToDB, loadOrdersFromDB } from './utils/db';

export default function App() {
  // Estado de Autenticación
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);
  // Clientes y WhatsApp logs
  const [clients, setClients] = useState<Client[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'contact' | 'allClients' | 'allOrders'>('contact');
  const [orders, setOrders] = useState<any[]>([]);

  // Manage templates modal state
  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);

  // Filtros y búsquedas
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Urgent' | 'Soon' | 'On Track'>('All');
  const [selectedFlavorFilter, setSelectedFlavorFilter] = useState<string>('All');

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalWhatsappClient, setModalWhatsappClient] = useState<Client | null>(null);
  const [modalAddContactClient, setModalAddContactClient] = useState<Client | null>(null);
  const [dbClients, setDbClients] = useState<any[]>([]);

  // Cliente seleccionado para ver detallado / editar
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  // Cargar estado inicial desde IndexedDB
  useEffect(() => {
    Promise.all([loadClientsFromDB(), loadOrdersFromDB()])
      .then(([savedClients, savedOrders]) => {
        if (savedClients && savedClients.length > 0) {
          setClients(savedClients);
          setSelectedClient(savedClients[0]);
          setEditForm(savedClients[0]);
        }
        if (savedOrders && savedOrders.length > 0) {
          setOrders(savedOrders);
        }
      })
      .catch(err => console.error('Error al recuperar df de IndexedDB:', err))
      .finally(() => setLoading(false));

    // Cargar clientes confirmados de la DB para actualizar UI (Ver contacto)
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.clients) {
          setDbClients(data.clients);
        }
      })
      .catch(err => console.error('Error al cargar clientes DB:', err));
  }, []);

  // useEffect(() => {
  //   if (isAuthenticated) {
  //     fetchClientsAndLogs();
  //     // Polling de logs cada 4 segundos para actualizar el estado del simulador de WhatsApp ('sent' -> 'delivered' -> 'read')
  //     const interval = setInterval(() => {
  //       fetch('/api/whatsapp/logs')
  //         .then(res => res.json())
  //         .then(data => {
  //           if (data.success) setWhatsappLogs(data.logs);
  //         })
  //         .catch(err => console.error('Error fetching logs inside interval', err));
  //     }, 4000);
  //     return () => clearInterval(interval);
  //   }
  // }, [isAuthenticated]);

  const fetchClientsAndLogs = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/clients').then(res => res.json()),
      fetch('/api/whatsapp/logs').then(res => res.json())
    ])
      .then(([clientData, rLogData]) => {
        if (clientData.success) {
          setClients(clientData.clients);
          if (clientData.clients.length > 0) {
            setSelectedClient(clientData.clients[0]);
            setEditForm(clientData.clients[0]);
          }
        }
        if (rLogData.success) {
          setWhatsappLogs(rLogData.logs);
        }
      })
      .catch(err => console.error('Error fetching dashboard init state', err))
      .finally(() => setLoading(false));
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  // Callback de Pandas Lambda finalizado
  const handleExtractionComplete = async (newImported: Client[], summary: any, rawResult?: any) => {
    // Volver a cargar clientes en memoria para que aparezcan en la grilla y KPIs
    setClients(newImported);
    const newOrders = rawResult?.allOrders || [];
    setOrders(newOrders);

    // Almacenar los valores generados del df de la última iteración en IndexedDB
    try {
      await saveClientsToDB(newImported);
      if (newOrders.length > 0) {
        await saveOrdersToDB(newOrders);
      }
      console.log('Resultados de iteración del DataFrame guardados en IndexedDB.');
    } catch (err) {
      console.error('Error al guardar iteración en IndexedDB', err);
    }
  };

  // Guardar cambios editados en el cliente seleccionado
  const handleSaveClientDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/clients/${selectedClient?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await response.json();

      if (data.success) {
        // Refrescar lista de clientes conservando selección
        const updatedClients = clients.map(c => c?.id === selectedClient?.id ? data.client : c);
        setClients(updatedClients);
        setSelectedClient(data.client);
        setIsEditing(false);
        alert('Información del cliente y contacto actualizada con éxito.');
      } else {
        alert(data.error || 'Error al guardar modificaciones.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al actualizar heladería B2B.');
    }
  };

  // Recibe la respuesta al enviar un WhatsApp de recordatorio exitoso
  const handleWhatsAppSentSuccess = (newLog: WhatsAppLog) => {
    // Adjuntar logs en tiempo real
    setWhatsappLogs(prev => [newLog, ...prev]);
    // Refrescar para ver si afectó algún estatus
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        if (data.success) setClients(data.clients);
      });
  };

  // Encontrar "hoy" como la fecha del último pedido entre todos los clientes
  const globalToday = new Date("2026-06-08")
  // const globalToday = clients.reduce((max, c) => {
  //   if (!c.lastPurchaseDate) return max;
  //   const d = new Date(c.lastPurchaseDate);
  //   return (!isNaN(d.getTime()) && d > max) ? d : max;
  // }, new Date(0));

  // Filtrado de Clientes en el Frontend
  const filteredClients = clients.filter(c => {
    const matchesSearch =
      c?.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.preferredFlavor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);

    // Lógica precalculada en Python: supervivencia hoy > 95%, en 7 días < 50%, y <= 90 días sin pedir
    const hasHighPurchaseProbability = c.shouldContact === true;

    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesFlavor = selectedFlavorFilter === 'All' || c.preferredFlavor === selectedFlavorFilter;

    // Dependiendo del tab, ignoramos o aplicamos la probabilidad
    const passesTabFilter = activeTab === 'contact' ? hasHighPurchaseProbability : true;

    return matchesSearch && matchesStatus && matchesFlavor && passesTabFilter;
  });

  // KPI Analytics
  const totalVolumeKg = clients.reduce((acc, current) => acc + (current.lastOrderVolumeKg || 0), 0);
  const criticalCount = clients.filter(c => c.status === 'Urgent').length;
  const soonCount = clients.filter(c => c.status === 'Soon').length;
  const flavorCounts = clients.reduce((acc: any, current) => {
    acc[current.preferredFlavor] = (acc[current.preferredFlavor] || 0) + 1;
    return acc;
  }, {});

  let topFlavor = 'Ninguno';
  let topFlavorVal = 0;
  Object.entries(flavorCounts).forEach(([flavor, count]: [string, any]) => {
    if (count > topFlavorVal) {
      topFlavorVal = count;
      topFlavor = flavor;
    }
  });

  // Flavores únicos para el select filter
  const uniqueFlavors = Array.from(new Set(clients.map(c => c.preferredFlavor)));


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased pb-12">
      {/* HEADER PRINCIPAL */}
      <nav id="navbar" className="sticky top-0 z-40 bg-white border-b border-slate-100 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <IceCream className="h-5 w-5" />
            </div> */}
            <div>
              <h1 className="font-display text-base font-semibold tracking-tight text-slate-900">
                Predicción próxima compra
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowManageTemplatesModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
              Plantillas WhatsApp
            </button>
            <span className="text-xs font-medium text-slate-900 hidden sm:inline-block px-2 py-1 bg-slate-100/75 rounded-lg">
              {session?.user?.name || session?.user?.email}
            </span>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg transition active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">


        {/* CONTENEDOR CENTRAL: EXCEL UPLOADER */}
        <div className="space-y-6">
          <GoogleSheetsManager onExtractionComplete={handleExtractionComplete} />

          {/* TABLA DE CLIENTES CRM */}
          <div id="clients-section" className="bg-white rounded-lg border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  Vistas y Datos
                </h3>
                <div className="flex items-center gap-2 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('contact')}
                    className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'contact' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    A contactar
                  </button>
                  <button
                    onClick={() => setActiveTab('allClients')}
                    className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'allClients' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Todos los Clientes
                  </button>
                  <button
                    onClick={() => setActiveTab('allOrders')}
                    className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'allOrders' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Historial Pedidos
                  </button>
                </div>
              </div>

            </div>

            {/* FILTROS INTERACTIVOS
              <div className="p-3 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    id="search-input"
                    type="text"
                    placeholder="Buscar cliente, móvil..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7.5 pr-3 py-1.5 w-full rounded-md border border-slate-200 bg-white placeholder-slate-450 text-slate-700 font-medium focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-slate-400 shrink-0" />
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="py-1.5 border border-slate-200 bg-white rounded-md text-slate-600 focus:outline-none w-full font-medium"
                  >
                    <option value="All">Todos los estados</option>
                    <option value="Urgent">⚠️ Crítico / Demorado</option>
                    <option value="Soon">⌛ Pronto a pedir</option>
                    <option value="On Track">✅ Al día</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 sm:col-span-2">
                  <IceCream className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <select
                    id="flavor-filter"
                    value={selectedFlavorFilter}
                    onChange={(e) => setSelectedFlavorFilter(e.target.value)}
                    className="py-1.5 border border-slate-200 bg-white rounded-md text-slate-600 focus:outline-none w-full font-medium"
                  >
                    <option value="All">Todos los sabores favoritos</option>
                    {uniqueFlavors.map(flavor => (
                      <option key={flavor} value={flavor}>{flavor}</option>
                    ))}
                  </select>
                </div>
              </div> */}

            {/* LISTADO EN GRIDA */}
            {false ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent mx-auto mb-2" />
                Cargando cartera de clientes...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-20 text-center text-slate-450 text-xs">
                <Info className="h-5 w-5 text-slate-300 mx-auto mb-1.5" />
                No se encontraron heladerías B2B que coincidan con los filtros.
              </div>
            ) : activeTab === 'allOrders' ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Fecha Pedido</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Ubicación</th>
                      <th className="py-3 px-4 text-center">Volumen</th>
                      <th className="py-3 px-4 text-center">Comodato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {orders.map((order, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-4 whitespace-nowrap font-mono text-[10px] text-slate-500">{i + 1}</td>
                        <td className="py-2 px-4 whitespace-nowrap font-mono text-[10px] text-slate-500">{order.order_date}</td>
                        <td className="py-2 px-4 font-semibold text-slate-700">{order.client}</td>
                        <td className="py-2 px-4 text-slate-600">{order.location}</td>
                        <td className="py-2 px-4 text-center">${order.amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="py-2 px-4 text-center">
                          {order.comodato === 1 ? <CheckCircle2 className="h-3 w-3 text-emerald-500 mx-auto" /> : '-'}
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 text-xs italic">
                          No hay pedidos en el historial (se requiere nueva sincronización).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/10 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Contacto</th>
                      <th className="py-3 px-4 text-center">Predicción Reposición</th>
                      <th className="py-3 px-4 text-right">Análisis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClients.map((client, i) => {
                      const isSelectedStatus = selectedClient?.id === client?.id;
                      const dbC = dbClients.find(d => d.name === client.businessName);
                      const isClientInDb = !!dbC;
                      return (
                        <tr
                          id={`client-${client?.businessName || i}`}
                          key={i}
                          onClick={() => {
                            setSelectedClient(client);
                            setEditForm(client);
                            setIsEditing(false);
                          }}
                          className={`group hover:bg-slate-50/50 cursor-pointer h-14 ${isSelectedStatus ? 'bg-slate-100/40 hover:bg-slate-100/50' : ''
                            }`}
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-800 transition truncate max-w-[170px]">
                              {client?.businessName}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              {isClientInDb ? (
                                <span className="font-mono">{dbC.phone}</span>
                              ) : (
                                <span className="italic">Contacto no agregado</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="font-mono font-semibold text-slate-600 block">
                              {client.estimatedNextPurchaseDate}
                            </span>

                          </td>


                          <td className="py-2.5 px-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5 pr-4">
                              <button
                                onClick={() => {
                                  if (dbC) {
                                    setModalAddContactClient({ ...client, phone: dbC.phone });
                                  } else {
                                    setModalAddContactClient(client);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 font-semibold transition active:scale-[0.98] cursor-pointer text-[10px]"
                              >
                                <User className="h-3.5 w-3.5 text-slate-500" />
                                {isClientInDb ? "Ver contacto" : "Agregar contacto"}
                              </button>
                              <button
                                id={`analysis-${client?.businessName || i}`}
                                onClick={() => setModalWhatsappClient(client)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 font-semibold transition active:scale-[0.98] cursor-pointer text-[10px]"
                              >
                                <ChartNoAxesCombined className="h-3.5 w-3.5 text-slate-500" />
                                Ver análisis
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>


        {/* </div> */}
      </main>

      {/* MODALES DEL CRM */}
      <AnimatePresence>
        {/* {showAddModal && (
          <AddClientModal
            onClose={() => setShowAddModal(false)}
            onAdd={(newC) => {
              // Refrescar para incorporar nuevo cliente
              setClients(prev => [newC, ...prev]);
              setSelectedClient(newC);
              setEditForm(newC);
            }}
          />
        )} */}

        {modalWhatsappClient && (
          <SurvivalCurveModal
            client={modalWhatsappClient}
            globalToday={globalToday}
            onClose={() => setModalWhatsappClient(null)}
          />
        )}

        {modalAddContactClient && (
          <AddContactModal
            initialClient={modalAddContactClient}
            isCreated={dbClients.some(c => c.name === modalAddContactClient.businessName)}
            onClose={() => setModalAddContactClient(null)}
            onSuccess={(updatedClient) => {
              setModalAddContactClient(null);
              setDbClients(prev => {
                const exists = prev.find(c => c.name === updatedClient.name);
                if (exists) {
                  return prev.map(c => c.name === updatedClient.name ? updatedClient : c);
                }
                return [...prev, updatedClient];
              });
            }}
            onDelete={(deletedName) => {
              setModalAddContactClient(null);
              setDbClients(prev => prev.filter(c => c.name !== deletedName));
            }}
          />
        )}
      </AnimatePresence>

      {/* Manage Templates Modal */}
      <AnimatePresence>
        {showManageTemplatesModal && (
          <ManageTemplatesModal onClose={() => setShowManageTemplatesModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
