(function () {
  'use strict';
  document.querySelectorAll('.nf-admin .nf-confirm').forEach(button => {
    button.closest('form')?.addEventListener('submit', event => {
      if (!window.confirm(button.dataset.confirm || 'Confermare questa operazione?')) event.preventDefault();
    });
  });
  document.querySelector('.nf-copy-shortcode')?.addEventListener('click', event => {
    const button = event.currentTarget;
    const value = button.dataset.copy || '[nightfall_orari]';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => { button.textContent = 'Copiato!'; });
    } else {
      window.prompt('Copia lo shortcode:', value);
    }
  });
})();
