import { Suspense } from 'react';
import FollowUpView from '../../../../../components/FollowUpView';
import { snapshotLocationParams } from '../../../../../lib/snapshotParams';

export async function generateStaticParams() { return snapshotLocationParams(); }

export const metadata = { title: 'Create follow-up | Food Safety Follow-Up' };

export default function Page() {
  return <Suspense fallback={<p>Loading follow-up…</p>}><FollowUpView mode="new" /></Suspense>;
}
