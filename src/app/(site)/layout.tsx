import AppHeader from '@/components/AppHeader';
import GlobalFooter from '@/components/GlobalFooter';

/**
 * The public site: every tool, the pricing page and customer accounts.
 *
 * This is where the header and footer live. Routes outside this group — the
 * admin console — get no site chrome at all, which is the point of the split.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="flex-1">{children}</main>
      <GlobalFooter />
    </>
  );
}
