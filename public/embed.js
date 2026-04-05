// public/embed.js
// Paste this in ANY app: <script src="https://your-awkt.vercel.app/embed.js" data-api-key="YOUR_KEY"></script>

(function () {
  "use strict";

  if (window.__awktldLoaded) return;
  window.__awktldLoaded = true;

  var tag = document.currentScript;
  var API_KEY = tag ? tag.getAttribute("data-api-key") : "";
  var BASE = tag ? new URL(tag.src).origin : "";
  var WIDGET = BASE + "/widget?key=" + encodeURIComponent(API_KEY);

  // Styles
  var style = document.createElement("style");
  style.textContent = [
    "#_awkt-btn{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;",
    "box-shadow:0 4px 20px rgba(79,70,229,.4);display:flex;align-items:center;justify-content:center;z-index:2147483646;transition:transform .2s,background .2s;}",
    "#_awkt-btn:hover{transform:scale(1.1);}",
    "#_awkt-btn svg{width:26px;height:26px;pointer-events:none;}",
    "#_awkt-wrap{position:fixed;bottom:96px;right:24px;width:380px;height:580px;border-radius:18px;overflow:hidden;",
    "box-shadow:0 12px 50px rgba(0,0,0,.18);z-index:2147483645;",
    "transform:scale(.92) translateY(16px);opacity:0;pointer-events:none;",
    "transition:transform .28s cubic-bezier(.34,1.56,.64,1),opacity .2s;}",
    "#_awkt-wrap.on{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}",
    "#_awkt-frame{width:100%;height:100%;border:none;display:block;}",
    "@media(max-width:440px){#_awkt-wrap{width:calc(100vw - 12px);height:calc(100vh - 100px);right:6px;bottom:82px;border-radius:14px;}}",
  ].join("");
  document.head.appendChild(style);

  // Button
  var btn = document.createElement("button");
  btn.id = "_awkt-btn";
  btn.setAttribute("aria-label", "Open AI chat assistant");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(btn);

  // Iframe wrap
  var wrap = document.createElement("div");
  wrap.id = "_awkt-wrap";
  var iframe = document.createElement("iframe");
  iframe.id = "_awkt-frame";
  iframe.allow = "microphone";
  iframe.title = "AWKT-LD AI Chat";
  iframe.src = "";
  wrap.appendChild(iframe);
  document.body.appendChild(wrap);

  var open = false;
  var loaded = false;

  var ICON_CHAT = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';
  var ICON_X = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';

  function toggle() {
    open = !open;
    if (open) {
      if (!loaded) { iframe.src = WIDGET; loaded = true; }
      wrap.classList.add("on");
      btn.style.background = "#3730a3";
      btn.querySelector("svg").innerHTML = ICON_X;
    } else {
      wrap.classList.remove("on");
      btn.style.background = "#4f46e5";
      btn.querySelector("svg").innerHTML = ICON_CHAT;
    }
  }

  btn.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });

  document.addEventListener("click", function (e) {
    if (open && !wrap.contains(e.target) && e.target !== btn) toggle();
  });
})();