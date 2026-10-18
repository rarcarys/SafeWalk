import { useSettings } from "../context/SettingsContext";
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { avatarPalette } from '../data/contacts';
import * as api from '../services/circle';
import { subscribeLive } from '../services/live';
export default function useCircle() {
  const {
    t
  } = useSettings();
  const [people, setPeople] = useState({});
  const [invitations, setInvitations] = useState([]);
  const [blockedPeople, setBlockedPeople] = useState([]);
  const [contact, setContact] = useState(null);
  const [backupIds, setBackupIds] = useState([]);
  const [inspectedContact, setInspectedContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const saving = useRef(false);
  const revision = useRef(0);
  const apply = useCallback(result => {
    setInvitations(result.invitations || []);
    setBlockedPeople(result.blockedPeople || []);
    const nextPeople = Object.fromEntries(result.people.map((person, index) => [person.id, {
      ...avatarPalette[index % avatarPalette.length],
      ...person,
      letter: Array.from(person.name)[0]?.toUpperCase() || '?'
    }]));
    setPeople(current => JSON.stringify(current) === JSON.stringify(nextPeople) ? current : nextPeople);
    setContact(result.primaryId);
    setBackupIds(current => JSON.stringify(current) === JSON.stringify(result.backupIds) ? current : result.backupIds);
  }, []);
  const reload = useCallback(async (silent = false) => {
    if (saving.current) return;
    const version = revision.current;
    if (!silent) setLoading(true);
    try {
      const result = await api.loadContacts();
      if (mounted.current && version === revision.current) { apply(result); setError(''); }
    } catch (failure) {
      if (mounted.current) setError(failure.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [apply]);
  useEffect(() => {
    mounted.current = true;
    reload();
    const unsubscribe = subscribeLive(() => reload(true));
    const timer = setInterval(() => { if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') reload(true); }, 20000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') reload(true); });
    return () => {
      mounted.current = false;
      unsubscribe();
      clearInterval(timer); subscription.remove();
    };
  }, [reload]);
  const change = async operation => {
    if (saving.current) return false;
    if (loading || error) throw new Error(t("Сначала загрузите данные во вкладке «Контакты»."));
    saving.current = true;
    revision.current++;
    setBusy(true);
    try {
      const result = await operation();
      if (mounted.current) apply(result);
      return true;
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return {
    people,
    invitations,
    blockedPeople,
    respondInvitation: (peerId, decision) => change(() => api.respondInvitation(peerId, decision)),
    blockPerson: peerId => change(() => api.blockPerson(peerId)),
    unblockPerson: peerId => change(() => api.unblockPerson(peerId)),
    contact,
    backupIds,
    inspectedContact,
    setInspectedContact,
    loading,
    busy,
    error,
    reload,
    saveSelection: (primaryId, reserves) => change(() => api.saveSelection(primaryId, reserves)),
    addContact: body => change(() => api.addContact(body)),
    editContact: (id, body) => change(() => api.editContact(id, body)),
    deleteContact: id => change(() => api.deleteContact(id)),
    linkContact: (id, email) => change(() => api.linkContact(id, email))
  };
}
