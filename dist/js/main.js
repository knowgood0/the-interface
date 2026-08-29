// Intentionally minimal. The site works fully without JS (server-rendered
// HTML, real <a> and <form> elements throughout) — this file only adds
// small conveniences on top.

// Show a lightweight confirmation after newsletter subscribe redirect.
if (new URLSearchParams(location.search).get('subscribed') === '1') {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.newsletter-form');
    if (form) {
      const note = document.createElement('p');
      note.textContent = "You're subscribed. Thanks!";
      note.style.color = '#0f9d8a';
      note.style.fontSize = '0.85rem';
      form.appendChild(note);
    }
  });
}
