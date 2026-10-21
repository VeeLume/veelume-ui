// Smoke test for a built bundle: opens smoke/index.html in headless Chrome,
// clicks every bridged component and checks the change reached React.
// Writes smoke/shot.png. CHROME points at a Chrome or Edge binary.
import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page_ = fileURLToPath(new URL('./index.html', import.meta.url));

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 700, height: 520 });
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto(pathToFileURL(page_).href);
	const checks = await page.evaluate(() => window.__smoke);
	checks.namespace = checks.namespace?.split(',').sort().join(',');
	await page.screenshot({ path: fileURLToPath(new URL('./shot.png', import.meta.url)) });

	const expected = {
		namespace: 'Button,RadioGroup,Segmented,Select,Switch',
		segmented: true,
		switch: true,
		selectOptions: 4,
		selectValue: 'Gold',
		buttonClick: true,
		radios: 2
	};
	const failed = Object.entries(expected).filter(([k, v]) => checks[k] !== v);
	for (const [k, v] of Object.entries(expected))
		console.log(`${checks[k] === v ? 'ok  ' : 'FAIL'} ${k}: ${JSON.stringify(checks[k])}`);
	for (const e of errors) console.log(`page error: ${e}`);
	if (failed.length || errors.length) process.exitCode = 1;
} finally {
	await browser.close();
}
