import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import './StaggeredMenu.css';

const NAV_ITEMS = [
  { label: 'Dashboard',  to: '/dashboard' },
  { label: 'Gymaware',   to: '/gymaware'  },
  { label: 'Catapult',   to: '/catapult'  },
  { label: 'VALD',       to: '/vald'      },
  { label: 'WHOOP',      to: '/whoop'     },
  { label: 'Readiness',  to: '/readiness' },
];

export default function StaggeredMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  const panelRef       = useRef(null);
  const preLayersRef   = useRef(null);
  const preLayerElsRef = useRef([]);
  const plusHRef       = useRef(null);
  const plusVRef       = useRef(null);
  const iconRef        = useRef(null);
  const textInnerRef   = useRef(null);
  const toggleBtnRef   = useRef(null);
  const backdropRef    = useRef(null);

  const [textLines, setTextLines]   = useState(['Menu', 'Close']);
  const openTlRef       = useRef(null);
  const closeTweenRef   = useRef(null);
  const spinTweenRef    = useRef(null);
  const textCycleAnimRef = useRef(null);
  const busyRef         = useRef(false);

  // Brand colors for stagger layers
  const colors = ['#00843D', '#FFCD00'];

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel      = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH      = plusHRef.current;
      const plusV      = plusVRef.current;
      const icon       = iconRef.current;
      const textInner  = textInnerRef.current;
      if (!panel || !plusH || !plusV || !icon || !textInner) return;

      const preLayers = preContainer
        ? Array.from(preContainer.querySelectorAll('.sm-prelayer'))
        : [];
      preLayerElsRef.current = preLayers;

      gsap.set([panel, ...preLayers], { xPercent: 100, opacity: 1 });
      if (preContainer) gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
      gsap.set(icon,  { rotate: 0, transformOrigin: '50% 50%' });
      gsap.set(textInner, { yPercent: 0 });
    });
    return () => ctx.revert();
  }, []);

  const buildOpenTimeline = useCallback(() => {
    const panel  = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    closeTweenRef.current?.kill();
    closeTweenRef.current = null;

    const itemEls   = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
    const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));

    const layerStates = layers.map(el => ({ el, start: 100 }));

    if (itemEls.length)   gsap.set(itemEls,   { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(ls.el,
        { xPercent: ls.start },
        { xPercent: 0, duration: 0.5, ease: 'power4.out' },
        i * 0.07
      );
    });

    const lastTime       = layerStates.length ? (layerStates.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
    const panelDuration  = 0.65;

    tl.fromTo(panel,
      { xPercent: 100 },
      { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
      panelInsertTime
    );

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.15;
      tl.to(itemEls, {
        yPercent: 0,
        rotate: 0,
        duration: 1,
        ease: 'power4.out',
        stagger: { each: 0.1, from: 'start' },
      }, itemsStart);

      if (numberEls.length) {
        tl.to(numberEls, {
          duration: 0.6,
          ease: 'power2.out',
          '--sm-num-opacity': 1,
          stagger: { each: 0.08, from: 'start' },
        }, itemsStart + 0.1);
      }
    }

    openTlRef.current = tl;
    return tl;
  }, []);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => { busyRef.current = false; });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    const panel  = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;
    closeTweenRef.current?.kill();
    closeTweenRef.current = gsap.to([...layers, panel], {
      xPercent: 100,
      duration: 0.32,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls   = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
        const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
        if (itemEls.length)   gsap.set(itemEls,   { yPercent: 140, rotate: 10 });
        if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
        busyRef.current = false;
      },
    });
  }, []);

  const animateIcon = useCallback(opening => {
    const icon = iconRef.current;
    if (!icon) return;
    spinTweenRef.current?.kill();
    spinTweenRef.current = gsap.to(icon, {
      rotate: opening ? 225 : 0,
      duration: opening ? 0.8 : 0.35,
      ease: opening ? 'power4.out' : 'power3.inOut',
      overwrite: 'auto',
    });
  }, []);

  const animateText = useCallback(opening => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();
    const currentLabel = opening ? 'Menu' : 'Close';
    const targetLabel  = opening ? 'Close' : 'Menu';
    const cycles = 3;
    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === 'Menu' ? 'Close' : 'Menu';
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);
    setTextLines(seq);
    gsap.set(inner, { yPercent: 0 });
    const finalShift = ((seq.length - 1) / seq.length) * 100;
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + seq.length * 0.07,
      ease: 'power4.out',
    });
  }, []);

  const closeMenu = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    playClose();
    animateIcon(false);
    animateText(false);
  }, [playClose, animateIcon, animateText]);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    setOpen(target);
    if (target) { playOpen(); } else { playClose(); }
    animateIcon(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateText]);

  const handleNavClick = (to) => {
    closeMenu();
    setTimeout(() => navigate(to), 180);
  };

  const handleSignOut = () => {
    closeMenu();
    setTimeout(() => onSignOut(), 200);
  };

  // Build prelayer colors (remove middle if 3+)
  const rawColors = colors.slice(0, 4);
  let layerColors = [...rawColors];
  if (layerColors.length >= 3) layerColors.splice(Math.floor(layerColors.length / 2), 1);

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const email = user?.email || '';

  return (
    <>
      {/* Toggle button — rendered inline in Navbar */}
      <button
        ref={toggleBtnRef}
        className="sm-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={toggleMenu}
        type="button"
      >
        <span className="sm-toggle-textWrap" aria-hidden="true">
          <span ref={textInnerRef} className="sm-toggle-textInner">
            {textLines.map((l, i) => (
              <span className="sm-toggle-line" key={i}>{l}</span>
            ))}
          </span>
        </span>
        <span ref={iconRef} className="sm-icon" aria-hidden="true">
          <span ref={plusHRef} className="sm-icon-line" />
          <span ref={plusVRef} className="sm-icon-line" style={{ transform: 'translate(-50%,-50%) rotate(90deg)' }} />
        </span>
      </button>

      {/* Overlay wrapper */}
      <div
        className="staggered-menu-wrapper"
        style={{ '--sm-accent': '#00843D' }}
        data-open={open || undefined}
      >
        {/* Backdrop */}
        {open && (
          <div
            ref={backdropRef}
            className="sm-backdrop"
            onClick={closeMenu}
          />
        )}

        {/* Stagger pre-layers */}
        <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
          {layerColors.map((c, i) => (
            <div key={i} className="sm-prelayer" style={{ background: c }} />
          ))}
        </div>

        {/* Main panel */}
        <aside ref={panelRef} className="staggered-menu-panel" aria-hidden={!open}>
          <div className="sm-panel-inner">
            <ul
              className="sm-panel-list"
              role="list"
              data-numbering={true}
            >
              {NAV_ITEMS.map((item, idx) => {
                const isActive = location.pathname === item.to ||
                  (item.to === '/dashboard' && location.pathname === '/');
                return (
                  <li className="sm-panel-itemWrap" key={item.to}>
                    <button
                      className="sm-panel-item"
                      data-index={idx + 1}
                      onClick={() => handleNavClick(item.to)}
                      style={{
                        color: isActive ? '#00843D' : '#fff',
                      }}
                    >
                      <span className="sm-panel-itemLabel">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Divider + user info */}
            <div className="sm-divider" />
            <div className="sm-user-section">
              {displayName && (
                <div className="sm-user-name">{displayName}</div>
              )}
              {email && (
                <div className="sm-user-email">{email}</div>
              )}
              <button className="sm-signout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
