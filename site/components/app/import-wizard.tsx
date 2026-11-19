'use client';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { Button, ErrorMessage, request } from './ui';
type Sheet = { name: string; rows: string[][] };
type Preview = { id: string; accepted: number; quarantine: { row: number; reason: string }[] };
export default function ImportWizard({ onCommit }: { onCommit: () => void }) {
  const [sheets, setSheets] = useState<Sheet[]>([]),
    [sheet, setSheet] = useState(''),
    [source, setSource] = useState(''),
    [event, setEvent] = useState(''),
    [events, setEvents] = useState<{ id: string; title: string }[]>([]),
    [mapping, setMapping] = useState({ email: '', record: '', status: '' }),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    request<{ events: { id: string; title: string }[] }>('/api/workspace/events')
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message));
  }, []);
  const rows = sheets.find((s) => s.name === sheet)?.rows || [];
  const headers = rows[0] || [];
  const [acceptedRows, setAcceptedRows] = useState<{ email: string; record: string; status: string }[]>([]);
  function reset() {
    setPreview(null);
    setNotice('');
  }
  async function fileSelected(file: File) {
    reset();
    setError('');
    setBusy(true);
    setSheets([]);
    try {
      if (file.size > 2000000) throw Error('Choose a file smaller than 2 MB.');
      let parsed: Sheet[];
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const { default: read } = await import('read-excel-file/browser');
        parsed = (await read(file)).map((s) => ({
          name: s.sheet,
          rows: s.data.map((row) => row.map((cell) => (cell == null ? '' : String(cell)))),
        }));
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        const csv = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
        if (csv.errors.length) throw Error('CSV could not be read. Check separators and quoted fields.');
        parsed = [{ name: 'CSV', rows: csv.data }];
      } else throw Error('Choose CSV or XLSX.');
      if (parsed.some((s) => s.rows.length > 5001)) throw Error('Import at most 5,000 rows per sheet.');
      setSheets(parsed);
      setSource(file.name);
      setSheet(parsed.length === 1 ? parsed[0].name : '');
      setMapping({ email: '', record: '', status: '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel panel-body">
      <h2>Import event registrations</h2>
      <p>
        Choose a file, review its fields, then confirm the import. Existing memberships and codes stay intact.
      </p>
      <ErrorMessage error={error} />
      {notice && (
        <p role="status" className="member-notice">
          {notice}
        </p>
      )}
      <form
        className="standard-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const prepared = await Promise.all(
              rows.slice(1).map(async (row) => {
                const email = (row[Number(mapping.email)] || '').trim().toLowerCase();
                const record = mapping.record
                  ? row[Number(mapping.record)]
                  : Array.from(
                      new Uint8Array(
                        await crypto.subtle.digest(
                          'SHA-256',
                          new TextEncoder().encode('event:' + event + '\0' + email),
                        ),
                      ),
                    )
                      .map((b) => b.toString(16).padStart(2, '0'))
                      .join('');
                return {
                  email,
                  event: 'event:' + event,
                  record,
                  status: mapping.status ? row[Number(mapping.status)] || 'unknown' : 'unknown',
                };
              }),
            );
            const result = await request<Preview>('/api/community/admin', {
              action: 'import_preview',
              data: { source, rows: prepared },
            });
            const rejected = new Set(result.quarantine.map((q) => q.row));
            setAcceptedRows(prepared.filter((_row, index) => !rejected.has(index + 1)).slice(0, 20));
            setPreview(result);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend>1. Choose source</legend>
          <label>
            CSV or XLSX
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void fileSelected(file);
              }}
            />
          </label>
          {sheets.length > 0 && (
            <>
              <label>
                Authoritative sheet
                <select
                  required
                  value={sheet}
                  onChange={(e) => {
                    setSheet(e.target.value);
                    reset();
                    setMapping({ email: '', record: '', status: '' });
                  }}
                >
                  <option value="">Choose one sheet</option>
                  {sheets.map((s) => (
                    <option key={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Import source label
                <input
                  required
                  maxLength={200}
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    reset();
                  }}
                />
              </label>
            </>
          )}
        </fieldset>
        {sheet && (
          <fieldset disabled={busy}>
            <legend>2. Match columns and event</legend>
            <label>
              Event
              <select
                required
                value={event}
                onChange={(e) => {
                  setEvent(e.target.value);
                  reset();
                }}
              >
                <option value="">Choose an event</option>
                {events.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
            {!events.length && <p>Create an event draft in Events before importing.</p>}
            {(['email', 'record', 'status'] as const).map((key) => (
              <label key={key}>
                {key === 'email'
                  ? 'Email column'
                  : key === 'record'
                    ? 'Source record ID (optional)'
                    : 'Registration status (optional)'}
                <select
                  required={key === 'email'}
                  value={mapping[key]}
                  onChange={(e) => {
                    setMapping({ ...mapping, [key]: e.target.value });
                    reset();
                  }}
                >
                  <option value="">
                    {key === 'email'
                      ? 'Choose a column'
                      : key === 'record'
                        ? 'Generate a stable ID'
                        : 'Unknown'}
                  </option>
                  {headers.map((name, index) => (
                    <option key={index} value={String(index)}>
                      {name || 'Column ' + (index + 1)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p>
              {Math.max(0, rows.length - 1)} rows in this sheet. Only mapped registration fields are sent.
            </p>
            <Button disabled={!event || mapping.email === ''}>Preview import</Button>
          </fieldset>
        )}
      </form>
      {preview && (
        <section>
          <h3>3. Review and confirm</h3>
          <p>
            {preview.accepted} accepted · {preview.quarantine.length} quarantined
          </p>
          <p className="fineprint">
            Review the first {acceptedRows.length} accepted rows below. Duplicate registrations are added
            once. Existing codes remain unchanged.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Source record</th>
                  <th>Registration</th>
                </tr>
              </thead>
              <tbody>
                {acceptedRows.map((row, index) => (
                  <tr key={index}>
                    <td data-label="Email">{row.email}</td>
                    <td data-label="Source record">{row.record}</td>
                    <td data-label="Registration">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.quarantine.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.quarantine.map((q) => (
                  <tr key={q.row}>
                    <td>{q.row + 1}</td>
                    <td>{q.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Button
            disabled={busy || preview.accepted === 0}
            onClick={async () => {
              if (!confirm(`Add ${preview.accepted} registration rows from this preview?`)) return;
              setBusy(true);
              try {
                await request('/api/community/admin', { action: 'import_commit', data: { id: preview.id } });
                setPreview(null);
                setNotice('Import committed. Membership records are ready. No codes were allocated.');
                onCommit();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Commit reviewed import
          </Button>
        </section>
      )}
    </section>
  );
}
