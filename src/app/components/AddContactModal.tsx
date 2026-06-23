import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Save, Phone, User, Trash2 } from 'lucide-react';
import { Client } from '../types/types';

interface AddContactModalProps {
  initialClient?: Client | null;
  isCreated?: boolean;
  onClose: () => void;
  onSuccess: (newClient: any) => void;
  onDelete?: (clientName: string) => void;
}

export default function AddContactModal({ initialClient, isCreated, onClose, onSuccess, onDelete }: AddContactModalProps) {
  const [name, setName] = useState(initialClient?.businessName || '');
  const [phone, setPhone] = useState(initialClient?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/clients', {
        method: isCreated ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });
      const data = await response.json();
      if (data.success) {
        onSuccess(data.client);
      } else {
        alert(data.error || 'Error al guardar el contacto');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al guardar el contacto');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar este contacto de la base de datos?')) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/clients?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success && onDelete) {
        onDelete(name);
      } else {
        alert(data.error || 'Error al eliminar el contacto');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al eliminar el contacto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-800">Agregar Contacto</h3>
            <p className="text-xs text-slate-500 mt-0.5">Añade o confirma los datos en la base de datos.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nombre del Cliente</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                disabled={true}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition"
                placeholder="Ej. Gelateria San Juan"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Teléfono (WhatsApp)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition"
                placeholder="+569..."
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
            {isCreated && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-none px-4 py-2.5 border border-red-200 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
