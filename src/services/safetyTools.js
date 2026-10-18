import { request } from './api';

export const loadSafetyTools = () => request('safety/state');
export const startSafetyTimer = body => request('safety/timers', { method: 'POST', body });
export const safetyTimerAction = (id, body) => request(`safety/timers/${encodeURIComponent(id)}/action`, { method: 'POST', body });
export const saveSafetyPreset = (slot, body) => request(`safety/presets/${slot}`, { method: 'PUT', body });
export const applySafetyPreset = slot => request(`safety/presets/${slot}/apply`, { method: 'POST', body: {} });
export const deleteSafetyPreset = slot => request(`safety/presets/${slot}`, { method: 'DELETE', body: {} });
export const createJourneyLink = body => request('safety/links', { method: 'POST', body });
export const revokeJourneyLink = id => request(`safety/links/${encodeURIComponent(id)}`, { method: 'DELETE', body: {} });
