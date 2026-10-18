import { request } from './api';
import { resolvePlaceAddress } from './maps';

export const actionKey = () => `action_${Date.now()}_${Math.random().toString(36).slice(2)}`;
export const loadJourneyState = () => request('journeys/state');
export const saveFavorite = async (slot, plan) => request(`journeys/favorites/${slot}`, { method: 'PUT', body: { ...plan, target: await resolvePlaceAddress(plan.target) } });
export const deleteFavorite = slot => request(`journeys/favorites/${slot}`, { method: 'DELETE', body: {} });
export const clearHistory = () => request('journeys/history', { method: 'DELETE', body: {} });
export const savePreferences = patch => request('journeys/preferences', { method: 'PUT', body: patch });
export const savePlace = async (slot, point) => request(`journeys/places/${slot}`, { method: 'PUT', body: await resolvePlaceAddress(point) });
export const deletePlace = slot => request(`journeys/places/${slot}`, { method: 'DELETE', body: {} });
export const startJourney = body => request('journeys', { method: 'POST', body });
export const journeyAction = (id, action, clientId) => request(`journeys/${encodeURIComponent(id)}/action`, { method: 'POST', body: { action, clientId } });
export const updatePosition = (id, position) => request(`journeys/${encodeURIComponent(id)}/position`, { method: 'PUT', body: { ...position, capturedAt: position.updatedAt ?? Date.now() } });
export const acknowledgeJourney = id => request(`journeys/${encodeURIComponent(id)}/acknowledge`, { method: 'POST', body: {} });
export const respondJourney = (id, decision) => request(`journeys/${encodeURIComponent(id)}/respond`, { method: 'POST', body: { decision } });
export const sendSOS = body => request('journeys/sos/send', { method: 'POST', body });
