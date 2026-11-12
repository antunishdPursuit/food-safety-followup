'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createApiClient } from '../lib/api';
import { usePreview } from './PreviewProvider';

const api = createApiClient();

export default function AccessForm() {
  const router = useRouter();
  const { reload } = usePreview();
  const [session, setSession] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.session().then(setSession).catch(() => setSession(null));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.signIn(code);
      reload();
      router.push('/locations');
    } catch (failure) {
      setError(failure.message || 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (session && !session.protected) {
    return <section className="page-error" role="status"><h1>No access code is needed</h1><p>This copy of the app has no access code, so changes are open.</p><Link href="/locations">Back to locations</Link></section>;
  }
  return <section className="form-main access-form" aria-labelledby="access-title">
    <h1 id="access-title">Manager access</h1>
    <p>{session?.protectReads ? 'Reading and saving both need the shared manager access code.' : 'Anyone can read the records. Saving a follow-up, linking records, or completing an action needs the shared manager access code.'}</p>
    <form onSubmit={submit}>
      <label htmlFor="access-code">Access code</label>
      <input id="access-code" type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'access-error' : undefined} />
      {error && <small id="access-error" className="error" role="alert">{error}</small>}
      <p className="form-disclaimer">The code is shared, not personal. Stay signed in for seven days, or sign out from the top of any page.</p>
      <div className="form-actions"><button className="primary-button" type="submit" disabled={busy || !code}>{busy ? 'Checking…' : 'Unlock'}</button><Link className="text-button" href="/locations">Cancel</Link></div>
    </form>
  </section>;
}
