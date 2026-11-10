import './globals.css';
import 'leaflet/dist/leaflet.css';
import { PreviewProvider } from '../components/PreviewProvider';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Food Safety Follow-Up | NYC manager workspace',
  description: 'Review public NYC inspection findings and document manager follow-ups for Sweetgreen locations.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><PreviewProvider><AppShell>{children}</AppShell></PreviewProvider></body></html>;
}
