const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// अगर Node < 18 है तो नीचे वाली लाइन अनकॉमेंट करें:
// const fetch = require('node-fetch');

const AKTU_URL = "https://aktu.ac.in/circulars.html";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const STATE_FILE = path.join(__dirname, 'lastSize.txt');

// fetch के लिए retry logic
async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Fetch attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("All fetch retries failed");
}

// lastSize.txt पढ़ना
function readLastSize() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = fs.readFileSync(STATE_FILE, 'utf8').trim();
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    }
  } catch (e) {
    console.warn('Could not read state file:', e);
  }
  return 0;
}

// lastSize.txt लिखना
function writeLastSize(size) {
  try {
    fs.writeFileSync(STATE_FILE, String(size), 'utf8');
  } catch (e) {
    console.error('Failed to write state file:', e);
  }
}

// git से state फाइल कमिट करना
function tryCommitState() {
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
    execSync(`git add ${STATE_FILE}`);
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      execSync('git commit -m "Update lastSize (AKTU checker)"');
      execSync('git push');
      console.log('Committed and pushed state changes');
    } else {
      console.log('No state changes to commit');
    }
  } catch (err) {
    console.error('Failed to commit state file:', err.toString());
  }
}

// OneSignal पर notification भेजना
async function sendNotification() {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.error('ONESIGNAL_APP_ID or ONESIGNAL_API_KEY not set; skipping notification.');
    return;
  }

  try {
    const res = await fetchWithRetry('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        headings: { en: '🚨 AKTU New Update' },
        contents: { en: 'AKTU website par naya circular/update aaya hai.' },
        url: 'https://preetbeacon.com'
      })
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('OneSignal send failed:', res.status, txt);
    } else {
      console.log('Notification sent');
    }
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

// पूरे प्रोसेस को चलाने वाला main function
async function run() {
  try {
    console.log('Starting AKTU check...');
    const lastSize = readLastSize();

    const res = await fetchWithRetry(AKTU_URL, {}, 3, 4000); // 3 ट्राय, 4 सेकंड वेट
    const html = await res.text();
    const size = html.length;

    console.log('Last size:', lastSize, 'Current size:', size);

    if (lastSize !== 0 && size !== lastSize) {
      console.log('Change detected — sending notification');
      await sendNotification();
    } else {
      console.log('No change detected');
    }

    writeLastSize(size);
    tryCommitState();

    process.exit(0);
  } catch (err) {
    console.error('Error in run():', err);
    process.exit(1);
  }
}

run();
