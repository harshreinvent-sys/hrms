import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './App';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/Login';

// Placeholders until Slices 7 and 8 land their pages.
function Soon({ title }: { title: string }) {
  return <h1 className="text-2xl">{title}</h1>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Soon title="Dashboard" /> },
          { path: 'me', element: <Soon title="My profile" /> },
          {
            element: <ProtectedRoute roles={['ADMIN', 'MANAGER']} />,
            children: [
              { path: 'employees', element: <Soon title="Employees" /> },
              { path: 'employees/:id', element: <Soon title="Employee" /> },
            ],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
