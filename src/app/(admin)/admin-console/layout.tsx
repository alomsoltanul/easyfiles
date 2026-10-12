import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Console',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The console's outermost shell. It sits outside the (site) group, so no site
 * header, footer or navigation reaches these pages — this is a separate
 * application that happens to be deployed from the same repository.
 *
 * There is no authentication check here on purpose: the login screen is a child
 * of this layout. The gate is in (dashboard)/layout.tsx.
 */
export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-1 flex-col bg-slate-100">{children}</div>;
}
