"use client"

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, ArrowLeftRight, Ban, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DataRule {
    id: string;
    ruleType: 'replace' | 'stop_word';
    columnName: string | null;
    matchValue: string;
    newValue: string | null;
}

// Unsaved rule being edited locally
interface DraftReplace {
    matchValue: string;
    newValue: string;
}

interface DataRulesModalProps {
    onClose: () => void;
}

const AVAILABLE_COLUMNS = [
    { value: 'client', label: 'Cliente (client)' },
    { value: 'location', label: 'Ubicación (location)' },
];

export default function DataRulesModal({ onClose }: DataRulesModalProps) {
    const [activeTab, setActiveTab] = useState<'replace' | 'stop_word'>('replace');
    const [rules, setRules] = useState<DataRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Replace tab state
    const [selectedColumn, setSelectedColumn] = useState('client');
    const [draftReplace, setDraftReplace] = useState<DraftReplace>({ matchValue: '', newValue: '' });

    // Stop word tab state
    const [newStopWord, setNewStopWord] = useState('');

    // Load rules from API
    useEffect(() => {
        const fetchRules = async () => {
            try {
                const res = await fetch('/api/data-rules');
                const data = await res.json();
                if (data.success && data.rules) {
                    setRules(data.rules);
                }
            } catch (err) {
                console.error("Error loading data rules:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRules();
    }, []);

    // ── Replace CRUD ─────────────────────────────────────────────
    const replaceRulesForColumn = rules.filter(
        r => r.ruleType === 'replace' && r.columnName === selectedColumn
    );

    const handleAddReplace = async () => {
        const match = draftReplace.matchValue.trim();
        const newVal = draftReplace.newValue.trim();
        if (!match || !newVal) return;

        setSaving(true);
        try {
            const res = await fetch('/api/data-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ruleType: 'replace',
                    columnName: selectedColumn,
                    matchValue: match,
                    newValue: newVal,
                }),
            });
            const data = await res.json();
            if (data.success && data.rule) {
                setRules(prev => [...prev, data.rule]);
                setDraftReplace({ matchValue: '', newValue: '' });
            }
        } catch (err) {
            console.error("Error adding replace rule:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        setSaving(true);
        try {
            await fetch(`/api/data-rules?id=${id}`, { method: 'DELETE' });
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error("Error deleting rule:", err);
        } finally {
            setSaving(false);
        }
    };

    // ── Stop Words CRUD ──────────────────────────────────────────
    const stopWordRules = rules.filter(r => r.ruleType === 'stop_word');

    const handleAddStopWord = async () => {
        const word = newStopWord.trim().toLowerCase();
        if (!word) return;

        // Avoid duplicates
        if (stopWordRules.some(r => r.matchValue === word)) {
            setNewStopWord('');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/data-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ruleType: 'stop_word',
                    matchValue: word,
                }),
            });
            const data = await res.json();
            if (data.success && data.rule) {
                setRules(prev => [...prev, data.rule]);
                setNewStopWord('');
            }
        } catch (err) {
            console.error("Error adding stop word:", err);
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
                className="bg-white rounded-2xl border border-slate-150 shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h3 className="font-display text-sm font-semibold text-slate-800">
                            Modificar datos
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            Reglas aplicadas durante la Fase 1 del procesamiento Python
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-5">
                    <button
                        onClick={() => setActiveTab('replace')}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold border-b-2 transition cursor-pointer ${activeTab === 'replace'
                            ? 'border-slate-800 text-slate-800'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <ArrowLeftRight className="h-3 w-3" />
                        Reemplazar
                    </button>
                    <button
                        onClick={() => setActiveTab('stop_word')}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold border-b-2 transition cursor-pointer ${activeTab === 'stop_word'
                            ? 'border-slate-800 text-slate-800'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Ban className="h-3 w-3" />
                        Stop Words
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
                        </div>
                    ) : activeTab === 'replace' ? (
                        /* ── Replace Tab ────────────────────────────────── */
                        <div className="space-y-4">
                            {/* Column selector */}
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Columna a modificar
                                </label>
                                <select
                                    value={selectedColumn}
                                    onChange={(e) => setSelectedColumn(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400 transition"
                                >
                                    {AVAILABLE_COLUMNS.map(col => (
                                        <option key={col.value} value={col.value}>{col.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Existing rules for selected column */}
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Reglas de reemplazo para &quot;{selectedColumn}&quot;
                                </label>

                                {replaceRulesForColumn.length === 0 ? (
                                    <p className="text-[11px] text-slate-350 italic py-3 text-center">
                                        Sin reglas definidas para esta columna.
                                    </p>
                                ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {replaceRulesForColumn.map(rule => (
                                            <div
                                                key={rule.id}
                                                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 group"
                                            >
                                                <span className="text-xs text-slate-600 font-mono truncate flex-1" title={rule.matchValue}>
                                                    {rule.matchValue}
                                                </span>
                                                <span className="text-[10px] text-slate-350 shrink-0">→</span>
                                                <span className="text-xs text-slate-800 font-semibold font-mono truncate flex-1" title={rule.newValue || ''}>
                                                    {rule.newValue}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    disabled={saving}
                                                    className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 transition cursor-pointer disabled:opacity-30"
                                                    title="Eliminar regla"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add new replace rule */}
                            <div className="rounded-xl border border-dashed border-slate-200 p-3 space-y-2 bg-slate-50/30">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    Agregar reemplazo
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Valor original"
                                        value={draftReplace.matchValue}
                                        onChange={(e) => setDraftReplace(prev => ({ ...prev, matchValue: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddReplace()}
                                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-350 focus:outline-none focus:border-slate-400 font-mono"
                                    />
                                    <span className="text-[10px] text-slate-350 shrink-0">→</span>
                                    <input
                                        type="text"
                                        placeholder="Nuevo valor"
                                        value={draftReplace.newValue}
                                        onChange={(e) => setDraftReplace(prev => ({ ...prev, newValue: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddReplace()}
                                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-350 focus:outline-none focus:border-slate-400 font-mono"
                                    />
                                    <button
                                        onClick={handleAddReplace}
                                        disabled={saving || !draftReplace.matchValue.trim() || !draftReplace.newValue.trim()}
                                        className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white p-1.5 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    >
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Code preview */}
                            {replaceRulesForColumn.length > 0 && (
                                <div className="rounded-xl border border-slate-200 bg-slate-900 p-3">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Código Python generado
                                    </div>
                                    <pre className="text-[10px] text-slate-300 font-mono leading-relaxed overflow-x-auto">
                                        {`df['${selectedColumn}'] = df['${selectedColumn}'].replace({
${replaceRulesForColumn.map(r => `    '${r.matchValue}': '${r.newValue}'`).join(',\n')}
})`}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── Stop Words Tab ─────────────────────────────── */
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Stop words personalizadas
                                </label>
                                <p className="text-[10px] text-slate-400 mb-3">
                                    Estas palabras se ignoran al comparar nombres de clientes (se suman a las predeterminadas del sistema).
                                </p>

                                {/* Existing stop words as chips */}
                                {stopWordRules.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {stopWordRules.map(rule => (
                                            <span
                                                key={rule.id}
                                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-600 px-2 py-1 text-[11px] font-mono group"
                                            >
                                                {rule.matchValue}
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    disabled={saving}
                                                    className="rounded hover:bg-red-100 text-slate-350 hover:text-red-500 transition cursor-pointer ml-0.5 disabled:opacity-30"
                                                    title="Eliminar"
                                                >
                                                    <X className="h-2.5 w-2.5" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-350 italic py-3 text-center mb-2">
                                        Sin stop words personalizadas.
                                    </p>
                                )}
                            </div>

                            {/* Add new stop word */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Nueva stop word..."
                                    value={newStopWord}
                                    onChange={(e) => setNewStopWord(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStopWord()}
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-350 focus:outline-none focus:border-slate-400 font-mono"
                                />
                                <button
                                    onClick={handleAddStopWord}
                                    disabled={saving || !newStopWord.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                    Agregar
                                </button>
                            </div>

                            {/* System defaults info */}
                            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Stop words del sistema (siempre activas)
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {[
                                        "cafe", "cafeteria", "heladeria", "restaurant", "restaurante",
                                        "chile", "spa", "ltda", "limitada", "sa", "comercial",
                                        "sociedad", "emporio", "minimarket", "pasteleria", "panaderia",
                                        "gelateria", "el", "la", "los", "las", "de", "del", "y", "en",
                                        "market", "food", "store", "alimentos", "distribuidora",
                                        "comercializadora", "tostaduria", "pizza", "pizzeria", "hotel",
                                        "boutique", "gelato", "local", "coffe", "coffee", "cofee"
                                    ].map(w => (
                                        <span key={w} className="rounded bg-slate-100 text-slate-450 px-1.5 py-0.5 text-[9px] font-mono">
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[9px] text-slate-350 italic">
                        Los cambios se aplican en la próxima sincronización.
                    </p>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 text-[11px] font-semibold transition cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
