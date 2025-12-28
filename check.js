const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AKTU_URL = "https://aktu.ac.in/circulars.html";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const STATE_FILE = path.join(__dirname, 'lastSize.txt');

async function sendNotification() {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.error("ONESIGNAL_APP_ID or ONESIGNAL_API_KEY is not set. Skipping notification.");
    return;
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        headings: { en: "🚨 AKTU New Update" },
        contents: { en: "AKTU website par naya circular/update aaya hai." },
        url: "https://preetbeacon.com"
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to send OneSignal notification:", res.status, text);
    } else {
      console.log("Notification sent");
    }
  } catch (err) {
    console.error("Error sending OneSignal notification:", err);
  }
}

function readLastSize() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = fs.readFileSync(STATE_FILE, 'utf8').trim();
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    }
  } catch (err) {
    console.warn("Could not read state file:", err);
  }
  return 0;
}

function writeLastSize(size) {
  try {
    fs.writeFileSync(STATE_FILE, String(size), 'utf8');
    console.log("Wrote new size to", STATE_FILE);
  } catch (err) {
    console.error("Failed to write state file:", err);
  }
}

function tryCommitState() {
  try {
    // Configure git user (use action default credentials provided by actions/checkout)
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');

    execSync(`git add ${STATE_FILE}`);
    // Only commit if something changed
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      execSync('git commit -m "Update lastSize (AKTU checker)"');
      execSync('git push');
      console.log("Committed and pushed state changes");
    } else {
      console.log("No state changes to commit");
    }
  } catch (err) {
    console.error("Failed to commit state file:", err.toString());
  }
}

async function run() {
  try {
    console.log("Starting AKTU check...");
    const lastSize = readLastSize();

    const res = await fetch(AKTU_URL);
    if (!res.ok) {
      throw new Error(`Failed fetching AKTU URL: ${res.status}`);
    }
    const html = await res.text();
    const size = html.length;

    console.log("Last size:", lastSize, "Current size:", size);

    if (lastSize !== 0 && size !== lastSize) {
      console.log("Change detected, sending notification...");
      await sendNotification();
    } else {
      console.log("No change detected");
    }

    // Persist state for next run
    writeLastSize(size);
    tryCommitState();

    // exit 0
    process.exit(0);
  } catch (err) {
    console.error("Unhandled error in run():", err);
    // Do not mask real failures forever; fail the job so you can see logs.
    process.exit(1);
  }
}

run();
