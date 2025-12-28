import fetch from "node-fetch";

const AKTU_URL = "https://aktu.ac.in/circulars.html";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

let lastSize = 0;

async function run() {
  const res = await fetch(AKTU_URL);
  const html = await res.text();

  const size = html.length;

  if (lastSize !== 0 && size !== lastSize) {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        headings: { en: "🚨 AKTU New Update" },
        contents: { en: "AKTU website par naya circular/update aaya hai. Tap to check." },
        url: "https://preetbeacon.com"
      })
    });
    console.log("🔔 Notification sent");
  }

  lastSize = size;
}

run();
