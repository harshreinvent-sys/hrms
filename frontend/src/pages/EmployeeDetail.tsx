import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deactivateEmployee, getEmployee } from '../api/employees';
import { toApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { Modal } from '../components/Modal';
import { RoleBadge, StatusBadge } from '../components/Badge';
import { editableFieldsFor } from '../lib/permissions';
import type { ApiError } from '../types/api';

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-rule py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="eyebrow">{label}</dt>
      <dd className={`text-[15px] ${mono ? 'num' : ''}`}>{children}</dd>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [deactivateError, setDeactivateError] = useState<ApiError | null>(null);

  const employee = useQuery({ queryKey: ['employee', id], queryFn: () => getEmployee(id), enabled: !!id });

  const deactivate = useMutation({
    mutationFn: () => deactivateEmployee(id),
    onSuccess: async () => {
      setConfirming(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee', id] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
    onError: (error) => setDeactivateError(toApiError(error)),
  });

  if (employee.isPending) return <Spinner label="Loading record" />;

  if (employee.isError) {
    const err = toApiError(employee.error);
    return (
      <>
        <PageHeader eyebrow="Employee" title={err.code === 'FORBIDDEN' ? 'Not available to you' : err.code === 'NOT_FOUND' ? 'No such employee' : 'Could not load'} />
        <ErrorBanner error={err} />
        <p className="mt-4 text-[14px]"><Link to="/employees" className="underline underline-offset-2">← Back to the register</Link></p>
      </>
    );
  }

  const e = employee.data;
  const editable = user ? editableFieldsFor(user, e) : new Set<string>();
  const canEdit = editable.size > 0;
  const canDeactivate = user?.role === 'ADMIN' && e.id !== user.employeeId && e.status === 'ACTIVE';
  const isSelf = user?.employeeId === e.id;

  return (
    <>
      <PageHeader
        eyebrow={<span className="num">{e.id}</span>}
        title={`${e.firstName} ${e.lastName}`}
        description={`${e.designation} · ${e.department}${isSelf ? ' · this is you' : ''}`}
        actions={
          <>
            {canEdit && <Button onClick={() => navigate(`/employees/${e.id}/edit`)}>Edit</Button>}
            {canDeactivate && <Button variant="danger" onClick={() => { setDeactivateError(null); setConfirming(true); }}>Deactivate</Button>}
          </>
        }
      />

      {e.status === 'INACTIVE' && (
        <div className="mb-5 border-l-2 border-clay bg-clay-tint px-3 py-2 text-[14px]">This employee is inactive. Their login is disabled.</div>
      )}
      <ErrorBanner error={deactivateError} title="Could not deactivate" />

      <dl className="border-t border-rule-strong">
        <Row label="Employee ID" mono>{e.id}</Row>
        <Row label="Email">{e.email}</Row>
        <Row label="Phone" mono>{e.phone ?? <span className="text-ink-faint">Not set</span>}</Row>
        <Row label="Department">{e.department}</Row>
        <Row label="Designation">{e.designation}</Row>
        <Row label="Reports to">
          {e.manager ? (
            user?.role === 'ADMIN' ? <Link to={`/employees/${e.manager.id}`} className="underline underline-offset-2 hover:text-accent-deep">{e.manager.name} <span className="num text-ink-faint">{e.manager.id}</span></Link>
            : <>{e.manager.name} <span className="num text-ink-faint">{e.manager.id}</span></>
          ) : <span className="text-ink-faint">—</span>}
        </Row>
        <Row label="Joined" mono>{e.joiningDate}</Row>
        <Row label="Role"><RoleBadge role={e.role} /></Row>
        <Row label="Status"><StatusBadge status={e.status} /></Row>
      </dl>

      {canEdit && (
        <p className="mt-4 text-[13px] text-ink-faint">
          You may edit: {[...editable].join(', ')}. Anything else is rejected by the API with a 403.
        </p>
      )}

      <p className="mt-8 text-[14px]"><Link to="/employees" className="text-ink-muted underline underline-offset-2 hover:text-ink">← Back to the register</Link></p>

      <Modal
        open={confirming}
        title={`Deactivate ${e.firstName} ${e.lastName}?`}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)}>Keep active</Button>
            <Button variant="danger" loading={deactivate.isPending} onClick={() => deactivate.mutate()}>Deactivate</Button>
          </>
        }
      >
        <p>The record stays on the register with status <strong className="text-ink">Inactive</strong>, and their login is disabled immediately. HR can reactivate later by editing the status.</p>
      </Modal>
    </>
  );
}
