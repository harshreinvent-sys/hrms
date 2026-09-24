import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { toApiError } from '../api/client';
import { Button } from '../components/Button';
import { TextField } from '../components/FormField';
import { ErrorBanner } from '../components/ErrorBanner';
import type { ApiError } from '../types/api';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login, expiredNotice, clearExpiredNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    clearExpiredNotice();
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (error) {
      setApiError(toApiError(error));
      form.resetField('password');
    }
  });

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="eyebrow mb-3">Human Resources</p>
        <h1 className="text-[40px] leading-none">Sign in</h1>
        <p className="mt-2 text-[14px] text-ink-muted">Use your company email and password.</p>

        <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
          {expiredNotice && (
            <div className="border-l-2 border-warn bg-warn-tint px-3 py-2 text-[14px] text-ink" role="status">
              {expiredNotice}
            </div>
          )}
          <ErrorBanner error={apiError} />

          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            autoFocus
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />

          <Button type="submit" variant="primary" loading={form.formState.isSubmitting} className="mt-1 h-10">
            Sign in
          </Button>
        </form>

        <details className="mt-10 border-t border-rule pt-4 text-[13px] text-ink-muted">
          <summary className="cursor-pointer select-none text-ink-faint hover:text-ink">Demo accounts</summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
            <dt className="text-ink-faint">HR / Admin</dt><dd>admin@company.com</dd>
            <dt className="text-ink-faint">Manager</dt><dd>manager@company.com</dd>
            <dt className="text-ink-faint">Employee</dt><dd>employee1@company.com</dd>
            <dt className="text-ink-faint">Password</dt><dd>Password@123</dd>
          </dl>
        </details>
      </div>
    </main>
  );
}
