// Static diagrams remain visible without JavaScript. Only the viewer needs it.
(() => {
  if (document.getElementById('mmdOverlay') || !window.HTMLDialogElement) return;
  const overlay = document.createElement('dialog');
  overlay.id = 'mmdOverlay';
  overlay.setAttribute('aria-label', '다이어그램 전체화면');
  overlay.innerHTML = '<div class="mmd-head"><span class="mmd-title"></span>' +
    '<button type="button" data-act="minus" aria-label="축소">−</button><span class="mmd-zoom" aria-live="polite">100%</span>' +
    '<button type="button" data-act="plus" aria-label="확대">+</button><button type="button" data-act="fit">화면맞춤</button>' +
    '<span class="mmd-hint">휠 = 확대·축소 · 드래그 = 이동</span><button type="button" data-act="close">닫기 ✕</button></div>' +
    '<div class="mmd-body" tabindex="0" aria-label="다이어그램, 방향키로 이동"></div>';
  document.body.appendChild(overlay);
  const body = overlay.querySelector('.mmd-body'), label = overlay.querySelector('.mmd-zoom');
  let currentSvg, host, opener, naturalW, naturalH, scale = 1, overflow, pan;
  function setScale(value) {
    scale = Math.min(6, Math.max(0.2, value));
    currentSvg.style.width = (naturalW * scale) + 'px';
    currentSvg.style.maxWidth = 'none';
    currentSvg.style.height = (naturalH * scale) + 'px';
    label.textContent = Math.round(scale * 100) + '%';
  }
  function stopPan() { pan = null; body.classList.remove('panning'); }
  function restore() {
    if (!currentSvg) return;
    if (currentSvg.dataset.mmdStyle) currentSvg.setAttribute('style', currentSvg.dataset.mmdStyle);
    else currentSvg.removeAttribute('style');
    delete currentSvg.dataset.mmdStyle;
    host.appendChild(currentSvg); // Move instead of clone: SVG IDs stay unique.
    currentSvg = null;
    document.documentElement.style.overflow = overflow;
    stopPan();
    opener.focus();
  }
  overlay.addEventListener('close', restore);
  window.addEventListener('beforeprint', () => { if (overlay.open) { overlay.close(); restore(); } });
  overlay.querySelector('.mmd-head').addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.act;
    if (action === 'close') overlay.close();
    else if (action === 'plus') setScale(scale * 1.25);
    else if (action === 'minus') setScale(scale / 1.25);
    else if (action === 'fit') {
      setScale(Math.min((body.clientWidth - 40) / naturalW, (body.clientHeight - 40) / naturalH));
      body.scrollTo(0, 0);
    }
  });
  body.addEventListener('wheel', event => {
    if (!currentSvg || !event.deltaY) return;
    event.preventDefault();
    const rect = body.getBoundingClientRect(), old = scale;
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const pointX = body.scrollLeft + x - 20, pointY = body.scrollTop + y - 20;
    setScale(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
    body.scrollLeft = pointX * scale / old + 20 - x;
    body.scrollTop = pointY * scale / old + 20 - y;
  }, { passive: false });
  body.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pan = { x: event.clientX, y: event.clientY, left: body.scrollLeft, top: body.scrollTop };
    body.classList.add('panning');
    body.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  body.addEventListener('pointermove', event => {
    if (!pan) return;
    body.scrollLeft = pan.left - event.clientX + pan.x;
    body.scrollTop = pan.top - event.clientY + pan.y;
  });
  ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach(type => body.addEventListener(type, stopPan));
  document.querySelectorAll('.mermaid-rendered').forEach((figure, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mmd-full';
    button.textContent = '⛶ 전체화면 보기';
    button.setAttribute('aria-label', '다이어그램 ' + (index + 1) + ' 전체화면 보기');
    figure.prepend(button);
    button.addEventListener('click', () => {
      host = figure; opener = button; currentSvg = figure.querySelector('svg');
      const box = currentSvg.viewBox.baseVal;
      naturalW = box.width || currentSvg.getBoundingClientRect().width || 800;
      naturalH = box.height || currentSvg.getBoundingClientRect().height || 600;
      currentSvg.dataset.mmdStyle = currentSvg.getAttribute('style') || '';
      body.appendChild(currentSvg);
      overlay.querySelector('.mmd-title').textContent = '다이어그램 ' + (index + 1);
      overflow = document.documentElement.style.overflow;
      overlay.showModal();
      document.documentElement.style.overflow = 'hidden';
      setScale(1); body.scrollTo(0, 0);
      overlay.querySelector('[data-act="close"]').focus();
    });
  });
})();
