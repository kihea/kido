// Home: enter a topic, resume past topics (mastery persists), see review debt.

import { useEffect, useState } from 'react';
import { listTopics, type TopicRecord } from '../state/store';
import { LayerRail } from './LayerRail';

export function HomeScreen({
  dueCount,
  onBegin,
  onReview,
  onSettings,
}: {
  dueCount: number;
  onBegin: (topic: string) => void;
  onReview: () => void;
  onSettings: () => void;
}) {
  const [topic, setTopic] = useState('');
  const [recent, setRecent] = useState<TopicRecord[]>([]);

  useEffect(() => {
    void listTopics().then(setRecent);
  }, []);

  return (
    <div className="screen home">
      <header className="home-head">
        <span className="wordmark">KIDO</span>
        <nav className="home-nav">
          {dueCount > 0 && (
            <button type="button" className="btn-secondary" onClick={onReview}>
              Review · {dueCount} due
            </button>
          )}
          <button type="button" className="btn-quiet" onClick={onSettings} aria-label="Settings">
            Settings
          </button>
        </nav>
      </header>

      <main className="home-main">
        <h1 className="home-title">What do you want to understand?</h1>
        <form
          className="topic-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (topic.trim()) onBegin(topic);
          }}
        >
          <input
            autoFocus
            className="topic-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="gradient descent · the printing press · inflation · recursion"
            aria-label="Topic"
          />
          <button type="submit" disabled={!topic.trim()}>
            Research it
          </button>
        </form>
        <p className="home-sub">
          Real sources, verbatim. A layered profile of the idea. Practice aimed at what you're missing.
        </p>

        {recent.length > 0 && (
          <section className="recent">
            <h2 className="pane-title">Pick back up</h2>
            <div className="recent-grid">
              {recent.slice(0, 6).map((r) => (
                <button key={r.id} type="button" className="recent-card" onClick={() => onBegin(r.topic)}>
                  <span className="recent-topic">{r.topic}</span>
                  <LayerRail mastery={r.mastery} now={Date.now()} />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
