// Apply the saved appearance before the page paints.
(() => {
  let theme;
  try { theme = localStorage.getItem('tonality-diamond-theme'); } catch { /* Storage is optional. */ }
  document.documentElement.dataset.theme = theme === 'dark' || theme === 'light'
    ? theme : 'dark';
})();
