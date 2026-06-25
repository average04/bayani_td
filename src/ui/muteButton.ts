import { isMuted, toggleMuted, onMuteChange } from '../audio/sfx';

// A fixed speaker toggle in the top-right corner, drawn as inline SVG (crisp at any zoom,
// no image asset, no emoji). Persists through the sfx module, so the choice survives reloads.
const SPEAKER =
  '<path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/>';
const WAVES =
  '<path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
const CROSS =
  '<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export function mountMuteButton(): void {
  if (document.getElementById('sfx-mute')) return; // only one, even across scene reloads
  const btn = document.createElement('button');
  btn.id = 'sfx-mute';
  btn.className = 'ui-mute';
  btn.type = 'button';

  const paint = (): void => {
    const off = isMuted();
    btn.setAttribute('aria-label', off ? 'Unmute sound' : 'Mute sound');
    btn.classList.toggle('muted', off);
    btn.innerHTML =
      `<svg viewBox="0 0 26 24" width="22" height="22" aria-hidden="true">${SPEAKER}${off ? CROSS : WAVES}</svg>`;
  };

  btn.addEventListener('click', () => {
    toggleMuted();
    paint();
  });
  onMuteChange(paint);
  paint();
  document.body.appendChild(btn);
}
