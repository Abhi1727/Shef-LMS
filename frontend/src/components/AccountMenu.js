import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ChangePasswordPanel from './ChangePasswordPanel';

/**
 * Compact account control: avatar + dropdown (password / account / sign out).
 */
const AccountMenu = ({
  user,
  onLogout,
  onOpenAccount,
  showPasswordModal = true
}) => {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      <div className="ss-account" ref={ref}>
        <button
          type="button"
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

        {open && (
          <div className="ss-account__menu" role="menu">
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
          </div>
        )}
      </div>

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
