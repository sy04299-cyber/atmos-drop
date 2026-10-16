(function () {
  "use strict";
  var CFG = window.ATMOS_CONFIG || {}, BASE = (CFG.SUPABASE_URL || "").replace(/\/$/, ""), KEY = CFG.SUPABASE_ANON_KEY || "";
  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); };
  var OS = ["pending_payment", "payment_claimed", "reserved", "balance_paid", "shipped", "delivered", "cancelled", "refunded"];
  var LS = ["new", "contacted", "converted", "closed"];
  var session = null, tab = "orders", rows = { orders: [], leads: [] };
  try { session = JSON.parse(sessionStorage.getItem("ad-admin") || "null"); } catch (e) { }

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function save(s) { session = s; try { if (s) sessionStorage.setItem("ad-admin", JSON.stringify(s)); else sessionStorage.removeItem("ad-admin"); } catch (e) { } }
  function auth(body, grant) {
    return fetch(BASE + "/auth/v1/token?grant_type=" + grant, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error_description || j.msg || "Sign-in failed"); return j; }); });
  }
  function api(path, opt, retry) {
    opt = opt || {}; opt.headers = Object.assign({ apikey: KEY, Authorization: "Bearer " + (session && session.access_token), "Content-Type": "application/json" }, opt.headers || {});
    return fetch(BASE + "/rest/v1/" + path, opt).then(function (r) {
      if (r.status === 401 && !retry && session && session.refresh_token) {
        return auth({ refresh_token: session.refresh_token }, "refresh_token").then(function (j) { save({ access_token: j.access_token, refresh_token: j.refresh_token, email: session.email }); return api(path, opt, true); }, function () { signOut(); throw new Error("Session expired"); });
      }
      if (!r.ok) { return r.text().then(function (t) { throw new Error(t || "Request failed"); }); }
      return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }
  function signOut() { save(null); $("app").hidden = true; $("loginCard").hidden = false; $("logout").hidden = true; $("who").textContent = ""; }
  function show() { $("loginCard").hidden = true; $("app").hidden = false; $("logout").hidden = false; $("who").textContent = session.email || ""; load(); }

  if (!BASE || !KEY) { $("loginErr").textContent = "The database is not connected. Fill in SUPABASE_URL and SUPABASE_ANON_KEY in config.js."; }
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault(); $("loginErr").textContent = "";
    if (!BASE || !KEY) return;
    auth({ email: $("em").value.trim(), password: $("pw").value }, "password").then(function (j) {
      save({ access_token: j.access_token, refresh_token: j.refresh_token, email: $("em").value.trim() }); $("pw").value = ""; show();
    }, function (er) { $("loginErr").textContent = er.message; });
  });
  $("logout").addEventListener("click", signOut);

  function load() {
    Promise.all([api("orders?select=*&order=created_at.desc&limit=1000"), api("leads?select=*&order=created_at.desc&limit=1000")]).then(function (r) {
      rows.orders = r[0] || []; rows.leads = r[1] || []; render();
    }, function (er) { if (/permission|42501|401|403/.test(er.message)) { alert("This account is not an admin. Add its email to the admins table (see README)."); signOut(); } else alert("Could not load data: " + er.message); });
  }
  $("refresh").addEventListener("click", load);
  [["tabO", "orders"], ["tabL", "leads"]].forEach(function (p) { $(p[0]).addEventListener("click", function () { tab = p[1]; $("tabO").setAttribute("aria-selected", tab === "orders"); $("tabL").setAttribute("aria-selected", tab === "leads"); $("q").value = ""; render(); }); });
  $("q").addEventListener("input", render); $("sf").addEventListener("change", render);

  function patch(table, id, data) { return api(table + "?id=eq." + id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(data) }); }
  function render() {
    var O = rows.orders, live = O.filter(function (o) { return ["cancelled", "refunded"].indexOf(o.status) < 0; });
    var held = O.filter(function (o) { return ["reserved", "balance_paid", "shipped", "delivered"].indexOf(o.status) > -1; }).reduce(function (a, o) { return a + o.reservation_amount; }, 0);
    var st = $("stats"); st.textContent = "";
    [[O.length, "orders"], [O.filter(function (o) { return o.status === "payment_claimed"; }).length, "payments to verify"], [live.reduce(function (a, o) { return a + o.qty; }, 0), "units (active)"], [inr(held), "reservations confirmed"], [rows.leads.length, "enquiries"]].forEach(function (p) { var d = el("div", "card stat"); d.appendChild(el("b", null, p[0])); d.appendChild(el("span", null, p[1])); st.appendChild(d); });
    var statuses = tab === "orders" ? OS : LS, sf = $("sf"), cur = sf.value; sf.textContent = ""; var a = el("option", null, "All statuses"); a.value = ""; sf.appendChild(a);
    statuses.forEach(function (s) { var o = el("option", null, s); o.value = s; sf.appendChild(o); }); sf.value = statuses.indexOf(cur) > -1 ? cur : "";
    var q = $("q").value.trim().toLowerCase(), list = rows[tab].filter(function (r) { if (sf.value && r.status !== sf.value) return false; return !q || [r.name, r.email, r.phone, r.city, r.ref].join(" ").toLowerCase().indexOf(q) > -1; });
    var th = $("thead"); th.textContent = ""; var tr = el("tr");
    (tab === "orders" ? ["Date", "Reference", "Customer", "Delivery", "Order", "Payment", "Status", "Notes"] : ["Date", "Customer", "Topic", "Message", "Status", "Notes"]).forEach(function (h) { tr.appendChild(el("th", null, h)); }); th.appendChild(tr);
    var tb = $("tbody"); tb.textContent = ""; $("empty").hidden = list.length > 0;
    list.forEach(function (r) {
      var row = el("tr"), t = tab === "orders" ? "orders" : "leads";
      row.appendChild(el("td", null, new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })));
      if (tab === "orders") {
        row.appendChild(el("td", null, r.ref));
        var c = el("td"); c.appendChild(el("b", null, r.name)); c.appendChild(el("small", null, r.phone)); c.appendChild(el("small", null, r.email)); row.appendChild(c);
        row.appendChild(el("td", null, r.address + ", " + r.city + ", " + r.state + " " + r.pin));
        row.appendChild(el("td", null, r.qty + " × Atmos Drop" + (r.filter_plan ? " + filter plan" : "")));
        var p = el("td", null, inr(r.reservation_amount) + " reservation"); p.appendChild(el("small", null, "Balance " + inr(r.balance_amount))); if (r.payment_id) p.appendChild(el("small", null, "Payment id: " + r.payment_id)); row.appendChild(p);
      } else {
        var c2 = el("td"); c2.appendChild(el("b", null, r.name)); c2.appendChild(el("small", null, r.email)); c2.appendChild(el("small", null, r.city || "")); row.appendChild(c2);
        row.appendChild(el("td", null, r.topic || "")); row.appendChild(el("td", null, r.message || ""));
      }
      var s = el("td"), sel = el("select"); (tab === "orders" ? OS : LS).forEach(function (v) { var o = el("option", null, v); o.value = v; if (v === r.status) o.selected = true; sel.appendChild(o); });
      sel.addEventListener("change", function () { patch(t, r.id, { status: sel.value }).then(function () { r.status = sel.value; render(); }, function (e) { alert("Could not update: " + e.message); sel.value = r.status; }); });
      s.appendChild(sel); row.appendChild(s);
      var n = el("td"), ni = el("input", "note"); ni.value = r.notes || ""; ni.setAttribute("aria-label", "Notes");
      ni.addEventListener("change", function () { patch(t, r.id, { notes: ni.value }).then(function () { r.notes = ni.value; }, function (e) { alert("Could not save note: " + e.message); }); });
      n.appendChild(ni); row.appendChild(n); tb.appendChild(row);
    });
  }
  function cell(v) { v = v == null ? "" : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  $("csv").addEventListener("click", function () {
    var cols = tab === "orders" ? ["ref", "created_at", "status", "name", "phone", "email", "address", "city", "state", "pin", "qty", "filter_plan", "reservation_amount", "balance_amount", "payment_id", "notes"] : ["created_at", "status", "name", "email", "city", "topic", "message", "notes"];
    var lines = [cols.join(",")].concat(rows[tab].map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(","); }));
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" })); a.download = "atmos-drop-" + tab + "-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  });
  if (session && BASE && KEY) show();
})();
