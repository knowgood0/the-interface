export function adminLayout({ title, authed, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${title} · Admin</title>
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body>
  ${
    authed
      ? `<div class="admin-shell">
    <nav class="admin-nav">
      <a href="/admin" class="admin-brand">Admin</a>
      <a href="/admin/articles">Articles</a>
      <a href="/admin/topics">Topic Ideas</a>
      <a href="/admin/analytics">Analytics</a>
      <a href="/admin/settings">Settings</a>
      <a href="/" target="_blank">View site &#8599;</a>
      <a href="/admin/logout" class="logout">Log out</a>
    </nav>
    <main class="admin-main">${body}</main>
  </div>`
      : `<main class="admin-main admin-main--centered">${body}</main>`
  }
</body>
</html>`;
}
