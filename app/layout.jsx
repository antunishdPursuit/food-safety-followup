import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'Food Safety Follow-Up | Manager preview',
  description: 'A prototype for reviewing NYC inspection findings and tracking follow-ups.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
