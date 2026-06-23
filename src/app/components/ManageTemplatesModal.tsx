"use client"

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
}

interface ManageTemplatesModalProps {
    onClose: () => void;
}

export default function ManageTemplatesModal({ onClose }: ManageTemplatesModalProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newName, setNewName] = useState('');
    const [newLanguage, setNewLanguage] = useState('es');

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await fetch('/api/templates');
                const data = await res.json();
                if (data.success && data.templates) {
                    setTemplates(data.templates);
                }
            } catch (err) {
                console.error("Error loading templates:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    const handleAddTemplate = async () => {
        const name = newName.trim();
        if (!name) return;

        setSaving(true);
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    language: newLanguage,
                    category: 'marketing'
                }),
            });
            const data = await res.json();
            if (data.success && data.template) {
                setTemplates(prev => [...prev, data.template]);
                setNewName('');
            }
        } catch (err) {
            console.error("Error adding template:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta plantilla?')) return;
        setSaving(true);
        try {
            await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error("Error deleting template:", err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl border border-slate-150 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h3 className="font-display text-sm font-semibold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                            Administrar Plantillas
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            Crea y administra plantillas de WhatsApp para contactar a tus clientes.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Existing Templates */}
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Tus Plantillas
                                </label>
                                {templates.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic bg-slate-50 rounded-lg p-4 text-center border border-slate-100">
                                        No tienes plantillas creadas.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {templates.map(template => (
                                            <div key={template.id} className="rounded-xl border border-slate-200 p-4 relative group hover:border-slate-300 transition">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-xs text-slate-800">{template.name}</span>
                                                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase">
                                                            {template.language}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteTemplate(template.id)}
                                                        disabled={saving}
                                                        className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 disabled:opacity-30 p-1"
                                                        title="Eliminar plantilla"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-slate-100" />

                            {/* Add Template Form */}
                            <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-4">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    Nueva Plantilla
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="compra_web"
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Idioma</label>
                                        <select
                                            value={newLanguage}
                                            onChange={(e) => setNewLanguage(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400"
                                        >
                                            <option value="es">Español</option>
                                            <option value="en">Inglés</option>
                                            <option value="pt">Portugués</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleAddTemplate}
                                        disabled={saving || !newName.trim()}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                        Guardar Plantilla
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 text-xs font-semibold transition"
                    >
                        Cerrar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
