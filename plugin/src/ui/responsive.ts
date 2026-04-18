export function isMobileNarrow(): boolean {
  return window.innerWidth < 480;
}

export function isMobileWide(): boolean {
  return window.innerWidth < 768;
}

export function applyResponsiveClass(el: HTMLElement): void {
  el.removeClass('delve-narrow', 'delve-mobile', 'delve-desktop');
  if (isMobileNarrow()) {
    el.addClass('delve-narrow');
  } else if (isMobileWide()) {
    el.addClass('delve-mobile');
  } else {
    el.addClass('delve-desktop');
  }
}
