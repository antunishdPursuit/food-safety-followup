import './globals.css';
import 'leaflet/dist/leaflet.css';
import { PreviewProvider } from '../components/PreviewProvider';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Food Safety Follow-Up | Manager preview',
  description: 'A prototype for reviewing NYC inspection findings and tracking follow-ups.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><PreviewProvider><AppShell>{children}</AppShell></PreviewProvider></body></html>;
}
