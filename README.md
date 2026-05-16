# Telcom OCA — Channel Performance & User Health Dashboard

**Author:** Laurensius Haryo | Telcom OCA Virtual Internship

> **Disclaimer:** The data provided is a representation of the original data which amount has been adjusted. The data used is NOT representation of original data, adjusted for educational purposes and does not reflect the actual business condition of the company.

---

## Live Demo

🔗 [https://laurensius12.github.io/Virtual-Internship-Telkom-Oca/](https://laurensius12.github.io/Virtual-Internship-Telkom-Oca/)

---

## Dashboard Features

- **KPI Cards** — Total Transactions, Active Users, Success Rate, Failure Rate, Revenue Proxy, Billable Rate with period-over-period deltas
- **Channel Performance** — Channel Volume bar chart, Revenue by Channel donut, Success vs Failure Rate stacked bar
- **User Activity** — Churn Alert (top 5 at-risk users), Channel Usage donut, Daily Transaction & Revenue Trend
- **Channels Tab** — Success & Failure rates, Status Distribution, WhatsApp Read Rate, Channel Stability
- **Users Tab** — Top Users by Revenue, Churn Risk table, Mono-Channel Upsell Opportunities
- **Filters** — Period (1h, 4h, 6h, 12h, 24h, 7d, 30d, All Time), Date, Industry, Channel, User — all interactive

---

## Architecture

```
Google Drive (CSVs) ──> Google Apps Script ──> JSON API ──> Dashboard
                        (Code.gs)                              ↕
                                                          data.js (dummy fallback)
```

- **Live data** fetched from Google Drive via Apps Script web app
- **Dummy data** (`data.js`) auto-falls back when offline — works out of the box
- **Chart.js** for visualization, zero dependencies, no build step

---

## Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/laurensius12/Virtual-Internship-Telkom-Oca.git
git push -u origin main
```

### 2. Enable GitHub Pages
1. Go to repo **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. The `Deploy Dashboard to GitHub Pages` workflow runs automatically on every push

### 3. Connect Live Data (Optional)

**Step 1 — Deploy Code.gs to Google Apps Script:**
1. Go to [script.google.com](https://script.google.com)
2. Create a new project, paste the contents of `web dashboard/js/Code.gs`
3. Set `FOLDER_ID` to your Google Drive folder ID (containing CSV files)
4. Deploy → **New deployment** → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL

**Step 2 — Update the URL in data-fetcher.js:**
```javascript
// In web dashboard/js/data-fetcher.js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

**Step 3** — Push changes, workflow re-deploys automatically.

> **No live data?** The dashboard works with dummy data out of the box — no configuration needed. Just push and go.

### Google Drive CSV Structure
| File | Required Columns |
|------|-----------------|
| `Whatsapp.csv` | transaction_id, user_id, is_charge, created_at, last_status, price |
| `Sms.csv` | transaction_id, user_id, is_charge, created_at, message_status, total_price |
| `Email.csv` | transaction_id, user_id, is_charge, created_at, message_status, price |
| `Call.csv` | transaction_id, user_id, is_charge, created_at, message_status, total_price |
| `Users.csv` | user_id, user_name, field_of_business, join_date |

---

## Local Development

Open `web dashboard/index.html` directly in any browser. The dashboard loads dummy data automatically. No server or build step required.

---

## Project Structure

```
├── .github/workflows/deploy-pages.yml    # GitHub Actions: auto-deploy to Pages
├── web dashboard/                        # Dashboard source
│   ├── index.html                        # Main HTML
│   ├── css/style.css                     # Styles
│   ├── js/
│   │   ├── data.js                       # Dummy data fallback
│   │   ├── charts.js                     # Chart.js configurations
│   │   ├── dashboard.js                  # Filters, tabs, interactivity
│   │   ├── data-fetcher.js               # Live data from Apps Script API
│   │   └── Code.gs                       # Google Apps Script connector (deploy separately)
│   └── Image/                            # Screenshots
├── .gitignore
└── README.md
```

---

## Technologies Used

- **Google BigQuery** — Data warehouse & SQL processing
- **Google Apps Script** — Serverless data connector (Drive CSV → JSON API)
- **Chart.js** — Dashboard visualization library
- **GitHub Actions** — CI/CD for GitHub Pages deployment
- **Vanilla JavaScript** — No framework, zero build dependencies

---

## License

This project is for educational and portfolio purposes as part of the RevoU x Telkom Indonesia Virtual Internship program.
