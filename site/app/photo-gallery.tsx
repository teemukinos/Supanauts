'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArchivePhoto } from '../lib/event-archive';
import EventPhoto from './event-photo';

export default function PhotoGallery({
  photos,
  filters = true,
}: {
  photos: ArchivePhoto[];
  filters?: boolean;
}) {
  const [city, setCity] = useState('All cities');
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<ArchivePhoto | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = photos.filter((p) => city === 'All cities' || p.city === city);
  const index = selected ? shown.findIndex((p) => p.file === selected.file) : -1;
  useEffect(() => {
    if (!filters) return;
    const restore = () => {
      const q = new URLSearchParams(window.location.search);
      const next = q.get('city') || 'All cities';
      setCity(photos.some((p) => p.city === next) ? next : 'All cities');
      setLimit(Math.max(12, Math.min(photos.length, Number(q.get('limit')) || 12)));
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [filters, photos]);
  function changeFilter(nextCity: string, nextLimit: number) {
    setCity(nextCity);
    setLimit(nextLimit);
    if (filters) {
      const q = new URLSearchParams(window.location.search);
      nextCity === 'All cities' ? q.delete('city') : q.set('city', nextCity);
      nextLimit === 12 ? q.delete('limit') : q.set('limit', String(nextLimit));
      window.history.pushState(
        null,
        '',
        window.location.pathname + (q.size ? '?' + q : '') + window.location.hash,
      );
    }
  }

  useEffect(() => {
    if (!selected) return;
    const modal = dialog.current;
    modal?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      modal?.close();
      document.body.style.overflow = overflow;
    };
  }, [!!selected]);

  function step(offset: number) {
    setSelected(shown[(index + offset + shown.length) % shown.length]);
  }
  return (
    <>
      {filters && (
        <div className="gallery-filters" role="group" aria-label="Filter photos by city">
          {['All cities', ...new Set(photos.map((p) => p.city))].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={city === name}
              onClick={() => {
                changeFilter(name, 12);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <p className="gallery-count" role="status">
        {shown.length} {shown.length === 1 ? 'image' : 'images'}
        {city !== 'All cities' && ` · ${city}`} · Select an image to view it in full.
      </p>
      <div className="archive-gallery">
        {shown.slice(0, limit).map((photo, i) => (
          <figure key={photo.file} className={photo.height > photo.width ? 'is-portrait' : ''}>
            <button type="button" onClick={() => setSelected(photo)} aria-label={`View: ${photo.alt}`}>
              <EventPhoto
                file={photo.file}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                priority={i === 0}
                thumbnail
              />
            </button>
            <figcaption>
              <span>{photo.city}</span>
              <span>{photo.kind === 'film-still' ? 'Film still' : 'Event photo'}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {limit < shown.length && (
        <button type="button" className="outline gallery-more" onClick={() => changeFilter(city, limit + 12)}>
          Show more photos ({shown.length - limit} remaining)
        </button>
      )}
      <dialog
        ref={dialog}
        className="photo-viewer"
        aria-label="Event photo viewer"
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            step(1);
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            step(-1);
          }
        }}
      >
        {selected && (
          <div className="photo-viewer-content">
            <div className="photo-viewer-toolbar">
              <span>
                {selected.city} · {index + 1} / {shown.length}
              </span>
              <button
                type="button"
                autoFocus
                onClick={() => setSelected(null)}
                aria-label="Close photo viewer"
              >
                Close ✕
              </button>
            </div>
            <EventPhoto
              key={selected.file}
              file={selected.file}
              alt={selected.alt}
              width={selected.width}
              height={selected.height}
              priority
            />
            <p>
              {selected.alt}
              {selected.kind === 'film-still' && ' · Film still'}
            </p>
            <div className="photo-viewer-controls">
              <button type="button" onClick={() => step(-1)}>
                ← Previous
              </button>
              <button type="button" onClick={() => step(1)}>
                Next →
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
