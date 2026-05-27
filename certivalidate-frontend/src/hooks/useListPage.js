import { useState, useEffect, useCallback } from 'react'
import { useConfirm, useToast } from '../components/ui/ToastProvider'

/**
 * Hook genérico para páginas CRUD con lista paginada o plana.
 *
 * @param {object} api           - Módulo API con métodos listar, crear, actualizar y el método de borrado
 * @param {object} options
 *   @param {object}  initialForm       - Estado inicial del formulario
 *   @param {number}  limit             - Registros por página (default 10)
 *   @param {number}  debounceMs        - Delay del debounce de búsqueda (default 300)
 *   @param {string}  dataKey           - Clave para extraer el array del response paginado (ej: 'estudiantes')
 *   @param {string}  removeMethod      - Método del api para borrar: 'eliminar' | 'archivar' | 'desactivar'
 *   @param {string}  removeConfirmMsg  - Mensaje del confirm antes de borrar
 */
export const useListPage = (
  api,
  {
    initialForm = {},
    limit = 10,
    debounceMs = 300,
    dataKey = null,
    removeMethod = 'eliminar',
    removeConfirmMsg = '¿Eliminar este registro? Esta acción no se puede deshacer.',
  } = {},
) => {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [search, setSearch] = useState('')
  const [debSearch, setDebSearch] = useState('')
  const [filters, setFilters] = useState({})

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState('')

  const { confirm } = useConfirm()
  const { showToast } = useToast()

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      setDebSearch(search)
      setPage(1)
    }, debounceMs)
    return () => clearTimeout(t)
  }, [search, debounceMs])

  const load = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const res = await api.listar({
        page,
        limit,
        search: debSearch || undefined,
        ...filters,
      })
      if (Array.isArray(res)) {
        setItems(res)
        setTotalPages(1)
      } else {
        const key =
          dataKey || Object.keys(res).find((k) => Array.isArray(res[k]))
        setItems(res[key] ?? [])
        setTotalPages(res.totalPages ?? res.meta?.totalPages ?? 1)
      }
    } catch (err) {
      setListError(err.message)
    } finally {
      setLoading(false)
    }
  }, [api, page, limit, debSearch, filters, dataKey])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = (overrideForm) => {
    setEditing(null)
    setForm(overrideForm !== undefined ? overrideForm : initialForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (item, formMapper) => {
    setEditing(item.id)
    setForm(formMapper ? formMapper(item) : { ...item })
    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setFormError('')
  }

  // El submit recibe opcionalmente un payload transformado (para casos como parseInt de versión)
  const handleSubmit = async (e, payloadTransform) => {
    e.preventDefault()
    setFormError('')
    const payload = payloadTransform ? payloadTransform(form) : form
    try {
      if (editing) {
        await api.actualizar(editing, payload)
      } else {
        await api.crear(payload)
      }
      setShowForm(false)
      setPage(1)
      load()
    } catch (err) {
      setFormError(err.message)
    }
  }

  const handleRemove = async (id) => {
    const confirmed = await confirm(removeConfirmMsg, 'Confirmar eliminación')
    if (!confirmed) return
    try {
      await api[removeMethod](id)
      load()
    } catch (err) {
      showToast(err.message || 'Error al procesar la acción.', 'error')
    }
  }

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  return {
    // Lista
    items,
    page,
    totalPages,
    loading,
    listError,
    setPage,
    load,
    // Búsqueda y filtros
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    // Formulario / modal
    showForm,
    editing,
    form,
    setForm,
    formError,
    openCreate,
    openEdit,
    closeForm,
    handleSubmit,
    handleRemove,
  }
}
