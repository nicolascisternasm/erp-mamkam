import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { ConfirmModal } from '../../components/Modal'
import Toast from '../../components/Toast'
import EmptyState from '../../components/EmptyState'
import {
  Building2, Plus, Pencil, Trash2, Search, X, Save,
} from 'lucide-react'

const EMPTY = { nombre: '', rut: '', email: '', telefono: '', direccion: '', comuna: '' }

function ProveedorModal({ open, initial, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : { ...EMPTY })
  }, [open, initial])

  if (!open) return null
  const valid = form.nombre.trim() && form.rut.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">
            {initial ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label-base">Nombre / Razón Social *</label>
              <input
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                className="input-base"
                placeholder="Empresa o persona"
                autoFocus
              />
            </div>
            <div>
              <label className="label-base">RUT *</label>
              <input
                value={form.rut}
                onChange={e => set('rut', e.target.value)}
                className="input-base"
                placeholder="76.111.111-1"
              />
            </div>
            <div>
              <label className="label-base">Email</label>
              <input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="input-base"
                placeholder="ventas@proveedor.cl"
              />
            </div>
            <div>
              <label className="label-base">Teléfono</label>
              <input
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                className="input-base"
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div>
              <label className="label-base">Comuna</label>
              <input
                value={form.comuna}
                onChange={e => set('comuna', e.target.value)}
                className="input-base"
                placeholder="Santiago"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-base">Dirección</label>
              <input
                value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
                className="input-base"
                placeholder="Av. Ejemplo 1234"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            disabled={!valid}
            onClick={() => onSave(form)}
            className="btn-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProveedoresPage() {
  const { proveedores, addProveedor, updateProveedor, deleteProveedor } = useApp()
  const [search,    setSearch]    = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [deleteId,  setDeleteId]  = useState(null)
  const [toast,     setToast]     = useState(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const filtered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.rut || '').includes(search) ||
    (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.comuna || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (form) => {
    if (editing) {
      updateProveedor(editing.id, form)
      showToast('success', `Proveedor "${form.nombre}" actualizado`)
    } else {
      addProveedor(form)
      showToast('success', `Proveedor "${form.nombre}" creado`)
    }
    setModalOpen(false)
    setEditing(null)
  }

  const handleEdit = (prov) => {
    setEditing(prov)
    setModalOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const handleDelete = () => {
    const prov = proveedores.find(p => p.id === deleteId)
    deleteProveedor(deleteId)
    showToast('success', `Proveedor eliminado`)
    setDeleteId(null)
  }

  const toDelete = proveedores.find(p => p.id === deleteId)

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Proveedores</h2>
          <p className="text-sm text-slate-500 mt-0.5">{proveedores.length} registrados</p>
        </div>
        <button onClick={handleNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Proveedor</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUT, email o comuna..."
            className="input-base pl-9"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Sin proveedores"
            description={search ? 'No hay resultados para tu búsqueda.' : 'Agrega tu primer proveedor.'}
            action={
              !search && (
                <button onClick={handleNew} className="btn-primary">
                  <Plus className="w-4 h-4" /> Nuevo Proveedor
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Nombre</th>
                  <th className="table-th">RUT</th>
                  <th className="table-th hidden sm:table-cell">Email</th>
                  <th className="table-th hidden md:table-cell">Teléfono</th>
                  <th className="table-th hidden lg:table-cell">Comuna</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((prov) => (
                  <tr key={prov.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-medium text-slate-800">{prov.nombre}</td>
                    <td className="table-td font-mono text-xs text-slate-500">{prov.rut || '—'}</td>
                    <td className="table-td hidden sm:table-cell text-slate-500 text-sm">
                      {prov.email
                        ? <a href={`mailto:${prov.email}`} className="hover:text-indigo-600">{prov.email}</a>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td hidden md:table-cell text-slate-500 text-sm">
                      {prov.telefono || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td hidden lg:table-cell text-slate-500 text-sm">
                      {prov.comuna || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(prov)}
                          title="Editar"
                          className="btn-ghost p-1.5 text-slate-400 hover:text-indigo-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(prov.id)}
                          title="Eliminar"
                          className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProveedorModal
        open={modalOpen}
        initial={editing}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditing(null) }}
      />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={`¿Eliminar "${toDelete?.nombre}"?`}
        message="Esta acción no se puede deshacer. Las órdenes de compra que referenciaban este proveedor conservarán su nombre."
        confirmLabel="Eliminar"
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
