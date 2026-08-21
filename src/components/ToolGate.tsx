import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { getEntitlements } from '@/lib/auth';
import { effectiveAccess, isToolEnabled } from '@/lib/tool-flags';
import UpgradeCard from './UpgradeCard';

/**
 * Wraps the interactive part of a tool page.
 *
 *   <ToolLayout title=… description=… infoCards=…>
 *     <ToolGate slug="/pdf/ocr">
 *       <PdfOCR />
 *     </ToolGate>
 *   </ToolLayout>
 *
 * Order matters here. The flag lookup is cookie-free, so a tool that is free
 * right now returns before any request-time API is touched and the page stays
 * prerendered — which is what keeps the 44 free tools fast and indexable. Only
 * a paid tool reaches connection() and becomes per-request.
 */
export default async function ToolGate({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  if (!(await isToolEnabled(slug))) {
    // Taken offline from the console. A 404 is the honest answer, and it keeps
    // the page out of the index while it is down.
    notFound();
  }

  const access = await effectiveAccess(slug);
  if (access === 'free') return <>{children}</>;

  /*
   * Paid tool: force a per-request render. Without this the page can be
   * prerendered at build time — which happens whenever Supabase env vars are
   * missing, since then no cookie is ever read — and the upgrade card would be
   * baked into the static HTML for paying users too.
   */
  await connection();

  const entitlements = await getEntitlements();
  if (entitlements.limits.proTools) return <>{children}</>;

  return <UpgradeCard slug={slug} signedIn={entitlements.signedIn} />;
}
