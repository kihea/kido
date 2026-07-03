// App shell: settings, routing, theme. Contains no engine logic — it wires
// screens to the session hook and the store (docs/ARCHITECTURE.md).

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, allDueReviews, loadSettings, saveSettings, type Settings } from '../state/store';
import { getKV } from '../state/kv';
import { useSession } from './useSession';
import { HomeScreen } from './HomeScreen';
import { SessionScreen } from './SessionScreen';
import { ReviewScreen } from './ReviewScreen';
import { SettingsScreen } from './SettingsScreen';

type View = 'home' | 'session' | 'review' | 'settings';

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<View>('home');
  const [dueCount, setDueCount] = useState(0);
  const [storageBackend, setStorageBackend] = useState('memory');
  const session = useSession(settings);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void getKV().then((kv) => setStorageBackend(kv.backend));
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = settings.theme;
  }, [settings.theme]);

  const refreshDue = useCallback(() => {
    void allDueReviews(Date.now()).then((d) => setDueCount(d.length));
  }, []);

  useEffect(() => {
    if (view === 'home') refreshDue();
  }, [view, refreshDue]);

  const begin = useCallback(
    (topic: string) => {
      setView('session');
      void session.begin(topic);
    },
    [session],
  );

  const exitSession = useCallback(() => {
    session.reset();
    setView('home');
  }, [session]);

  switch (view) {
    case 'home':
      return (
        <HomeScreen
          dueCount={dueCount}
          onBegin={begin}
          onReview={() => setView('review')}
          onSettings={() => setView('settings')}
        />
      );
    case 'session':
      return (
        <SessionScreen
          session={session}
          hasModel={settings.model.kind !== 'none'}
          settings={settings}
          onSettings={(s) => {
            setSettings(s);
            void saveSettings(s);
          }}
          onExit={exitSession}
        />
      );
    case 'review':
      return <ReviewScreen onExit={() => setView('home')} />;
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          storageBackend={storageBackend}
          onSave={(s) => {
            setSettings(s);
            void saveSettings(s);
            setView('home');
          }}
          onExit={() => setView('home')}
        />
      );
  }
}
