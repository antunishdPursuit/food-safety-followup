import LocationDetail from '../../../components/LocationDetail';
import { snapshotLocationParams } from '../../../lib/snapshotParams';

export async function generateStaticParams() { return snapshotLocationParams(); }

export const metadata = { title: 'Location review | Food Safety Follow-Up' };

export default function Page() {
  return <LocationDetail />;
}
