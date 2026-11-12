'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createApiClient } from '../lib/api';

const api = createApiClient();

// Shows nothing unless the server has an access code. Otherwise it says whether this browser can change records,
// and offers the way to sign in or out.
export default function AccessControl() {
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  useEffect(() => {
    api.session().then(setSession).catch(() => setSession(null));
  }, [pathname]);
  if (!session?.protected) return null;
  if (session.signedIn) {
    return <span className="access-control">Manager access · <button className="text-button" onClick={async () => { await api.signOut().catch(() => {}); setSession({ ...session, signedIn: false }); }}>Sign out</button></span>;
  }
  return <span className="access-control">{session.protectReads ? 'Locked' : 'Read only'} · <Link href="/access">Enter access code</Link></span>;
}
