import axios from 'axios'
import { supabase } from '../context/AuthContext'

// Production: set VITE_API_URL at build time (e.g. Railway).
// Local dev: use /api so Vite proxies to the backend (avoids CORS localhost vs 127.0.0.1).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach Supabase JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export const athleteApi = {
  list: () => api.get('/athletes/').then(r => r.data),
  get: (id) => api.get(`/athletes/${id}`).then(r => r.data),
}

export const dashboardApi = {
  summary:      (params) => api.get('/dashboard/summary',       { params }).then(r => r.data),
  kpis:         (params) => api.get('/dashboard/kpis',          { params }).then(r => r.data),
  teamSnapshot: ()       => api.get('/dashboard/team-snapshot').then(r => r.data),
}

export const gymawareApi = {
  sessions:     (params) => api.get('/gymaware/sessions',      { params }).then(r => r.data),
  exercises:    (params) => api.get('/gymaware/exercises',     { params }).then(r => r.data),
  pb:           (params) => api.get('/gymaware/pb',            { params }).then(r => r.data),
  sessionVsPb:  (params) => api.get('/gymaware/session-vs-pb', { params }).then(r => r.data),
  velocityTrend:(params) => api.get('/gymaware/velocity-trend',{ params }).then(r => r.data),
  vlProfile:    (params) => api.get('/gymaware/vl-profile',    { params }).then(r => r.data),
  loadVelocityAnalysis: (params) => api.get('/gymaware/load-velocity-analysis', { params }).then(r => r.data),
}

export const catapultApi = {
  sessions:   (params) => api.get('/catapult/sessions',   { params }).then(r => r.data),
  activities: (params) => api.get('/catapult/activities', { params }).then(r => r.data),
  loadTrend:  (params) => api.get('/catapult/load-trend', { params }).then(r => r.data),
  acwrTrend:  (params) => api.get('/catapult/acwr-trend', { params }).then(r => r.data),
}

export const valdApi = {
  tests:     (params) => api.get('/vald/tests',      { params }).then(r => r.data),
  testTypes: ()       => api.get('/vald/test-types').then(r => r.data),
  summary:   (params) => api.get('/vald/summary',    { params }).then(r => r.data),
}

export const whoopApi = {
  recovery: (params) => api.get('/whoop/recovery',  { params }).then(r => r.data),
  hrvTrend: (params) => api.get('/whoop/hrv-trend', { params }).then(r => r.data),
  sleep:    (params) => api.get('/whoop/sleep',     { params }).then(r => r.data),
  workout:  (params) => api.get('/whoop/workout',   { params }).then(r => r.data),
}

export default api
