(() => {
  'use strict';
  const shell = document.querySelector('.shell');
  const stage = document.getElementById('stage');
  const dialZone = document.getElementById('dialZone');
  const settings = document.getElementById('settings');
  const settingsButton = document.getElementById('settingsButton');
  const closeButton = document.getElementById('closeSettings');
  const backdrop = document.getElementById('settingsBackdrop');
  const focusButton = document.getElementById('focusButton');
  const wideScreen = matchMedia('(min-width: 900px), (min-width: 760px) and (min-height: 600px)');
  const nativeScreen = window.YoujieNativeScreen;
  const nativeBars = nativeScreen ? window.capacitorExports.registerPlugin('SystemBars') : null;
  let panelOpen = false;
  let focused = false;
  let frame = 0;
  let previousDialSize = -1;

  function sidebarVisible() { return wideScreen.matches && !focused; }
  function setPanel(open, restoreFocus = true) {
    panelOpen = Boolean(open) && !sidebarVisible();
    document.body.classList.toggle('settings-open', panelOpen);
    settingsButton.setAttribute('aria-expanded', String(panelOpen));
    backdrop.hidden = !panelOpen;
    stage.inert = panelOpen;
    if (panelOpen) stage.setAttribute('aria-hidden', 'true');
    else stage.removeAttribute('aria-hidden');
    if (panelOpen) {
      settings.setAttribute('role', 'dialog'); settings.setAttribute('aria-modal', 'true');
      closeButton.focus({ preventScroll: true });
    } else {
      settings.removeAttribute('role'); settings.removeAttribute('aria-modal');
      if (restoreFocus) settingsButton.focus({ preventScroll: true });
    }
    nativeScreen?.setSettingsOpen({ open: panelOpen }).catch(() => {});
  }

  function fitViewport() {
    frame = 0;
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight));
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    shell.dataset.layout = sidebarVisible() ? 'wide' : 'compact';
    if (sidebarVisible() && panelOpen) setPanel(false, false);
    // 圆环只使用扣除状态、进度和按钮后的剩余空间，绝不挤走操控按钮。
    const dialSize = Math.max(1, Math.floor(Math.min(dialZone.clientWidth, dialZone.clientHeight, 480)));
    if (dialSize !== previousDialSize) {
      previousDialSize = dialSize;
      document.documentElement.style.setProperty('--dial-size', `${dialSize}px`);
    }
    stage.dataset.dial = dialSize < 120 ? 'tiny' : 'circle';
  }
  function scheduleFit() { if (!frame) frame = requestAnimationFrame(fitViewport); }

  settingsButton.addEventListener('click', () => setPanel(!panelOpen));
  closeButton.addEventListener('click', () => setPanel(false));
  backdrop.addEventListener('click', () => setPanel(false));
  document.addEventListener('keydown', event => {
    if (!panelOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setPanel(false); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(settings.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')).filter(element => element.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }, true);
  focusButton.addEventListener('click', async () => {
    focused = !focused;
    document.body.classList.toggle('is-focused', focused);
    focusButton.setAttribute('aria-pressed', String(focused));
    focusButton.querySelector('span').textContent = focused ? '退出专注' : '专注模式';
    setPanel(false, false); scheduleFit();
    if (nativeBars) {
      await nativeBars.setStyle({ style: focused ? 'DARK' : 'LIGHT' }).catch(() => {});
      return;
    }
    try {
      if (focused && !document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else if (!focused && document.fullscreenElement) await document.exitFullscreen();
    } catch (_) { /* 不支持系统全屏时仍使用单屏专注布局。 */ }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!nativeScreen && !document.fullscreenElement && focused) {
      focused = false; document.body.classList.remove('is-focused');
      focusButton.setAttribute('aria-pressed', 'false'); focusButton.querySelector('span').textContent = '专注模式'; scheduleFit();
    }
  });
  if (nativeScreen) nativeScreen.addListener('closeSettings', () => setPanel(false)).catch(() => {});
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', scheduleFit);
  window.visualViewport?.addEventListener('resize', scheduleFit);
  if (wideScreen.addEventListener) wideScreen.addEventListener('change', scheduleFit);
  else wideScreen.addListener(scheduleFit);
  if ('ResizeObserver' in window) { const observer = new ResizeObserver(scheduleFit); observer.observe(dialZone); observer.observe(shell); }
  fitViewport(); scheduleFit();
})();
