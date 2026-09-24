import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe } from '../api/auth';
import { updateEmployee } from '../api/employees';
import { toApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { Button } from '../components/Button';
import { TextField } from '../components/FormField';
import { RoleBadge, StatusBadge } from '../components/Badge';
import type { ApiError, Employee } from '../types/api';

const phoneSchema = z.object({
  phone: z.string().trim().min(6, 'At least 6 characters').max(20, 'At most 20 characters').or(z.literal('')),
});
type PhoneForm = z.infer<typeof phoneSchema>;

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-rule py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="eyebrow">{label}</dt>
      <dd className={`text-[15px] ${mono ? 'num' : ''}`}>{children}</dd>
    </div>
  );
}

export function MyProfilePage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  return (
    <>
      <PageHeader
        eyebrow="My profile"
        title={me.data ? `${me.data.firstName} ${me.data.lastName}` : 'My profile'}
        description="What the company holds about you. You may update your phone number; everything else is maintained by HR."
      />

      {me.isPending && <Spinner label="Loading your record" />}
      {me.isError && <ErrorBanner error={toApiError(me.error)} title="Could not load your profile" />}

      {me.data && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <dl className="border-t border-rule-strong">
            <Row label="Employee ID" mono>{me.data.id}</Row>
            <Row label="Email">{me.data.email}</Row>
            <Row label="Phone" mono>{me.data.phone ?? <span className="text-ink-faint">Not set</span>}</Row>
            <Row label="Department">{me.data.department}</Row>
            <Row label="Designation">{me.data.designation}</Row>
            <Row label="Reports to">{me.data.manager ? `${me.data.manager.name} · ${me.data.manager.id}` : <span className="text-ink-faint">—</span>}</Row>
            <Row label="Joined" mono>{me.data.joiningDate}</Row>
            <Row label="Role"><RoleBadge role={me.data.role} /></Row>
            <Row label="Status"><StatusBadge status={me.data.status} /></Row>
          </dl>

          <PhoneEditor employee={me.data} onSaved={(updated) => queryClient.setQueryData(['me'], updated)} />
        </div>
      )}
    </>
  );
}

function PhoneEditor({ employee, onSaved }: { employee: Employee; onSaved: (e: Employee) => void }) {
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: employee.phone ?? '' } });

  const mutation = useMutation({
    mutationFn: (values: PhoneForm) => updateEmployee(employee.id, { phone: values.phone === '' ? null : values.phone }),
    onSuccess: (updated) => {
      onSaved(updated);
      form.reset({ phone: updated.phone ?? '' });
      setSaved(true);
      setApiError(null);
    },
    onError: (error) => {
      setSaved(false);
      setApiError(toApiError(error));
    },
  });

  return (
    <aside className="h-fit border border-rule bg-surface p-5">
      <h2 className="text-lg">Update phone</h2>
      <p className="mt-1 text-[13px] text-ink-muted">The only field you can change yourself. The server enforces this too.</p>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} noValidate className="mt-4 flex flex-col gap-4">
        <ErrorBanner error={apiError} />
        <TextField label="Phone" mono placeholder="+91-98450-00000" error={form.formState.errors.phone?.message} {...form.register('phone')} />
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-sage" role="status">{saved && !form.formState.isDirty ? 'Saved' : ''}</span>
          <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!form.formState.isDirty}>
            Save
          </Button>
        </div>
      </form>
    </aside>
  );
}
