(function () {
  "use strict";
  var CFG = window.ATMOS_CONFIG || {};
  var HAS_DB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  var BASE = (CFG.SUPABASE_URL || "").replace(/\/$/, "");
  /* Display prices. The database holds the real prices (supabase/schema.sql, table product_config).
     Keep these three numbers the same as the database. */
  var PRICE = 14999, PLAN = 2400, RESERVE = 999;

  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { return "₹" + Math.round(n).toLocaleString("en-IN"); };
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  $("yr").textContent = new Date().getFullYear();
  if (CFG.CONTACT_EMAIL) { $("emailLine").hidden = false; $("emailLink").textContent = CFG.CONTACT_EMAIL; $("emailLink").href = "mailto:" + CFG.CONTACT_EMAIL; }
  (function legal() {
    var ul = $("legalList");
    [["Seller", CFG.BUSINESS_NAME], ["Address", CFG.BUSINESS_ADDRESS], ["GSTIN", CFG.GSTIN], ["Phone", CFG.SUPPORT_PHONE]].forEach(function (p) {
      if (p[1]) { var li = document.createElement("li"); li.textContent = p[0] + ": " + p[1]; ul.appendChild(li); }
    });
  })();

  /* ---------- database calls (Supabase REST) ---------- */
  var ERR = {
    invalid_name: "Please enter your full name.", invalid_email: "Please enter a valid email address.",
    invalid_phone: "Please enter a valid 10-digit Indian mobile number.", invalid_address: "Please enter your full delivery address.",
    invalid_city: "Please enter your city.", invalid_state: "Please choose your state or UT.", invalid_pin: "Please enter a valid 6-digit PIN code.",
    invalid_qty: "That quantity is not available.", too_many: "Too many requests from this number. Please try again later.", rejected: "Your request could not be accepted."
  };
  function rpc(name, body) {
    return fetch(BASE + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) { var m = j && j.message ? String(j.message) : ""; var err = new Error(ERR[m] || "Something went wrong. Please try again."); err.code = m; throw err; }
        return j;
      });
    }, function () { throw new Error("Could not reach the server. Check your internet connection and try again."); });
  }

  /* ---------- menu, gallery, explorer ---------- */
  var menuBtn = $("menuBtn"), navList = $("navList");
  menuBtn.addEventListener("click", function () { var o = navList.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o); });
  navList.addEventListener("click", function (e) { if (e.target.tagName === "A") { navList.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });

  document.querySelectorAll(".thumbs button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("aria-pressed") === "true") return;
      document.querySelectorAll(".thumbs button").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      var gm = $("galMain"); gm.classList.add("swap");
      setTimeout(function () {
        gm.removeAttribute("srcset"); gm.src = b.getAttribute("data-src"); gm.className = (b.getAttribute("data-cut") ? "cut " : "") + "swap";
        var show = function () { gm.classList.remove("swap"); };
        if (gm.complete) show(); else gm.onload = show;
      }, 200);
    });
  });
  var cut = $("cut"), sb = document.querySelectorAll("#steps button");
  sb.forEach(function (b) {
    b.addEventListener("click", function () {
      sb.forEach(function (o) { o.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true");
      cut.setAttribute("data-active", b.getAttribute("data-stage"));
    });
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dialog]");
    if (b) { var d = $("dlg-" + b.getAttribute("data-dialog")); if (d && d.showModal) d.showModal(); }
  });
  document.querySelectorAll("dialog:not(#drawer)").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d || e.target.hasAttribute("data-close")) d.close(); });
  });

  /* ---------- cart ---------- */
  var cart = { qty: 1, plan: false, count: 0 };
  try { var sc = JSON.parse(localStorage.getItem("ad-cart") || "null"); if (sc && sc.count) cart = sc; } catch (e) { }
  function saveCart() { try { localStorage.setItem("ad-cart", JSON.stringify(cart)); } catch (e) { } }
  function badge() { var c = $("cartCount"); c.textContent = cart.count; c.hidden = !cart.count; }
  badge();
  var qty = 1;
  $("qMinus").addEventListener("click", function () { qty = Math.max(1, qty - 1); $("qVal").textContent = qty; });
  $("qPlus").addEventListener("click", function () { qty = Math.min(10, qty + 1); $("qVal").textContent = qty; });
  function setCart() { cart = { qty: Math.max(1, qty), plan: $("optPlan").checked, count: Math.max(1, qty) }; saveCart(); badge(); }
  $("addCart").addEventListener("click", function () { setCart(); openDrawer(); });
  $("reserveNow").addEventListener("click", function () { setCart(); openDrawer(); });
  document.querySelectorAll("[data-reserve]").forEach(function (b) { b.addEventListener("click", function () { setCart(); openDrawer(); }); });
  $("cartBtn").addEventListener("click", openDrawer);

  /* ---------- checkout drawer ---------- */
  var drawer = $("drawer"), body = $("drawerBody"), foot = $("drawerFoot");
  var STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
  var cust = { name: "", email: "", phone: "", address: "", city: "", state: "", pin: "" };
  var placed = null;

  function totals() { var dev = PRICE * cart.qty, plan = cart.plan ? PLAN * cart.qty : 0, res = RESERVE * cart.qty; return { dev: dev, plan: plan, res: res, bal: dev - res }; }
  function progress(s) { var n = ["Cart", "Delivery", "Confirm"]; return '<div class="progress">' + n.map(function (t, i) { return '<div class="' + (i + 1 <= s ? "on" : "") + '">' + (i + 1) + ". " + t + "</div>"; }).join("") + "</div>"; }
  function sumLines(t, o) {
    o = o || {};
    return '<div class="line-sum"><span>Atmos Drop × ' + o.qty + '<small>Launch price ' + inr(PRICE) + " each</small></span><span>" + inr(t.dev) + "</span></div>" +
      (o.plan ? '<div class="line-sum"><span>Yearly filter plan × ' + o.qty + "<small>Billed from dispatch, cancel any time</small></span><span>" + inr(t.plan) + "/yr</span></div>" : "") +
      '<div class="line-sum"><span>Balance due at dispatch<small>Only when your unit is ready to ship</small></span><span>' + inr(t.bal) + "</span></div>" +
      '<div class="line-sum total"><span>Reservation to pay</span><span>' + inr(t.res) + "</span></div>";
  }
  function step1() {
    if (!cart.count) {
      body.innerHTML = '<p style="text-align:center;padding:40px 10px;color:var(--muted)"><b>Your pre-order is empty.</b><br>Reserve Atmos Drop for ₹999 and pay the balance only at dispatch.</p>';
      foot.innerHTML = '<button class="btn btn-primary btn-block" id="goProd">Go to the product</button>';
      $("goProd").onclick = function () { drawer.close(); location.hash = "#product"; };
      return;
    }
    var t = totals();
    body.innerHTML = progress(1) +
      '<div class="item"><img src="assets/product-160.webp" width="84" height="84" alt=""><div><b>Atmos Drop</b><div class="small">Desktop air purifier with water harvesting</div>' +
      '<div style="margin-top:10px;display:flex;align-items:center;gap:12px"><div class="qty"><button type="button" id="dm" aria-label="Decrease quantity">−</button><output>' + cart.qty + '</output><button type="button" id="dp" aria-label="Increase quantity">+</button></div><button type="button" class="linklike" id="rm" style="color:var(--accent);font-size:.9rem">Remove</button></div></div></div>' +
      '<label class="opt" for="dPlan" style="border-top:0;padding-top:0"><input type="checkbox" id="dPlan" ' + (cart.plan ? "checked" : "") + '><span><b>Add the yearly filter plan, ₹2,400 per unit</b><small>A fresh cartridge every six months. Billed from dispatch.</small></span></label>' +
      sumLines(t, { qty: cart.qty, plan: cart.plan }) + '<div class="notice">Fully refundable until we confirm dispatch.</div>';
    foot.innerHTML = '<button class="btn btn-primary btn-block" id="toDel">Continue to delivery</button>';
    $("dm").onclick = function () { cart.qty = Math.max(1, cart.qty - 1); cart.count = cart.qty; saveCart(); badge(); step1(); };
    $("dp").onclick = function () { cart.qty = Math.min(10, cart.qty + 1); cart.count = cart.qty; saveCart(); badge(); step1(); };
    $("rm").onclick = function () { cart = { qty: 1, plan: false, count: 0 }; saveCart(); badge(); step1(); };
    $("dPlan").onchange = function () { cart.plan = this.checked; $("optPlan").checked = this.checked; saveCart(); step1(); };
    $("toDel").onclick = step2;
  }
  function field(id, label, type, ac, extra) {
    return '<div class="field" data-f="' + id + '"><label for="d-' + id + '">' + label + '</label><input id="d-' + id + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(cust[id]) + '" ' + (extra || "") + '><div class="err"></div></div>';
  }
  function step2() {
    body.innerHTML = progress(2) +
      '<div class="row2">' + field("name", "Full name", "text", "name") + field("phone", "Mobile number", "tel", "tel", 'inputmode="numeric" maxlength="10" placeholder="10-digit number"') + "</div>" +
      field("email", "Email", "email", "email") + field("address", "Address", "text", "street-address") +
      '<div class="row2">' + field("city", "City", "text", "address-level2") + field("pin", "PIN code", "text", "postal-code", 'inputmode="numeric" maxlength="6"') + "</div>" +
      '<div class="field" data-f="state"><label for="d-state">State or UT</label><select id="d-state"><option value="">Select</option>' + STATES.map(function (s) { return "<option" + (cust.state === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select><div class="err"></div></div>' +
      '<div class="hp" aria-hidden="true"><label>Leave this empty<input id="d-hp" tabindex="-1" autocomplete="off"></label></div>';
    foot.innerHTML = '<div style="display:flex;gap:10px"><button class="btn btn-line" id="back1">Back</button><button class="btn btn-primary" id="toRev" style="flex:1">Review order</button></div>';
    $("back1").onclick = step1;
    $("toRev").onclick = function () {
      var ids = ["name", "phone", "email", "address", "city", "pin", "state"], ok = true;
      ids.forEach(function (id) { cust[id] = $("d-" + id).value.trim(); });
      var rules = {
        name: function (v) { return v.length > 1 || "Enter your full name."; },
        phone: function (v) { return /^[6-9]\d{9}$/.test(v) || "Enter a valid 10-digit Indian mobile number."; },
        email: function (v) { return /^\S+@\S+\.\S+$/.test(v) || "Enter a valid email address."; },
        address: function (v) { return v.length > 5 || "Enter your delivery address."; },
        city: function (v) { return v.length > 1 || "Enter your city."; },
        pin: function (v) { return /^[1-9]\d{5}$/.test(v) || "Enter a valid 6-digit PIN code."; },
        state: function (v) { return !!v || "Select your state or UT."; }
      };
      ids.forEach(function (id) {
        var r = rules[id](cust[id]), f = document.querySelector('[data-f="' + id + '"]');
        if (r !== true) { ok = false; f.classList.add("bad"); f.querySelector(".err").textContent = r; } else f.classList.remove("bad");
      });
      cust.hp = $("d-hp").value;
      if (ok) step3(); else { var b = document.querySelector(".field.bad input, .field.bad select"); if (b) b.focus(); }
    };
  }
  function step3() {
    var t = totals();
    body.innerHTML = progress(3) +
      '<h4 style="font-family:var(--serif);font-size:1.2rem;margin:0 0 8px">Deliver to</h4><p style="margin:0 0 18px">' + esc(cust.name) + "<br>" + esc(cust.address) + ", " + esc(cust.city) + ", " + esc(cust.state) + " " + esc(cust.pin) + "<br>" + esc(cust.phone) + " · " + esc(cust.email) + ' <button type="button" class="linklike" id="edit" style="color:var(--accent)">Edit</button></p>' +
      sumLines(t, { qty: cart.qty, plan: cart.plan }) +
      (HAS_DB ? "" : '<div class="notice"><b>Preview mode.</b> The database is not connected yet, so this order will not be saved.</div>') +
      '<label class="opt" for="agree" style="border-top:0"><input type="checkbox" id="agree"><span>I have read the <button type="button" class="linklike" style="color:var(--accent)" data-dialog="preorder">pre-order and delivery terms</button> and understand this reserves a product that has not shipped yet.</span></label>' +
      '<div id="orderErr" class="notice bad" hidden></div>';
    foot.innerHTML = '<div style="display:flex;gap:10px"><button class="btn btn-line" id="back2">Back</button><button class="btn btn-primary" id="place" style="flex:1">Place pre-order</button></div>';
    $("edit").onclick = step2; $("back2").onclick = step2;
    $("place").onclick = placeOrder;
  }
  function showErr(m) { var e = $("orderErr"); e.textContent = m; e.hidden = false; }
  function placeOrder() {
    if (!$("agree").checked) { showErr("Please tick the box to continue."); return; }
    var btn = $("place"); btn.disabled = true; btn.textContent = "Placing order…"; $("orderErr").hidden = true;
    var done = function (res) { placed = res; try { localStorage.setItem("ad-last", JSON.stringify({ ref: res.ref, phone: cust.phone })); } catch (e) { } cart = { qty: 1, plan: false, count: 0 }; saveCart(); badge(); prefillTrack(); step4(); };
    if (!HAS_DB) {
      var t = totals();
      done({ ref: "AD-PREVIEW", qty: cart.qty, filter_plan: cart.plan, total: t.dev, reservation: t.res, balance: t.bal, status: "pending_payment", preview: true });
      return;
    }
    rpc("place_order", { p_name: cust.name, p_email: cust.email, p_phone: cust.phone, p_address: cust.address, p_city: cust.city, p_state: cust.state, p_pin: cust.pin, p_qty: cart.qty, p_plan: cart.plan, p_hp: cust.hp || "" })
      .then(done, function (e) { btn.disabled = false; btn.textContent = "Place pre-order"; showErr(e.message); });
  }

  function loadRazorpay(cb) {
    if (window.Razorpay) return cb(true);
    var s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = function () { cb(true); }; s.onerror = function () { cb(false); }; document.head.appendChild(s);
  }
  function step4() {
    var o = placed, t = { dev: o.total, res: o.reservation, bal: o.balance, plan: o.filter_plan ? PLAN * o.qty : 0 };
    var pay = "";
    if (!o.preview) {
      if (CFG.RAZORPAY_KEY_ID) pay += '<button class="btn btn-primary btn-block" id="payRzp">Pay ' + inr(o.reservation) + " now (UPI, card, netbanking)</button>";
      if (CFG.UPI_ID) pay += '<a class="btn ' + (CFG.RAZORPAY_KEY_ID ? "btn-line" : "btn-primary") + ' btn-block" href="upi://pay?pa=' + encodeURIComponent(CFG.UPI_ID) + "&pn=" + encodeURIComponent("Atmos Drop") + "&am=" + o.reservation + "&cu=INR&tn=" + encodeURIComponent("Reservation " + o.ref) + '">Pay ' + inr(o.reservation) + " with a UPI app</a>";
    }
    body.innerHTML = '<div class="notice ok"><b>' + (o.preview ? "Preview only: nothing was saved." : "Your pre-order is placed and saved.") + "</b></div>" +
      '<p style="margin:12px 0 0">Your order reference</p><div class="ref-box">' + esc(o.ref) + "</div>" +
      '<p class="small" style="text-align:center">Keep this reference and your mobile number to track your order.</p>' +
      sumLines(t, { qty: o.qty, plan: o.filter_plan }) +
      (o.preview ? "" : (pay
        ? '<h4 style="font-family:var(--serif);font-size:1.2rem;margin:18px 0 8px">Pay your reservation</h4><div class="pay-opt">' + pay + '</div><p class="small" id="payMsg" role="status"></p><p class="small">Your reservation is confirmed once we receive and verify your payment.</p>'
        : '<div class="notice">We will contact you at ' + esc(cust.email) + " or " + esc(cust.phone) + " with payment instructions. Your reservation is confirmed once we receive your payment.</div>"));
    foot.innerHTML = '<div style="display:flex;gap:10px"><a class="btn btn-line" id="trackNow" href="#track" style="flex:1">Track order</a><button class="btn btn-primary" id="done" style="flex:1">Done</button></div>';
    $("done").onclick = function () { drawer.close(); };
    $("trackNow").onclick = function () { drawer.close(); prefillTrack(); };
    var rz = $("payRzp");
    if (rz) rz.onclick = function () {
      rz.disabled = true; rz.textContent = "Opening payment…";
      loadRazorpay(function (ok) {
        rz.disabled = false; rz.textContent = "Pay " + inr(o.reservation) + " now (UPI, card, netbanking)";
        if (!ok) { $("payMsg").textContent = "Could not load the payment window. Please try again."; return; }
        var r = new window.Razorpay({
          key: CFG.RAZORPAY_KEY_ID, amount: o.reservation * 100, currency: "INR", name: "Atmos Drop", description: "Pre-order reservation " + o.ref,
          prefill: { name: cust.name, email: cust.email, contact: cust.phone }, notes: { order_ref: o.ref }, theme: { color: "#0A6C95" },
          handler: function (resp) {
            $("payMsg").textContent = "Payment received. Recording it now…";
            rpc("claim_payment", { p_ref: o.ref, p_phone: cust.phone, p_payment_id: resp.razorpay_payment_id })
              .then(function () { $("payMsg").textContent = "Thank you. We have your payment and will confirm your reservation shortly."; },
                function () { $("payMsg").textContent = "Payment went through (id " + resp.razorpay_payment_id + "), but we could not record it. Please contact us with your order reference."; });
          }
        });
        r.open();
      });
    };
  }
  function openDrawer() { step1(); if (!drawer.open) drawer.showModal(); }
  $("drawerClose").addEventListener("click", function () { drawer.close(); });
  drawer.addEventListener("click", function (e) { if (e.target === drawer) drawer.close(); });

  /* ---------- order tracking ---------- */
  var STAGES = [["Order placed", ["pending_payment", "payment_claimed", "reserved", "balance_paid", "shipped", "delivered"]],
  ["Payment received", ["payment_claimed", "reserved", "balance_paid", "shipped", "delivered"]],
  ["Reservation confirmed", ["reserved", "balance_paid", "shipped", "delivered"]],
  ["Shipped", ["shipped", "delivered"]], ["Delivered", ["delivered"]]];
  var MESSAGES = { pending_payment: "We are waiting for your reservation payment.", payment_claimed: "We have your payment and are verifying it.", reserved: "Your place in the first batch is confirmed.", balance_paid: "Balance received. Your unit will ship soon.", shipped: "Your order is on its way.", delivered: "Your order was delivered.", cancelled: "This order was cancelled.", refunded: "This order was refunded." };
  function prefillTrack() { try { var l = JSON.parse(localStorage.getItem("ad-last") || "null"); if (l) { $("t-ref").value = l.ref; $("t-phone").value = l.phone; } } catch (e) { } }
  prefillTrack();
  $("trackForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var ref = $("t-ref").value.trim().toUpperCase(), ph = $("t-phone").value.trim(), out = $("trackOut"), bad = false;
    [[$("t-ref"), ref.length > 3], [$("t-phone"), /^[6-9]\d{9}$/.test(ph)]].forEach(function (p) { var f = p[0].closest(".field"); if (!p[1]) { f.classList.add("bad"); bad = true; } else f.classList.remove("bad"); });
    if (bad) return;
    if (!HAS_DB) { out.innerHTML = '<div class="notice">Order tracking works once the database is connected.</div>'; return; }
    var btn = $("trackBtn"); btn.disabled = true; btn.textContent = "Checking…";
    rpc("track_order", { p_ref: ref, p_phone: ph }).then(function (r) {
      btn.disabled = false; btn.textContent = "Check status";
      if (!r) { out.innerHTML = '<div class="notice bad">We could not find an order with that reference and mobile number. Please check both and try again.</div>'; return; }
      var cancelled = r.status === "cancelled" || r.status === "refunded", html = "<h3 style='margin-top:22px'>Hello " + esc(r.name) + ", order " + esc(r.ref) + "</h3><p>" + esc(MESSAGES[r.status] || "") + "</p>";
      if (cancelled) html += '<div class="notice bad">Status: ' + esc(r.status) + "</div>";
      else {
        var cur = -1; STAGES.forEach(function (s, i) { if (s[1].indexOf(r.status) > -1) cur = i; });
        html += '<ul class="timeline">' + STAGES.map(function (s, i) { return '<li class="' + (i < cur ? "done" : i === cur ? "now done" : "") + '">' + s[0] + "</li>"; }).join("") + "</ul>";
      }
      html += '<p class="small">' + r.qty + " × Atmos Drop · Reservation " + inr(r.reservation) + " · Balance due at dispatch " + inr(r.balance) + "</p>";
      out.innerHTML = html;
    }, function (e) { btn.disabled = false; btn.textContent = "Check status"; out.innerHTML = '<div class="notice bad">' + esc(e.message) + "</div>"; });
  });

  /* ---------- contact form ---------- */
  var cm = $("contactMsg");
  $("contactForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var fn = $("f-name"), fe = $("f-email"), bad = false;
    [[fn, fn.value.trim().length > 1], [fe, /^\S+@\S+\.\S+$/.test(fe.value.trim())]].forEach(function (p) { var f = p[0].closest(".field"); if (!p[1]) { f.classList.add("bad"); bad = true; } else f.classList.remove("bad"); });
    if (bad) { cm.style.color = "#FFC766"; cm.textContent = "Please fix the highlighted fields."; return; }
    if (!$("f-consent").checked) { cm.style.color = "#FFC766"; cm.textContent = "Please tick the box so we can reply."; return; }
    if (!HAS_DB) {
      if (CFG.CONTACT_EMAIL) {
        var b = "Name: " + fn.value.trim() + "\nEmail: " + fe.value.trim() + "\nCity: " + $("f-city").value.trim() + "\nWriting as: " + $("f-type").value + "\n\n" + $("f-msg").value.trim();
        cm.style.color = "#8FE6F3"; cm.textContent = "Your email app is opening. Press send to finish.";
        location.href = "mailto:" + CFG.CONTACT_EMAIL + "?subject=" + encodeURIComponent("Atmos Drop enquiry: " + fn.value.trim()) + "&body=" + encodeURIComponent(b);
      } else { cm.style.color = "#FFC766"; cm.textContent = "Preview mode: the database is not connected yet, so nothing was sent."; }
      return;
    }
    var btn = $("contactBtn"); btn.disabled = true; btn.textContent = "Sending…";
    rpc("submit_enquiry", { p_name: fn.value.trim(), p_email: fe.value.trim(), p_city: $("f-city").value.trim(), p_topic: $("f-type").value, p_message: $("f-msg").value.trim(), p_hp: $("f-hp").value })
      .then(function () { btn.disabled = false; btn.textContent = "Send message"; cm.style.color = "#8FE6F3"; cm.textContent = "Thank you. We have your message and will reply by email."; $("contactForm").reset(); },
        function (er) { btn.disabled = false; btn.textContent = "Send message"; cm.style.color = "#FFB4B4"; cm.textContent = er.message; });
  });

  document.querySelectorAll("[data-topic]").forEach(function (a) { a.addEventListener("click", function () { $("f-type").value = a.getAttribute("data-topic"); }); });

  /* ---------- mobile buy bar ---------- */
  var sticky = $("stickyBuy");
  function onScroll() { var y = window.scrollY, p = $("product").getBoundingClientRect(); sticky.classList.toggle("show", y > 700 && !(p.top < 200 && p.bottom > 300)); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- motion: header, progress, reveal, accordion ---------- */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hdr = document.querySelector("header.site"), prog = $("prog"), ticking = false;
  function onFrame() {
    var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
    hdr.classList.toggle("scrolled", y > 8);
    if (prog) prog.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }, { passive: true });
  onFrame();

  var groups = [".idea .big", ".uses .label", ".uses h2", ".uses .lede", ".use", ".uses-water", ".uses-cta", ".trio>div", ".steps3 h2", ".tl>div", ".how .label", ".how h2", ".how .lede", ".explorer>*", ".gallery", ".buybox", ".specs>*", "#track .track-grid>*", ".about-grid>*", ".founders li", ".faq-cols>*", ".contact-grid>*"];
  var targets = [];
  groups.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, i) { el.setAttribute("data-reveal", ""); el.style.setProperty("--d", (Math.min(i, 5) * 0.09).toFixed(2) + "s"); targets.push(el); });
  });
  if (!("IntersectionObserver" in window) || reduce) { targets.forEach(function (el) { el.classList.add("in"); }); }
  else {
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }

  document.querySelectorAll("details.q").forEach(function (d) {
    var s = d.querySelector("summary"), anim = null;
    s.addEventListener("click", function (e) {
      if (reduce || !d.animate) return;
      e.preventDefault(); if (anim) anim.cancel();
      d.style.overflow = "hidden";
      var start = d.offsetHeight, closed = s.offsetHeight, end;
      if (d.open) { end = closed; } else { d.open = true; end = d.offsetHeight; }
      anim = d.animate({ height: [start + "px", end + "px"] }, { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" });
      anim.onfinish = function () { if (end === closed) d.open = false; d.style.overflow = ""; anim = null; };
      anim.oncancel = function () { d.style.overflow = ""; };
    });
  });
})();
