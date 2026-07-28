import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ChangePasswordPanel from './ChangePasswordPanel';

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
