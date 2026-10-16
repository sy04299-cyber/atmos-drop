# Atmos Drop website: setup guide

This folder is a complete website. It needs **no coding tools**: you upload the files to a free host and connect a free database.

| File | What it is |
|---|---|
| `index.html` | The shop (home page, pre-order cart, order tracking) |
| `admin.html` | Your private dashboard to see and manage orders |
| `config.js` | **The only file you edit.** Your database keys and business details |
| `supabase/schema.sql` | Sets up the database (tables and security) |
| `css/`, `js/`, `assets/` | Design, logic and images |

Time needed: about 30 minutes. Cost: ₹0 for the website and database (payment gateways charge their own fees per payment).

---

## Step 1. Create the free database (Supabase)

1. Go to https://supabase.com, sign up and click **New project**. Choose a name (for example `atmos-drop`), set a database password (save it), pick the region closest to your customers (for India, a Mumbai or Singapore region if offered) and click **Create**. Wait a minute or two.
2. In the left menu open **SQL Editor** > **New query**. Open `supabase/schema.sql` from this folder, copy everything, paste it in, and click **Run**. You should see "Success". This creates the tables for orders and enquiries and locks them so only you can read them.

## Step 2. Create your admin login

1. In Supabase open **Authentication** > **Users** > **Add user** > **Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. Open **SQL Editor**, run this (use the same email), then click **Run**:
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
   Repeat for each founder who needs access (create each user first).
3. Recommended: **Authentication** > **Sign In / Providers** (or **Settings**) and switch **off** "Allow new users to sign up". Even if left on, new users cannot see any data unless they are in the `admins` table.

## Step 3. Connect the website to the database

1. In Supabase open **Project Settings** > **API**. Copy the **Project URL** and the **anon public** key.
2. Open `config.js` in any text editor (Notepad is fine) and paste them in:
   ```js
   SUPABASE_URL: "https://xxxxxxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```
   The anon key is designed to be public. Your data is protected by the rules in `schema.sql`. **Never put the `service_role` key anywhere in this folder.**
3. While you are in `config.js`, also fill in your contact email, WhatsApp number and business details (seller name, address, GSTIN). Indian e-commerce rules expect these to be shown.

## Step 4. Put the website online (free)

Pick one (GitHub Pages is explained in full in the next section):
* **GitHub Pages**: free, see "Host on GitHub Pages" below.
* **Netlify**: go to https://app.netlify.com/drop and drag this whole folder onto the page. You get a live link at once. Add your own domain under *Domain settings*.
* **Cloudflare Pages**: create a project and upload the folder (Direct Upload).
* **GitHub Pages / Vercel**: upload the folder to a repository and enable hosting.

Your shop is at the site address; your dashboard is at `your-site/admin.html`.

## Step 5. Test it end to end

1. Open the live site, pre-order 1 unit with your own details and confirm you get a reference like `AD-1A2B3C4D`.
2. In Supabase open **Table Editor** > **orders**: the order is there.
3. Open `your-site/admin.html`, sign in, and see the same order. Change its status.
4. On the shop, use **Track your order** with the reference and mobile number.
5. Delete the test order in the admin or Table Editor.

## Step 6. Take payments (optional but recommended)

Orders are saved even with no payment set up; you then message the customer payment instructions yourself.

* **UPI (simplest):** put your UPI ID in `UPI_ID`. Customers on a phone tap "Pay with a UPI app".
* **Razorpay (UPI, cards, netbanking):** create a Razorpay account, complete KYC, and put the **Key ID** (starts with `rzp_test_` for testing, `rzp_live_` for real) in `RAZORPAY_KEY_ID`. After a customer pays, the order becomes `payment_claimed`. Check the payment in the Razorpay dashboard, then set the order to `reserved` in the admin.

Why the manual check? A browser can claim a payment that never happened, so you confirm every payment before reserving. If order volume grows, ask a developer to add a Razorpay webhook (a small Supabase Edge Function) to confirm payments automatically.

## Changing prices

