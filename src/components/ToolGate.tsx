import { connection } from 'next/server';
import { getEntitlements } from '@/lib/auth';
import { isProTool } from '@/lib/tool-access';
import UpgradeCard from './UpgradeCard';

/**
 * Wraps the interactive part of a paid tool page.
 *
 *   <ToolLayout title=… description=… infoCards=…>
 *     <ToolGate slug="/pdf/ocr">
 *       <PdfOCR />
 *     </ToolGate>
 *   </ToolLayout>
 *
 * A free tool passes straight through, so this is safe to wrap anything with.
 * Reading entitlements makes the page dynamic — deliberate, and limited to the
 * 12 paid tools; the other 44 stay static.
 */
export default async function ToolGate({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  if (!isProTool(slug)) return <>{children}</>;

  /*
   * Force a per-request render. Without this the page can be prerendered at
   * build time — which happens whenever Supabase env vars are missing, since
   * then no cookie is ever read — and the upgrade card would be baked into the
   * static HTML for paying users too.
   */
  await connection();

  const entitlements = await getEntitlements();
  if (entitlements.limits.proTools) return <>{children}</>;

  return <UpgradeCard slug={slug} signedIn={entitlements.signedIn} />;
}
