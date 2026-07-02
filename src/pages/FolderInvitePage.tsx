import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Tabs, Alert, Spin } from 'antd';
import { FolderOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthContext';
import { resolveFolderInvite, joinFolder } from '../store';
import type { FolderInviteInfo } from '../store';

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EEF0F5' }}>
      {children}
    </div>
  );
}

export function FolderInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp, resetPassword } = useAuth();

  const [invite, setInvite] = useState<FolderInviteInfo | null>(null);
  const [resolving, setResolving] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const hasJoined = useRef(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setResolving(false); return; }
    resolveFolderInvite(token)
      .then(info => { if (!info) setInvalid(true); else setInvite(info); })
      .catch(() => setInvalid(true))
      .finally(() => setResolving(false));
  }, [token]);

  useEffect(() => {
    if (!user || !invite || hasJoined.current) return;
    hasJoined.current = true;
    joinFolder(invite.folderId, user.uid, user.email ?? undefined, invite.kanbanIds, invite.role === 'editor' ? 'editor' : 'viewer')
      .catch(() => {})
      .finally(() => navigate('/'));
  }, [user, invite, navigate]);

  if (resolving || authLoading) return <PageShell><Spin size="large" /></PageShell>;

  if (invalid) return (
    <PageShell>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>Invalid invite link</div>
        <div style={{ fontSize: 13, color: '#888' }}>This link has expired or been revoked.</div>
        <Button type="link" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Go to Simple Kanban</Button>
      </div>
    </PageShell>
  );

  if (user) return <PageShell><Spin size="large" /></PageShell>;

  async function handleSignIn({ email, password }: { email: string; password: string }) {
    setAuthError('');
    setAuthBusy(true);
    try { await signIn(email, password); }
    catch { setAuthError('Invalid email or password.'); }
    finally { setAuthBusy(false); }
  }

  async function handleReset({ email }: { email: string }) {
    setAuthError('');
    setAuthBusy(true);
    try { await resetPassword(email); setResetSent(true); }
    catch { setAuthError('Could not send reset email. Check the address and try again.'); }
    finally { setAuthBusy(false); }
  }

  async function handleSignUp({ email, password }: { email: string; password: string }) {
    setAuthError('');
    setAuthBusy(true);
    try { await signUp(email, password); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setAuthError(msg.includes('email-already-in-use')
        ? 'An account with that email already exists. Try signing in.'
        : 'Could not create account. Please try again.');
    }
    finally { setAuthBusy(false); }
  }

  const fieldRules = {
    email: [{ required: true, type: 'email' as const, message: 'Enter a valid email' }],
    password: [{ required: true, min: 6, message: 'Password must be at least 6 characters' }],
  };

  return (
    <PageShell>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px 48px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        width: 380,
        maxWidth: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px' }}>
            Simple Kanban <span style={{ fontWeight: 400, color: '#aaa', fontSize: 14 }}>by Oestler</span>
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: '#888' }}>
            You've been invited as a <strong>{invite?.role === 'editor' ? 'Editor' : 'Viewer'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            <FolderOutlined style={{ fontSize: 18, color: '#1a1a2e' }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>{invite?.folderName}</div>
          </div>
          {invite?.ownerEmail && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#888' }}>
              Shared by {invite.ownerEmail}
            </div>
          )}
        </div>

        {authError && <Alert message={authError} type="error" showIcon style={{ marginBottom: 16 }} />}

        {resetSent ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <MailOutlined style={{ fontSize: 32, color: '#1a1a2e', marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Password reset link sent.</div>
            <Button onClick={() => { setResetMode(false); setResetSent(false); setAuthError(''); }} block>Back to sign in</Button>
          </div>
        ) : resetMode ? (
          <Form layout="vertical" onFinish={handleReset} requiredMark={false}>
            <Form.Item name="email" label="Email" rules={fieldRules.email}>
              <Input size="large" autoComplete="email" autoFocus />
            </Form.Item>
            <div style={{ marginBottom: 20 }}>
              <Button type="link" size="small" onClick={() => { setResetMode(false); setAuthError(''); }} style={{ padding: 0, fontSize: 12, color: '#888' }}>
                Back to sign in
              </Button>
            </div>
            <Button type="primary" htmlType="submit" size="large" block loading={authBusy} style={{ fontWeight: 600 }}>
              Send reset email
            </Button>
          </Form>
        ) : (
          <Tabs
            defaultActiveKey="signin"
            centered
            onChange={() => setAuthError('')}
            items={[
              {
                key: 'signin',
                label: 'Sign in',
                children: (
                  <Form layout="vertical" onFinish={handleSignIn} requiredMark={false}>
                    <Form.Item name="email" label="Email" rules={fieldRules.email}>
                      <Input size="large" autoComplete="email" autoFocus />
                    </Form.Item>
                    <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password' }]} style={{ marginBottom: 8 }}>
                      <Input.Password size="large" autoComplete="current-password" />
                    </Form.Item>
                    <div style={{ textAlign: 'right', marginBottom: 20 }}>
                      <Button type="link" size="small" onClick={() => { setResetMode(true); setAuthError(''); }} style={{ padding: 0, fontSize: 12, color: '#888' }}>
                        Forgot password?
                      </Button>
                    </div>
                    <Button type="primary" htmlType="submit" size="large" block loading={authBusy} style={{ fontWeight: 600 }}>
                      Sign in &amp; join
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'signup',
                label: 'Create account',
                children: (
                  <Form layout="vertical" onFinish={handleSignUp} requiredMark={false}>
                    <Form.Item name="email" label="Email" rules={fieldRules.email}>
                      <Input size="large" autoComplete="email" autoFocus />
                    </Form.Item>
                    <Form.Item name="password" label="Password" rules={fieldRules.password} style={{ marginBottom: 24 }}>
                      <Input.Password size="large" autoComplete="new-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" size="large" block loading={authBusy} style={{ fontWeight: 600 }}>
                      Create account &amp; join
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        )}
      </div>
    </PageShell>
  );
}
