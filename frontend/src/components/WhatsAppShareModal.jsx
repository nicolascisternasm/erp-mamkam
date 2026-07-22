import { MessageCircle, X, Send, ExternalLink } from 'lucide-react'

export default function WhatsAppShareModal({ open, waUrl, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="bg-emerald-500 rounded-t-2xl px-6 py-5 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg">Listo para enviar</h3>
          <p className="text-emerald-100 text-xs mt-1">
            El mensaje incluye el link de la cotización
          </p>
        </div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/70 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 text-center leading-relaxed">
            WhatsApp se abrirá con el mensaje listo.
            El cliente recibirá un enlace para ver la cotización completa en línea.
          </p>

          <div className="mt-4 bg-slate-50 rounded-xl p-3 flex items-start gap-2">
            <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              El enlace funciona en cualquier dispositivo, sin necesidad de descargar nada ni iniciar sesión.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors"
          >
            <Send className="w-4 h-4" />
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
