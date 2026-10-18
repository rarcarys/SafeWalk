import { request } from './api';

export const loadContacts = () => request('circle/contacts');
export const respondInvitation = (peerId, decision) => request(`circle/invitations/${encodeURIComponent(peerId)}/respond`, { method: 'POST', body: { decision } });
export const blockPerson = peerId => request(`circle/blocks/${encodeURIComponent(peerId)}`, { method: 'POST', body: {} });
export const unblockPerson = peerId => request(`circle/blocks/${encodeURIComponent(peerId)}`, { method: 'DELETE', body: {} });
export const addContact = body => request('circle/contacts', { method: 'POST', body });
export const editContact = (id, body) => request(`circle/contacts/${encodeURIComponent(id)}`, { method: 'PUT', body });
export const deleteContact = id => request(`circle/contacts/${encodeURIComponent(id)}`, { method: 'DELETE', body: {} });
export const linkContact = (id, email) =>
  request(`circle/contacts/${encodeURIComponent(id)}/link`, { method: 'PUT', body: { email } });
export const saveSelection = (primaryId, backupIds) =>
  request('circle/selection', { method: 'PUT', body: { primaryId, backupIds } });
export const loadChats = () => request('circle/chats');
export const reactToMessage = (peerId, messageId, emoji) => request(`circle/chats/${encodeURIComponent(peerId)}/messages/${messageId}/reaction`, { method: 'PUT', body: { emoji } });
export const loadMessages = (peerId, query = '') =>
  request(`circle/chats/${encodeURIComponent(peerId)}/messages${query}`);
export const sendMessage = (peerId, text, clientId) =>
  request(`circle/chats/${encodeURIComponent(peerId)}/messages`, { method: 'POST', body: { text, clientId } });
export const markChatRead = (peerId, lastId) => request(`circle/chats/${encodeURIComponent(peerId)}/read`, { method: 'PUT', body: { lastId } });
