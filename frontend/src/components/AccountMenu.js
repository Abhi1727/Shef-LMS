import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ChangePasswordPanel from './ChangePasswordPanel';
import { getApiBaseUrl } from '../utils/apiBase';

/**
 * Compact account control: avatar + dropdown (password / account / sign out).
 * Menu is portaled to document.body so dashboard overflow/glass layers cannot clip it.
 */
const AccountMenu = ({
  user,
  onLogout,
  onOpenAccount,
  showPasswordModal = true
}) => {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: Math.round(rect.bottom + 6),
      right: Math.round(window.innerWidth - rect.right)
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const canLogoutOtherDevices =
    user?.role === 'admin' ||
    user?.role === 'teacher' ||
    user?.role === 'mentor' ||
    user?.role === 'instructor';

  const logoutAllDevices = async () => {
    if (logoutAllLoading) return;
    const ok = window.confirm(
      'Sign out of all other devices? You will stay signed in on this device.'
    );
    if (!ok) return;

    setLogoutAllLoading(true);
    setOpen(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/auth/logout-all-devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.message || 'Could not sign out of all devices');
        return;
      }
      // Keep this device logged in with a fresh token; other sessions are revoked
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      window.alert(data.message || 'Other devices have been signed out. You remain signed in here.');
    } catch (_) {
      window.alert('Network error. Please try again.');
    } finally {
      setLogoutAllLoading(false);
    }
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className="ss-account__menu ss-account__menu--portal"
          role="menu"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {onOpenAccount && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenAccount();
              }}
            >
              My account
            </button>
          )}
          {showPasswordModal && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
            >
              Change password
            </button>
          )}
          {canLogoutOtherDevices && (
            <button
              type="button"
              role="menuitem"
              className="ss-account__danger"
              disabled={logoutAllLoading}
              onClick={logoutAllDevices}
            >
              Sign out of other devices
            </button>
          )}
          <div className="ss-account__divider" />
          <button
            type="button"
            role="menuitem"
            className="ss-account__danger"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          >
            Sign out
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="ss-account">
        <button
          type="button"
          ref={triggerRef}
          className="ss-account__trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ss-account__meta">
            <span className="ss-account__name">{user?.name || 'Account'}</span>
            {user?.email && <span className="ss-account__email">{user.email}</span>}
          </span>
          <span className="ss-account__avatar">{initial}</span>
          <span className="ss-account__chevron" aria-hidden="true">▾</span>
        </button>
      </div>

      {menu}

      {passwordOpen &&
        createPortal(
          <div className="ss-modal-overlay" onClick={() => setPasswordOpen(false)}>
            <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ss-modal__head">
                <h3>Change password</h3>
                <button
                  type="button"
                  className="ss-modal__close"
                  aria-label="Close"
                  onClick={() => setPasswordOpen(false)}
                >
                  ×
                </button>
              </div>
              <ChangePasswordPanel
                mode="change"
                defaultEmail={user?.email || ''}
                onCancel={() => setPasswordOpen(false)}
                onSuccess={() => setPasswordOpen(false)}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default AccountMenu;
