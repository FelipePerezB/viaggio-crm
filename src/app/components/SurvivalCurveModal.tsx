"use client"

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { X, Send, TrendingUp, Calendar, Clock, Activity, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Client } from '@/app/types/types';

interface SurvivalCurveModalProps {
  client: Client;
  globalToday: Date;
  onClose: () => void;
}

// ── Chart dimensions ──────────────────────────────────────────
const CHART = {
  width: 560,
  height: 260,
  padLeft: 52,
  padRight: 24,
  padTop: 16,
  padBottom: 36,
} as const;

const plotW = CHART.width - CHART.padLeft - CHART.padRight;
const plotH = CHART.height - CHART.padTop - CHART.padBottom;

export default function SurvivalCurveModal({ client, globalToday, onClose }: SurvivalCurveModalProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: number; prob: number } | null>(null);
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Derived data ────────────────────────────────────────────
  const curve = useMemo(() => {
    if (!client.aftSurvivalCurve || client.aftSurvivalCurve.length === 0) return [];
    return [...client.aftSurvivalCurve].sort((a, b) => a.day - b.day);
  }, [client.aftSurvivalCurve]);

  const maxDay = useMemo(() => {
    if (curve.length === 0) return 90;
    return Math.max(curve[curve.length - 1].day, 60);
  }, [curve]);

  // Days elapsed since last purchase (relative to globalToday)
  const daysPassed = useMemo(() => {
    const lp = new Date(client.lastPurchaseDate);
    if (isNaN(lp.getTime())) return 0;
    return Math.max(0, Math.ceil((globalToday.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24)));
  }, [client.lastPurchaseDate, globalToday]);

  // Current purchase probability (1 - survival)
  const currentPurchaseProb = useMemo(() => {
    if (curve.length === 0) return 0;
    let closest = curve[0];
    for (const pt of curve) {
      if (Math.abs(pt.day - daysPassed) < Math.abs(closest.day - daysPassed)) {
        closest = pt;
      }
    }
    return Math.round((1 - closest.probability) * 100);
  }, [curve, daysPassed]);

  // ── Coordinate mapping ─────────────────────────────────────
  const toX = useCallback((day: number) => CHART.padLeft + (day / maxDay) * plotW, [maxDay]);
  const toY = useCallback((prob: number) => CHART.padTop + (1 - prob) * plotH, []);

  // Build SVG path for the survival curve
  const curvePath = useMemo(() => {
    if (curve.length === 0) return '';
    return curve.map((pt, i) => {
      const x = toX(pt.day);
      const y = toY(pt.probability);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }, [curve, toX, toY]);

  // Area fill path (curve + close at bottom)
  const areaPath = useMemo(() => {
    if (curve.length === 0) return '';
    const last = curve[curve.length - 1];
    const first = curve[0];
    return `${curvePath} L${toX(last.day).toFixed(2)},${toY(0).toFixed(2)} L${toX(first.day).toFixed(2)},${toY(0).toFixed(2)} Z`;
  }, [curve, curvePath, toX, toY]);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  // X-axis ticks
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxDay <= 60 ? 10 : 15;
    for (let d = 0; d <= maxDay; d += step) ticks.push(d);
    return ticks;
  }, [maxDay]);

  // ── Handle mouse move for tooltip ──────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || curve.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scaleFactor = CHART.width / rect.width;
    const scaledX = mouseX * scaleFactor;

    // Map back to day
    const day = Math.max(0, Math.min(maxDay, ((scaledX - CHART.padLeft) / plotW) * maxDay));

    // Find closest point
    let closest = curve[0];
    for (const pt of curve) {
      if (Math.abs(pt.day - day) < Math.abs(closest.day - day)) {
        closest = pt;
      }
    }

    setTooltip({
      x: toX(closest.day),
      y: toY(closest.probability),
      day: closest.day,
      prob: closest.probability,
    });
  }, [curve, maxDay, toX, toY]);

  // ── AFT KPI values ─────────────────────────────────────────
  const ciclo = client.aftCicloEsperadoDias ?? client.averagePurchaseIntervalDays;
  const ventanaMin = client.aftDiasMinCompra ?? Math.round(ciclo * 0.7);
  const ventanaMax = client.aftDiasMaxCompra ?? Math.round(ciclo * 1.45);

  // Load templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        if (data.success && data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
          setSelectedTemplateId(data.templates[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  // Default WhatsApp message (just for preview if needed)
  // Template text preview removed since body is removed.
  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess(false);

    const t = templates.find(x => x.id === selectedTemplateId);
    if (!t) {
        setError("No hay plantilla seleccionada");
        setSending(false);
        return;
    }

    const vars = [client.businessName || '', client.estimatedNextPurchaseDate || ''];
    const components = [{
      type: 'body',
      parameters: vars.map(v => ({ type: 'text', text: String(v) }))
    }];

    try {
      const response = await fetch('http://localhost:3000/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: client.phone,
          templateName: t.id,
          components: components
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Error al enviar WhatsApp');
      }
    } catch (err: any) {
      setError(err.message || 'Error de red');
    } finally {
      setSending(false);
    }
  };

  if (curve.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full max-w-md rounded-xl bg-white shadow-lg p-8 text-center"
        >
          <p className="text-sm text-slate-500">No hay datos de curva de supervivencia para este cliente.</p>
          <button onClick={onClose} className="mt-4 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">Cerrar</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      id="survival-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-[640px] rounded-2xl bg-white shadow-xl flex flex-col overflow-hidden"
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <h3 className="font-display text-[15px] font-semibold text-slate-900 tracking-tight">
              {client.businessName}
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Último pedido: <span className="font-mono font-medium text-slate-600">{client.lastPurchaseDate}</span>
              </span>
              <span className="text-slate-200">|</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Hace <span className="font-mono font-medium text-slate-600">{daysPassed}</span> días
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition cursor-pointer -mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Chart ────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Curva de Supervivencia
            </span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-3">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CHART.width} ${CHART.height}`}
              className="w-full h-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Gradient fill */}
              <defs>
                <linearGradient id="survivalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#334155" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {yTicks.map(tick => (
                <line
                  key={`grid-y-${tick}`}
                  x1={CHART.padLeft}
                  x2={CHART.width - CHART.padRight}
                  y1={toY(tick)}
                  y2={toY(tick)}
                  stroke="#e2e8f0"
                  strokeWidth="0.5"
                />
              ))}

              {/* Y axis labels */}
              {yTicks.map(tick => (
                <text
                  key={`label-y-${tick}`}
                  x={CHART.padLeft - 8}
                  y={toY(tick) + 3}
                  textAnchor="end"
                  className="text-[9px] fill-slate-400"
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9px' }}
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              ))}

              {/* X axis labels */}
              {xTicks.map(tick => (
                <text
                  key={`label-x-${tick}`}
                  x={toX(tick)}
                  y={CHART.height - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400"
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9px' }}
                >
                  {tick}d
                </text>
              ))}

              {/* Axis label: Y */}
              <text
                x={12}
                y={CHART.padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90, 12, ${CHART.padTop + plotH / 2})`}
                className="fill-slate-350"
                style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.05em' }}
              >
                P(no recompra)
              </text>

              {/* Axis label: X */}
              <text
                x={CHART.padLeft + plotW / 2}
                y={CHART.height - 0}
                textAnchor="middle"
                className="fill-slate-350"
                style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.05em' }}
              >
                Días desde último pedido
              </text>

              {/* Purchase window shading */}
              <rect
                x={toX(ventanaMin)}
                y={CHART.padTop}
                width={Math.max(0, toX(ventanaMax) - toX(ventanaMin))}
                height={plotH}
                fill="#059669"
                opacity="0.04"
                rx="2"
              />

              {/* Area fill */}
              <path d={areaPath} fill="url(#survivalGrad)" />

              {/* Curve line */}
              <motion.path
                d={curvePath}
                fill="none"
                stroke="#1e293b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />

              {/* Median line (50%) */}
              <line
                x1={CHART.padLeft}
                x2={CHART.width - CHART.padRight}
                y1={toY(0.5)}
                y2={toY(0.5)}
                stroke="#94a3b8"
                strokeWidth="0.75"
                strokeDasharray="4 3"
              />
              <text
                x={CHART.width - CHART.padRight - 2}
                y={toY(0.5) - 4}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: '7px', fontFamily: 'ui-monospace, monospace' }}
              >
                mediana
              </text>

              {/* Current day marker */}
              {daysPassed > 0 && daysPassed <= maxDay && (
                <>
                  <line
                    x1={toX(daysPassed)}
                    x2={toX(daysPassed)}
                    y1={CHART.padTop}
                    y2={CHART.padTop + plotH}
                    stroke="#dc2626"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                    opacity="0.6"
                  />
                  <text
                    x={toX(daysPassed)}
                    y={CHART.padTop - 4}
                    textAnchor="middle"
                    className="fill-red-500"
                    style={{ fontSize: '8px', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}
                  >
                    HOY {globalToday.toLocaleDateString('es-ES', { timeZone: 'UTC' })} ({daysPassed}d)
                  </text>
                </>
              )}

              {/* Ciclo esperado marker */}
              {ciclo > 0 && ciclo <= maxDay && (
                <>
                  <line
                    x1={toX(ciclo)}
                    x2={toX(ciclo)}
                    y1={CHART.padTop}
                    y2={CHART.padTop + plotH}
                    stroke="#0891b2"
                    strokeWidth="0.75"
                    strokeDasharray="5 3"
                    opacity="0.5"
                  />
                </>
              )}

              {/* Tooltip */}
              {tooltip && (
                <>
                  {/* Crosshair */}
                  <line
                    x1={tooltip.x}
                    x2={tooltip.x}
                    y1={CHART.padTop}
                    y2={CHART.padTop + plotH}
                    stroke="#64748b"
                    strokeWidth="0.5"
                    strokeDasharray="2 2"
                    opacity="0.4"
                  />
                  <line
                    x1={CHART.padLeft}
                    x2={CHART.width - CHART.padRight}
                    y1={tooltip.y}
                    y2={tooltip.y}
                    stroke="#64748b"
                    strokeWidth="0.5"
                    strokeDasharray="2 2"
                    opacity="0.4"
                  />

                  {/* Dot */}
                  <circle
                    cx={tooltip.x}
                    cy={tooltip.y}
                    r="4"
                    fill="white"
                    stroke="#1e293b"
                    strokeWidth="2"
                  />

                  {/* Label */}
                  <g transform={`translate(${Math.min(tooltip.x + 10, CHART.width - CHART.padRight - 100)}, ${Math.max(tooltip.y - 28, CHART.padTop + 4)})`}>
                    <rect
                      x="0" y="0"
                      width="96" height="28"
                      rx="4"
                      fill="#1e293b"
                      opacity="0.92"
                    />
                    <text
                      x="8" y="12"
                      style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
                      fill="white"
                    >
                      Día {tooltip.day}
                    </text>
                    <text
                      x="8" y="22"
                      style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace' }}
                      fill="#94a3b8"
                    >
                      Surv: {(tooltip.prob * 100).toFixed(1)}% · Compra: {((1 - tooltip.prob) * 100).toFixed(1)}%
                    </text>
                  </g>
                </>
              )}
            </svg>
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────── */}
        <div className="px-6 pb-4 pt-1">
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Ciclo</span>
              <span className="text-sm font-bold text-slate-800 font-mono block">{ciclo}d</span>
              <span className="text-[9px] text-slate-400">Estimado</span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Ventana</span>
              <span className="text-sm font-bold text-slate-800 font-mono block">{ventanaMin}–{ventanaMax}d</span>
              <span className="text-[9px] text-slate-400">P20–P80</span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">P(compra)</span>
              <span className={`text-sm font-bold font-mono block ${currentPurchaseProb >= 80 ? 'text-red-600' : currentPurchaseProb >= 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {currentPurchaseProb}%
              </span>
              <span className="text-[9px] text-slate-400">hoy (día {daysPassed})</span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-0.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Predicción</span>
              <span className="text-sm font-bold text-slate-800 font-mono block">{client.estimatedNextPurchaseDate?.slice(5)}</span>
              <span className="text-[9px] text-slate-400">próx. compra</span>
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3 px-6 pb-5 pt-1">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-100">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-2">
            <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0 ml-1">Plantilla:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setSuccess(false);
                setError('');
              }}
              className="flex-1 bg-white border border-slate-200 rounded text-xs py-1.5 px-2 focus:outline-none focus:border-slate-300 text-slate-700 font-medium cursor-pointer"
            >
              <option value="" disabled>Selecciona plantilla...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSend}
              disabled={sending || success}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold text-white transition active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed ${success ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
            >
              {sending ? (
                <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
              ) : success ? (
                <Check className="h-3 w-3" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {success ? 'Mensaje Enviado' : 'Enviar Automático'}
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-[11px] px-4 py-2 transition cursor-pointer"
            >
              Cerrar
            </button>
            <div className="flex-1" />
            <span className="text-[9px] text-slate-350 italic">
              Modelo: LogNormal AFT · lifelines
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
