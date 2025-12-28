// check.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AKTU_URL = "https://aktu.ac.in/circulars.html";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY; // owner/repo
const LAST_FILE = path.resolve(__dirname, 'last.json');

async function getFetch() {
  if (typeof globalThis.fetch === 'function') return globalThis.fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

async function sendOneSignal() {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.warn('ONESIGNAL_APP_ID or ONESIGNAL_API_KEY not set — skipping notification.');
    return;
  }
  const fetch = await getFetch();
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "🚨 AKTU New Update" },
      contents: { en: "AKTU website par naya circular/update aaya hai." },
      url: "https://preetbeacon.com"
    })
  });
  if (!res.ok) {
    console.warn('OneSignal returned', res.status, await res.text());
  } else {
    console.log('Notification sent.');
  }
}

async function run() {
  try {
    const fetch = await getFetch();
    const res = await fetch(AKTU_URL, { headers: { 'User-Agent': 'github-action/aktu-checker' } });
    if (!res.ok) throw new Error(`Failed to fetch AKTU page: ${res.status} ${res.statusText}`);
    const html = await res.text();
    const size = html.length;

    let last = { size: 0 };
    if (fs.existsSync(LAST_FILE)) {
      try {
        last = JSON.parse(fs.readFileSync(LAST_FILE, 'utf8'));
      } catch (e) {
        console.warn('Could not parse last.json — will overwrite:', e.message);
      }
    }

    if (last.size !== 0 && size !== last.size) {
      console.log(`Change detected (was ${last.size}, now ${size}).`);
      try {
        await sendOneSignal();
      } catch (e) {
        console.warn('Failed to send notification:', e.message);
      }
    } else {
      console.log('No change detected.');
    }

    // Persist new size
    fs.writeFileSync(LAST_FILE, JSON.stringify({ size }, null, 2));
    console.log('Updated', LAST_FILE);

    // Try to push the update (best-effort). Make sure workflow has permissions: contents: write
    if (GITHUB_TOKEN && REPO) {
      try {
        execSync('git config user.name "github-actions[bot]"');
        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
        execSync(`git add ${path.basename(LAST_FILE)}`);
        try {
          execSync('git commit -m "ci: update last.json [skip ci]"', { stdio: 'inherit' });
        } catch (commitErr) {
          // commit will fail if there are no changes — ignore
        }
        execSync(`git remote set-url origin https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git`);
        execSync('git push origin HEAD', { stdio: 'inherit' });
        console.log('Persisted last.json to repository.');
      } catch (e) {
        console.warn('Could not push last.json back to the repo (continuing):', e.message);
      }
    } else {
      console.log('GITHUB_TOKEN or GITHUB_REPOSITORY not available; not attempting to push.');
    }

    // exit 0 on handled flow
    process.exit(0);
  } catch (err) {
    console.error('Unhandled error in script (caught):', err);
    // Do not fail the workflow for transient errors — change to process.exit(1) if you prefer strict failure
    process.exit(0);
  }
}

run();
