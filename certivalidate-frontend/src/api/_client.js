let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
if (!envUrl.endsWith('/api')) envUrl += '/api'
const API_BASE = envUrl
const DEFAULT_TIMEOUT_MS = 15000
export const SESSION_EXPIRED_EVENT = 'certiValidateSessionExpired'

class ApiError extends Error {
  constructor(message, statusCode, data = null) {
    super(message)
    this.statusCode = statusCode
    this.data = data
  }
}

const getToken = () => localStorage.getItem('token')
const getRefreshToken = () => localStorage.getItem('refreshToken')
const setTokens = (token, refreshToken) => {
  if (token) localStorage.setItem('token', token)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
}
const clearSession = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  localStorage.removeItem('accesos')
}

export const clearTokens = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('usuario')
}

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

const safeParseJson = async (response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { rawText: text }
  }
}

let isRefreshing = false
let refreshSubscribers = []

const notifyRefresh = (arg, failed = false) => {
  refreshSubscribers.forEach(({ resolve, reject }) => {
    if (failed) reject(arg)
    else resolve(arg)
  })
  refreshSubscribers = []
}

const addRefreshSubscriber = () =>
  new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject })
  })

const refreshAuthToken = async (refreshToken) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS,
  )
  try {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    })
    const refreshData = await safeParseJson(refreshRes)
    if (!refreshRes.ok || refreshData?.success === false) {
      throw new ApiError(
        refreshData?.message || 'No se pudo renovar la sesión.',
        refreshRes.status,
        refreshData,
      )
    }
    if (!refreshData?.data?.token || !refreshData?.data?.refreshToken) {
      throw new ApiError(
        'Respuesta de refresh inválida.',
        refreshRes.status,
        refreshData,
      )
    }
    if (getRefreshToken() === refreshToken) {
      setTokens(refreshData.data.token, refreshData.data.refreshToken)
    }
    return refreshData.data.token
  } finally {
    window.clearTimeout(timeout)
  }
}

const request = async (endpoint, options = {}) => {
  const {
    body,
    method = 'GET',
    auth = true,
    raw = false,
    headers: extraHeaders = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options

  const headers = { ...extraHeaders }
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const config = { method, headers, signal: controller.signal }
  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body)
  }

  const fetchWithRetry = async () => {
    let res
    try {
      res = await fetch(`${API_BASE}${endpoint}`, config)
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('La petición ha excedido el tiempo de espera.', 408)
      }
      throw error
    }

    if (raw) {
      return res
    }

    const data = await safeParseJson(res)
    if (!res.ok || data?.success === false) {
      throw new ApiError(
        data?.message || res.statusText || 'Error desconocido',
        res.status,
        data,
      )
    }
    return data
  }

  try {
    const response = await fetchWithRetry()
    if (response instanceof Response) {
      return response
    }
    return response
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.statusCode === 401 &&
      auth &&
      getRefreshToken()
    ) {
      if (!isRefreshing) {
        isRefreshing = true
        const currentRefreshToken = getRefreshToken()
        try {
          const newToken = await refreshAuthToken(currentRefreshToken)
          notifyRefresh(newToken)
          return await request(endpoint, options)
        } catch (refreshError) {
          notifyRefresh(refreshError, true)
          clearSession()
          dispatchSessionExpired()
          throw refreshError
        } finally {
          isRefreshing = false
        }
      }

      const newToken = await addRefreshSubscriber()
      headers['Authorization'] = `Bearer ${newToken}`
      return await request(endpoint, { ...options, headers })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export {
  request,
  getToken,
  getRefreshToken,
  setTokens,
  clearSession,
  ApiError,
  API_BASE,
  dispatchSessionExpired,
}
