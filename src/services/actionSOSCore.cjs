function createActionSOSProcessor(bridge) {
  let sending = false;
  let completedId;
  const acknowledge = id => {
    try { bridge.acknowledge(id); } catch { /* Retry clearing on the next poll. */ }
  };

  return async function processPending({ ownerId, ready, active, sendSOS, onResult, onError, now = Date.now() }) {
    if (!bridge || !ready || !active || sending) return;
    sending = true;
    let pending;
    try {
      pending = bridge.pendingRequest();
      if (!pending) return;
      if (pending.id === completedId) {
        acknowledge(pending.id);
        return;
      }
      if (pending.ownerId !== ownerId || typeof pending.id !== 'string'
        || !/^action_[a-zA-Z0-9_-]{1,100}$/.test(pending.id)
        || !Number.isFinite(pending.createdAt) || pending.createdAt > now
        || now - pending.createdAt >= 120000) {
        completedId = pending.id;
        acknowledge(pending.id);
        onError(new Error('Команда SOS устарела или относится к другому аккаунту. Повторите её.'));
        return;
      }
      const result = await sendSOS({ clientId: pending.id, includeLocation: false });
      completedId = pending.id;
      acknowledge(pending.id);
      onResult(result);
    } catch (error) {
      // A failed command is shown in the regular SOS dialog for an explicit retry.
      // Accepted or queued requests keep the same clientId for server deduplication.
      if (pending && pending.id !== completedId) {
        completedId = pending.id;
        acknowledge(pending.id);
      }
      onError(error);
    } finally {
      sending = false;
    }
  };
}

module.exports = { createActionSOSProcessor };
