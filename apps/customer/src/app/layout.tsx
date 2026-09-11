import './globals.css';

export const metadata = {
  title: 'ROZZI Marketplace — Shop. Order. Deliver.',
  description: 'Food, groceries, essentials, gadgets and more delivered locally with ROZZI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
