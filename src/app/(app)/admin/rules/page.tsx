import { Info } from 'lucide-react';
import { RuleRow } from '@/components/admin/RuleRow';
import { Card } from '@/components/ui/Card';
import { NoAccess } from '@/components/ui/Notice';
import { PageBody, PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { hasRole, requireSession } from '@/lib/auth';
import { loadRules } from '@/lib/data';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Rules · VeriScale' };

export default async function RulesPage() {
  const { profile } = await requireSession();
  if (!hasRole(profile, ['admin'])) return <NoAccess />;

  const rules = await loadRules(await createServerSupabase());

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administration' }, { label: 'Rules' }]} />
      <PageBody className="max-w-[960px]">
        <Card
          title="Allowed error rules — OIML R 76, Table 6"
          subtitle="Pass/Fail results are worked out from this table."
          actions={<Pill>2006 edition</Pill>}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="bg-page text-left text-[11.5px] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Accuracy class</th>
                  <th className="px-5 py-2.5 text-right font-medium">Load range (scale steps)</th>
                  <th className="px-5 py-2.5 text-right font-medium">Allowed error</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, i) => (
                  <RuleRow key={rule.id} rule={rule} firstOfClass={i === 0 || rules[i - 1].accuracy_class !== rule.accuracy_class} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="flex items-start gap-2 px-1 text-[12.5px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 shrink-0" />
          Allowed error is shown in verification intervals (e) and doubles for in-service inspections. Changing a value
          updates Pass/Fail for drafts straight away; submitted reports keep the results they were checked with.
        </p>
      </PageBody>
    </>
  );
}
