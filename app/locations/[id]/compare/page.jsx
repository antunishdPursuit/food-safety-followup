import { Suspense } from 'react';
import ComparisonView from '../../../../components/ComparisonView';

export const metadata = { title: 'Sample record review | Food Safety Follow-Up' };

export default function Page() {
  return <Suspense fallback={<p>Loading comparison…</p>}><ComparisonView /></Suspense>;
}
