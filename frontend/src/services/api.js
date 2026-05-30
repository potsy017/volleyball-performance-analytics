import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ---------------------------------------------------------------------------
// Athlete endpoints
// athlete objects now include athlete_internal_key (string, e.g. "VB-5406785896")
// All silver-table endpoints accept athlete_key=<athlete_internal_key>
// ---------------------------------------------------------------------------

export const athleteApi = {
  list: () => api.get('/athletes/').then(r => r.data),
  get: (id) => api.get(`/athletes/${id}`).then(r => r.data),
}

export const dashboardApi = {
  // params may include: { athlete_key, days }
  summary:      (params) => api.get('/dashboard/summary',       { params }).then(r => r.data),
  kpis:         (params) => api.get('/dashboard/kpis',          { params }).then(r => r.data),
  teamSnapshot: ()       => api.get('/dashboard/team-snapshot').then(r => r.data),
}

export const gymawareApi = {
  // params may include: { athlete_key, days, from_date, exercise }
  sessions:     (params) => api.get('/gymaware/sessions',      { params }).then(r => r.data),
  exercises:    (params) => api.get('/gymaware/exercises',     { params }).then(r => r.data),
  pb:           (params) => api.get('/gymaware/pb',            { params }).then(r => r.data),
  sessionVsPb:  (params) => api.get('/gymaware/session-vs-pb', { params }).then(r => r.data),
  velocityTrend:(params) => api.get('/gymaware/velocity-trend',{ params }).then(r => r.data),
  vlProfile:    (params) => api.get('/gymaware/vl-profile',    { params }).then(r => r.data),
}

export const catapultApi = {
  // params may include: { athlete_key, days, activity }
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
  // params may include: { athlete_key, days }
  recovery: (params) => api.get('/whoop/recovery',  { params }).then(r => r.data),
  hrvTrend: (params) => api.get('/whoop/hrv-trend', { params }).then(r => r.data),
  sleep:    (params) => api.get('/whoop/sleep',     { params }).then(r => r.data),
  workout:  (params) => api.get('/whoop/workout',   { params }).then(r => r.data),
}

export default api
