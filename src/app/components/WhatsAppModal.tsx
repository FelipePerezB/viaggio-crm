/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquareCode, Check, Copy, AlertCircle, Sparkles, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, WhatsAppTemplate } from '../types/types';

interface WhatsAppModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: (log: any) => void;
}

export default function WhatsAppModal({ client, onClose, onSuccess }: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showIntegrationCode, setShowIntegrationCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [sentSuccessLog, setSentSuccessLog] = useState<any | null>(null);

  // Fetch templates de WhatsApp desde el servidor
  useEffect(() => {
    setTemplates([{
      id: 'conversation_reviver',
      name: 'conversation_reviver',
      category: 'marketing',
      body: 'Hello there,\n\nJust a quick note to let you know that we\'re here to help with anything you might need. If you have any questions, please don\'t hesitate to send us a message.\n\nWe\'re always happy to assist!',
      placeholderCount: 0,
      placeholdersDescription: [],
      languageCode: 'en'
    }])
  }, [client]);

  const handleSelectTemplate = (temp: WhatsAppTemplate) => {
    setSelectedTemplate(temp);
    // Inicializar variables según placeholders de la plantilla
    let vars: string[] = [];
    if (temp.id === 'temp_reponer') {
      vars = [client.name, client?.businessName, client.preferredFlavor, client.estimatedNextPurchaseDate];
    } else if (temp.id === 'temp_promo') {
      vars = [client.name, client.preferredFlavor, client.estimatedNextPurchaseDate];
    } else if (temp.id === 'temp_estreno') {
      vars = [client.name, client?.businessName, client.estimatedNextPurchaseDate];
    } else {
      vars = Array(temp.placeholderCount).fill('');
    }
    setVariables(vars);
  };

  const handleVariableChange = (index: number, value: string) => {
    const updated = [...variables];
    updated[index] = value;
    setVariables(updated);
  };

  const currentPrevisualBody = () => {
    if (!selectedTemplate) return '';
    let body = selectedTemplate.body;
    variables.forEach((val, idx) => {
      body = body.replace(`{{${idx + 1}}}`, val || `[F${idx + 1}]`);
    });
    return body;
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    setErrorMsg('');

    try {
      const response = await fetch('http://localhost:3000/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          templateName: selectedTemplate.id,
          phone: client.phone,
          components: variables
        })
      });
      const data = await response.json();

      if (data.success) {
        setSimulatedCode(data.nodeIntegrationCode);
        onSuccess(data.log);
        setSentSuccessLog(data.log);
      } else {
        setErrorMsg(data.error || 'Error al enviar plantilla.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red al despachar mensaje de WhatsApp Cloud API.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div id="whatsapp-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-2xl rounded-xl bg-white shadow-lg max-h-[90vh] overflow-y-auto flex flex-col font-sans"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-800 flex items-center gap-2">
              <Send className="h-4 w-4 text-slate-500" />
              Enviar Plantilla WhatsApp
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cliente: <strong className="text-slate-600">{client?.businessName}</strong> ({client.name})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {sentSuccessLog ? (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-emerald-300">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 animate-pulse">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="font-display font-bold text-sm text-slate-800">
                  ¡Plantilla enviada con éxito (Simulador API Cloud)!
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
                  La notificación ha sido registrada correctamente en el historial del CRM. Puedes enviar el mensaje real a su WhatsApp Web o App Móvil pulsando el botón de abajo:
                </p>
              </div>

              {/* Contenedor del mensaje real */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[10px] font-bold text-emerald-650 uppercase tracking-wider block mb-2 font-display">
                  Mensaje a despachar
                </span>
                <div className="p-3.5 bg-slate-50 rounded-lg text-xs font-sans text-slate-700 leading-relaxed whitespace-pre-line border border-slate-100">
                  {currentPrevisualBody()}
                </div>
              </div>

              {/* Botones de acción final */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(currentPrevisualBody())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 transition active:scale-[0.98] cursor-pointer text-center shadow-md shadow-emerald-100"
                >
                  <Send className="h-4 w-4" />
                  Abrir WhatsApp Web (Envío Real)
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 transition cursor-pointer text-center"
                >
                  Terminar y volver al CRM
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Selector de Plantilla */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Plantilla
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {templates.map(temp => (
                    <button
                      type="button"
                      key={temp.id}
                      onClick={() => handleSelectTemplate(temp)}
                      className={`flex flex-col items-start p-3 rounded-lg border text-left transition cursor-pointer ${selectedTemplate?.id === temp.id
                        ? 'border-slate-800 bg-slate-50/50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/20'
                        }`}
                    >
                      <span className="font-semibold text-xs text-slate-800 leading-tight">
                        {temp.name.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[9px] mt-1 text-slate-400 font-mono capitalize">
                        Categoría: {temp.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                  {/* Formulario de Variables en Izquierda */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                      Rellenar placeholders
                    </h4>

                    <div className="space-y-3">
                      {variables.map((val, idx) => (
                        <div key={idx}>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Campo {idx + 1}: <span className="text-slate-600 font-normal">
                              ({selectedTemplate.placeholdersDescription[idx] || 'Sin descripción'})
                            </span>
                          </label>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleVariableChange(idx, e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-pink-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-100"
                            placeholder={`Ej: ${selectedTemplate.placeholdersDescription[idx] || ''}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        Destinatario WhatsApp
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${client.phone} (${client.name})`}
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Previsualización Teléfono en Derecha */}
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 relative overflow-hidden h-fit">
                    {/* Header celular chat */}
                    <div className="flex items-center gap-2 bg-slate-100 text-slate-800 p-2.5 rounded-lg mb-4 -mx-1 -mt-1 border-b border-slate-200">
                    </div>

                    {/* Globito de mensaje */}
                    <div className="bg-white rounded-lg p-3 text-[11px] text-slate-800 shadow-xs max-w-[90%] border border-slate-150 relative self-start mb-5 leading-normal">
                      <p className="whitespace-pre-line">{currentPrevisualBody()}</p>
                      <p className="text-[8px] text-slate-400 text-right mt-1 font-mono">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Botón de Enviar de WhatsApp */}
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition disabled:opacity-50 h-9 cursor-pointer"
                    >
                      {sending ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                      ) : (
                        <>
                          <Send className="h-3 w-3" />
                          Enviar Mensaje Oficial
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
