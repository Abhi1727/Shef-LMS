import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * How many leading nav items stay visible at a given viewport width.
 * Breakpoint-based (not content-measured) so More never oscillates and
 * cannot trigger horizontal/vertical scrollbar flicker loops.
 */
function visibleCountForWidth(width, total) {
  if (total <= 1) return total;
  let count;
  if (width >= 1600) count = total;
  else if (width >= 1400) count = Math.min(total, 12);
  else if (width >= 1200) count = Math.min(total, 9);
  else if (width >= 1024) count = Math.min(total, 7);
  else if (width >= 900) count = Math.min(total, 6);
  else if (width >= 768) count = Math.min(total, 5);
  else if (width >= 560) count = Math.min(total, 4);
  else count = Math.min(total, 3);

  // Always leave at least one item in More when we are not showing everything
  if (count < total) return count;
  return total;
}

/**
 * Single-row shell nav. Overflow items go into a portaled ☰ More menu.
 */
function ResponsiveShellNav({ items, activeId, onSelect, ariaLabel = 'Primary' }) {
  const moreBtnRef = useRef(null);
  const menuRef = useRef(null);
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1400
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setWidth(window.innerWidth);
      }, 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const visibleCount = useMemo(
    () => visibleCountForWidth(width, items.length),
    [width, items.length]
  );

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );
  const overflowItems = useMemo(
    () => items.slice(visibleCount),
    [items, visibleCount]
  );
  const overflowActive = overflowItems.some((item) => item.id === activeId);

  const updateMenuPosition = () => {
    const el = moreBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: Math.round(rect.bottom + 8),
      right: Math.round(window.innerWidth - rect.right)
    });
  };

  useEffect(() => {
    setMoreOpen(false);
  }, [activeId, visibleCount]);

  useLayoutEffect(() => {
    if (!moreOpen) return undefined;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (moreBtnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMoreOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const dropdown =
    moreOpen && overflowItems.length > 0
      ? createPortal(
          <div
            ref={menuRef}
            className="ss-shell-nav__dropdown ss-shell-nav__dropdown--portal"
            role="menu"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {overflowItems.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className={`nav-more-item ${activeId === id ? 'active' : ''}`}
                onClick={() => {
                  onSelect(id);
                  setMoreOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <nav className="ss-shell-nav ss-shell-nav--responsive" aria-label={ariaLabel}>
      <div className="ss-shell-nav__track">
        {visibleItems.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`ss-shell-nav__btn ${activeId === id ? 'is-active' : ''}`}
            onClick={() => onSelect(id)}
          >
            {label}
          </button>
        ))}

        {overflowItems.length > 0 && (
          <div className="ss-shell-nav__more nav-more-wrapper">
            <button
              ref={moreBtnRef}
              type="button"
              className={`ss-shell-nav__btn ss-shell-nav__more-btn ${moreOpen ? 'is-open' : ''} ${overflowActive ? 'is-active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="More navigation"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <span className="ss-shell-nav__burger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              More
            </button>
            {dropdown}
          </div>
        )}
      </div>
    </nav>
  );
}

export default ResponsiveShellNav;