Prices are stored in the database so customers cannot change them. To change them, in Supabase **SQL Editor**:
```sql
update public.product_config set price = 14999, plan_price = 2400, reservation = 999 where id = 1;
```
Then update the same three numbers at the top of `js/app.js` (`PRICE`, `PLAN`, `RESERVE`) and in the visible text of `index.html`, so the page and the database agree.

## Order statuses

`pending_payment` > `payment_claimed` > `reserved` > `balance_paid` > `shipped` > `delivered`, plus `cancelled` and `refunded`. Customers see these as friendly steps on the tracking panel.

## Things to know

* **Free plan limits:** Supabase free projects have limits and may be paused after a period of inactivity; free projects do not include automatic backups. Check Supabase's current pricing page. Use **Export CSV** in the admin regularly, and visit the site or dashboard often so the project stays active. Upgrading to a paid plan removes these limits.
* **Spam:** the forms have a hidden trap field and the database limits repeat orders. For stronger protection add Cloudflare Turnstile later.
* **Emails:** this setup does not send automatic emails. You see new orders in the admin and email customers yourself, or connect an email service later.
* **Legal:** the Privacy, Terms and Pre-order pages are plain-language drafts. Have a professional review them before taking real money, and fill in your business details.
* **Privacy of data:** customer data is only readable by people in the `admins` table who are signed in.


---

## Host on GitHub Pages (free)

GitHub Pages serves your website for free from a GitHub "repository" (an online folder).

**Before you start:** unzip `atmos-drop-site.zip` on your computer. GitHub cannot unpack a zip for you.

### 1. Create a GitHub account and repository
1. Go to https://github.com and sign up (free).
2. Click the **+** at the top right, then **New repository**.
3. Repository name: `atmos-drop` (or your own name). Choose **Public**. (Free accounts can publish Pages from public repositories.) Click **Create repository**.

### 2. Upload the website files
1. On the new empty repository page, click **uploading an existing file**.
2. Open the unzipped `atmos-drop-site` folder on your computer, **select everything inside it** (`index.html`, `admin.html`, `config.js`, `404.html`, `robots.txt`, `.nojekyll`, and the folders `css`, `js`, `assets`, `supabase`) and **drag them all onto the browser page**. Dragging folders works in Chrome and Edge, and keeps the folder structure.
3. Wait until every file shows in the list, then click **Commit changes** (green button).
4. Check: the repository page should show `index.html` and the `css`, `js` and `assets` folders at the top level (not inside another folder).

> If `.nojekyll` is hidden on your computer, it is fine to skip it.

### 3. Turn the website on
1. In the repository click **Settings** > **Pages** (left menu).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
4. Wait 1 to 2 minutes and refresh. A box appears: **Your site is live at** `https://YOURNAME.github.io/atmos-drop/`. Open it.

Your shop is at that address. Your dashboard is at `https://YOURNAME.github.io/atmos-drop/admin.html`.

### 4. Edit your settings later
Open `config.js` in the repository, click the pencil icon, change the values (for example your Supabase URL and key), and click **Commit changes**. The site updates in a minute or two.

### 5. Use your own domain (optional)
1. Buy a domain (for example `atmosdrop.in`).
2. In **Settings** > **Pages** > **Custom domain**, type it and click **Save**.
3. At your domain seller, add the DNS records GitHub shows (a `CNAME` for `www`, and `A` records for the bare domain). HTTPS turns on automatically; tick **Enforce HTTPS**.

### 6. Fix the share preview image (once live)
In `index.html`, find the line starting `<meta property="og:image"` and replace `assets/og-image.jpg` with the full address, for example `https://YOURNAME.github.io/atmos-drop/assets/og-image.jpg`. Social apps need the full address to show your picture when the link is shared.

### Safety notes for GitHub
* A public repository is visible to everyone, including `config.js`. That is fine for the Supabase **anon** key and your business details. **Never upload the Supabase `service_role` key, database password or any secret.**
* The admin page is protected by login and database rules, not by being hidden. It is marked "noindex" so search engines skip it.
* If a page does not load after you publish, check that file names are lower case and exactly as in this folder (`css/style.css`, not `CSS/Style.css`).
