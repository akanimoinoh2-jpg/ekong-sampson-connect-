export default async function run(page, ui) {
  const logs = [];
  page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
  page.on('requestfailed', r => logs.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  await page.fill('#login-username', 'senator');
  await page.fill('#login-password', 'EkongSampson2026!');
  await page.click('#login-form button[type=submit]');
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    message: document.getElementById('admin-message')?.textContent,
    loginHidden: document.getElementById('login-panel')?.classList.contains('hidden'),
    workspaceShown: !document.getElementById('workspace')?.classList.contains('hidden'),
    signedIn: document.getElementById('signed-in-user')?.textContent,
    projectCards: document.querySelectorAll('.admin-project').length,
    issueCards: document.querySelectorAll('.admin-issue').length
  }));
  return { state, logs };
}
