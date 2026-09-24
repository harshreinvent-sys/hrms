import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { RoleBadge } from './components/Badge';

/**
 * Application shell: a narrow left rail on wide screens, a top bar on phones.
 * Navigation is role-aware — an EMPLOYEE never sees "Employees" — but the API
 * enforces the same rules regardless of what is rendered here.
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const canSeeDirectory = user.role === 'ADMIN' || user.role === 'MANAGER';

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block border-l-2 px-4 py-2 text-[14px] transition-colors ${
      isActive ? 'border-accent bg-surface font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
    }`;

  const nav = (
    <nav className="flex flex-col py-2" aria-label="Main">
      <NavLink to="/" end className={linkClass} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
      {canSeeDirectory && (
        <NavLink to="/employees" className={linkClass} onClick={() => setMenuOpen(false)}>
          {user.role === 'ADMIN' ? 'Employees' : 'My team'}
        </NavLink>
      )}
      <NavLink to="/me" className={linkClass} onClick={() => setMenuOpen(false)}>My profile</NavLink>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-rule bg-paper lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <div>
            <p className="font-display text-[22px] font-semibold leading-none tracking-tight">HRMS</p>
            <p className="eyebrow mt-1">Staff register</p>
          </div>
          <button
            type="button"
            className="rounded border border-rule-strong px-2.5 py-1 text-[13px] lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
        </div>

        <div id="mobile-nav" className={`${menuOpen ? 'block' : 'hidden'} border-t border-rule lg:block lg:border-t-0`}>
          {nav}
          <div className="border-t border-rule px-4 py-4 text-[13px] lg:absolute lg:bottom-0 lg:w-full">
            <p className="font-semibold text-ink">{user.name}</p>
            <p className="truncate text-ink-muted">{user.email}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <RoleBadge role={user.role} />
              <button type="button" onClick={handleLogout} disabled={signingOut} className="text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
