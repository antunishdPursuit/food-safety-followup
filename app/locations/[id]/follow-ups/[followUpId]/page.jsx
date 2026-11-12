import FollowUpView from '../../../../../components/FollowUpView';
import { snapshotFollowUpParams } from '../../../../../lib/snapshotParams';

export async function generateStaticParams() { return snapshotFollowUpParams(); }

export const metadata = { title: 'Follow-up | Food Safety Follow-Up' };

export default function Page() {
  return <FollowUpView mode="edit" />;
}
