import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './pages/Dashboard';
import { BoardPage } from './pages/BoardPage';
import { InvitePage } from './pages/InvitePage';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EEF0F5' }}>
      <Spin size="large" />
    </div>
  );
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/simple-kanban">
      <Routes>
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/k/:id" element={<AuthGuard><BoardPage /></AuthGuard>} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
