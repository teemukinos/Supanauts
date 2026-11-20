'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
export { Button } from '../ui/button';
export { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
export { Input } from '../ui/input';
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Status({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <div className="code-box">
        <code>{code}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setError('');
            } catch {
              setError('Select the code and copy it manually.');
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <span role="status" className={error ? 'fine-print' : 'sr-only'}>
        {error || (copied ? 'Code copied.' : '')}
      </span>
    </>
  );
}
export function Modal({
  title,
  children,
  onClose,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => before?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      aria-label={title}
    >
      <header className="between">
        <h2>{title}</h2>
        {dismissible && (
          <Button type="button" variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </Button>
        )}
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function ErrorMessage({ error, retry }: { error: string; retry?: () => void }) {
  return error ? (
    <div role="alert" className="member-error">
      <p>{error}</p>
      {retry && (
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <div className="skeleton" />
      <div className="skeleton" />
      <span>Loading…</span>
    </div>
  );
}
export function Pagination({
  page,
  total,
  size = 25,
  onPage,
}: {
  page: number;
  total: number;
  size?: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="table-footer">
      <span>
        {total} {total === 1 ? 'record' : 'records'} · Page {page} of {Math.max(1, Math.ceil(total / size))}
      </span>
      <div className="flex">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page * size >= total} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
export async function request<T>(url: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal,
      ...(data === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Error('Connection interrupted. Check your connection and try again. Your changes are still here.');
  }
  const result = await response.json().catch(() => null);
  if (response.status === 401) window.dispatchEvent(new Event('sessionchange'));
  if (!result) throw Error('The service did not respond correctly. Please try again.');
  if (!response.ok) {
    throw Error(result.error || 'Request failed. Please retry.');
  }
  return result;
}
export function pageNumber(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
}
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a');
      if (
        link &&
        link.target !== '_blank' &&
        link.href &&
        !link.href.endsWith('#') &&
        !window.confirm('Leave without saving your changes?')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', leave);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
}
