'use client';
import { useEffect, useState } from 'react';
export function Media({ id, title }: { id: string; title: string }) {
  const [type, setType] = useState(''),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setType('');
    setError(false);
    fetch('/api/media/' + id, { method: 'HEAD', signal: controller.signal, cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw Error('Unavailable');
        const mime = r.headers.get('content-type') || '';
        if (!/^(image|video)\//.test(mime)) throw Error('Unsupported');
        if (!controller.signal.aborted) setType(mime);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [id, attempt]);
  if (error)
    return (
      <div className="fineprint">
        <p>Attachment unavailable.</p>
        <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>
          Retry attachment
        </button>
      </div>
    );
  if (!type)
    return (
      <p className="fineprint" role="status">
        Loading attachment…
      </p>
    );
  return type.startsWith('video/') ? (
    <video
      className="project-media"
      src={'/api/media/' + id}
      controls
      preload="metadata"
      aria-label={title || 'Project video'}
      onError={() => setError(true)}
    />
  ) : (
    <img
      className="project-media"
      src={'/api/media/' + id}
      alt={title || 'Project attachment'}
      onError={() => setError(true)}
    />
  );
}
