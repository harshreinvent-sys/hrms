import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchDashboardStats } from '../api/dashboard';
import { toApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';

const scopeCopy = {
  ADMIN: { eyebrow: 'Whole company', title: 'Dashboard', note: 'Every employee on the register.' },
  MANAGER: { eyebrow: 'Your team', title: 'Dashboard', note: 'You and the people who report to you.' },
  EMPLOYEE: { eyebrow: 'Your record', title: 'Dashboard', note: 'Figures cover your own record only.' },
} as const;

function Figure({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border-t-2 border-ink pt-3">
      <p className="eyebrow">{label}</p>
      <p className="num mt-1 font-display text-[44px] font-medium leading-none text-ink">{value}</p>
      {sub && <p className="mt-1.5 text-[13px] text-ink-muted">{sub}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats });
  const copy = scopeCopy[user?.role ?? 'EMPLOYEE'];

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.note} />

      {stats.isPending && <Spinner label="Loading figures" />}
      {stats.isError && <ErrorBanner error={toApiError(stats.error)} title="Could not load the dashboard" />}

      {stats.data && (
        <>
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-3" aria-label="Headline figures">
            <Figure label="Total employees" value={stats.data.total} />
            <Figure label="Active" value={stats.data.active} sub={stats.data.total ? `${Math.round((stats.data.active / stats.data.total) * 100)}% of total` : undefined} />
            <Figure label="Inactive" value={stats.data.inactive} sub={stats.data.inactive === 0 ? 'None deactivated' : 'Deactivated accounts'} />
          </section>

          <section className="mt-10" aria-labelledby="dept-heading">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="dept-heading" className="text-xl">By department</h2>
              {user?.role !== 'EMPLOYEE' && (
                <Link to="/employees" className="text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                  Open the register →
                </Link>
              )}
            </div>

            {stats.data.byDepartment.length === 0 ? (
              <EmptyState title="No departments to show" />
            ) : (
              <DepartmentTable rows={stats.data.byDepartment} total={stats.data.total} />
            )}
          </section>
        </>
      )}
    </>
  );
}

function DepartmentTable({ rows, total }: { rows: { department: string; count: number }[]; total: number }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="border-y border-rule">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            <th scope="col" className="eyebrow border-b border-rule-strong px-3 py-2.5 text-left">Department</th>
            <th scope="col" className="eyebrow border-b border-rule-strong px-3 py-2.5 text-right">Employees</th>
            <th scope="col" className="eyebrow border-b border-rule-strong px-3 py-2.5 text-right">Share</th>
            <th scope="col" className="hidden w-1/3 border-b border-rule-strong px-3 py-2.5 sm:table-cell"><span className="sr-only">Proportion</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.department}>
              <td className="border-b border-rule px-3 py-2.5 font-medium">{row.department}</td>
              <td className="num border-b border-rule px-3 py-2.5 text-right">{row.count}</td>
              <td className="num border-b border-rule px-3 py-2.5 text-right text-ink-muted">{total ? Math.round((row.count / total) * 100) : 0}%</td>
              <td className="hidden border-b border-rule px-3 py-2.5 sm:table-cell">
                <div className="h-1.5 w-full bg-surface-2" aria-hidden>
                  <div className="h-full bg-clay" style={{ width: `${(row.count / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
