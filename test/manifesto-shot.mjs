export default async function run(page, ui) {
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.getElementById('manifesto').scrollIntoView());
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/DELL/ekong-sampson-connect/test/manifesto-scroll.png' });
  return 'screenshot saved';
}
