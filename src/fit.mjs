// Preserve a complete workbench on short or narrow windows without clipping controls.
function fitWorkbench() {
  const scale = Math.min(1, window.innerWidth / 900, window.innerHeight / 740);
  document.body.style.zoom = scale;
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight / scale}px`);
  document.documentElement.style.setProperty('--app-width', `${window.innerWidth / scale}px`);
}
window.addEventListener('resize', fitWorkbench);
fitWorkbench();

