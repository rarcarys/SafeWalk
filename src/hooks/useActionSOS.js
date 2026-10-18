import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { actionSOS } from '../services/actionSOS';
import { createActionSOSProcessor } from '../services/actionSOSCore.cjs';

export default function useActionSOS({ ownerId, account, notify, setDialog, t }) {
  const latest = useRef();
  latest.current = { account, notify, setDialog, t };

  useEffect(() => {
    if (!actionSOS) return;
    let stopped = false;
    actionSOS.setOwner(ownerId);
    const processPending = createActionSOSProcessor(actionSOS);
    const check = () => {
      const current = latest.current;
      return processPending({
        ownerId,
        ready: !stopped && !current.account.loading && !current.account.busy,
        active: AppState.currentState === 'active',
        sendSOS: current.account.sendSOS,
        onResult: result => {
          if (stopped) return;
          current.setDialog(null);
          current.notify(current.t(result.queued
            ? 'SOS ожидает отправки. Сервер ещё не получил тревогу. Если нужна помощь, позвоните контакту.'
            : 'SOS добавлен в чаты: {value0}.{value1}', {
            value0: result.sentCount,
            value1: result.skippedNames?.length
              ? current.t(' По телефону свяжитесь вручную: {value0}.', { value0: result.skippedNames.join(', ') })
              : current.t(' Получатели увидят его в SafeWalk.'),
          }));
        },
        onError: error => {
          if (stopped) return;
          current.setDialog('sos');
          current.notify(current.t(error.message));
        },
      });
    };
    // Poll only while the app is active, including an intent run when already open.
    // This also catches a request saved before JavaScript finished its cold start.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
    });
    const timer = setInterval(check, 1000);
    void check();
    return () => {
      stopped = true;
      clearInterval(timer);
      subscription.remove();
      actionSOS.setOwner(null);
    };
  }, [ownerId]);
}
