import { CheckCircle2, XCircle, X } from 'lucide-react'

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null

  const isSuccess = toast.type === 'success'

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50 flex items-start gap-3
        px-4 py-3.5 rounded-xl shadow-xl border
        min-w-64 max-w-sm animate-slide-in
        ${isSuccess
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-red-50 border-red-200 text-red-900'
        }
      `}
    >
      {isSuccess
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      }
      <div className="flex-1">
        <p className="text-sm font-semibold">
          {isSuccess ? 'Éxito' : 'Error'}
        </p>
        <p className="text-xs mt-0.5 opacity-80">{toast.msg}</p>
      </div>
      <button
        onClick={onDismiss}
        className={`p-0.5 rounded transition-colors flex-shrink-0 ${
          isSuccess ? 'hover:bg-emerald-100 text-emerald-500' : 'hover:bg-red-100 text-red-500'
        }`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
