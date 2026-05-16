// ============================================================
// Telcom OCA — Google Apps Script Data Connector
// Copy this entire file into script.google.com → Code.gs
// Deploy as Web App: Execute as "me", Access "Anyone"
// ============================================================

const FOLDER_ID = '19Jq4cic7xxb3q34cjbC-QvmHe3jXZXAA';

function doGet() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = {};
    ['Whatsapp.csv','Sms.csv','Email.csv','Call.csv','Users.csv'].forEach(name => {
      const it = folder.getFilesByName(name);
      if (it.hasNext()) files[name] = parseCSV(it.next().getBlob().getDataAsString());
    });

    const unified = buildUnified(files);
    const allDates = extractAllDates(unified);

    const response = {
      channelSummary: computeChannelSummary(unified),
      dailyTrend: computeDailyTrend(unified),
      dailyDataByChannel: computeDailyByChannel(unified),
      allDates: allDates,
      hourlyData: [], // computed client-side from raw if needed
      topUsers: computeTopUsers(unified, files['Users.csv']),
      churnRisk: computeChurnRisk(unified, files['Users.csv']),
      users: files['Users.csv'] || []
    };

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---- CSV PARSING ----

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => cleanField(h));
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] !== undefined ? cleanField(vals[i]) : ''; });
    return row;
  });
}

function cleanField(s) {
  return s.replace(/^"|"$/g, '').trim();
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += c;
  }
  result.push(current);
  return result;
}

// ---- UNIFIED DATA BUILDER ----

function buildUnified(files) {
  const out = [];
  const configs = {
    'Whatsapp.csv': { channel: 'WhatsApp', statusField: 'last_status', revField: 'price' },
    'Sms.csv':      { channel: 'SMS',      statusField: 'message_status', revField: 'total_price' },
    'Email.csv':    { channel: 'Email',    statusField: 'message_status', revField: 'price' },
    'Call.csv':     { channel: 'Call',     statusField: 'message_status', revField: 'total_price' }
  };

  Object.entries(configs).forEach(([fileName, cfg]) => {
    const rows = files[fileName] || [];
    rows.forEach(r => {
      const isCharge = r.is_charge === 'true' || r.is_charge === 'TRUE' || r.is_charge === true || r.is_charge === '1';
      const status = r[cfg.statusField] || '';
      const revenue = isCharge ? parseInt(r[cfg.revField] || '0') : 0;
      const dateStr = extractDate(r.created_at);
      out.push({
        transaction_id: r.transaction_id,
        user_id: r.user_id,
        is_charge: isCharge,
        created_at: dateStr,
        channel: cfg.channel,
        status: status,
        revenue: revenue,
        is_success: isSuccess(cfg.channel, status),
        is_failure: isFailure(cfg.channel, status),
        billable: isCharge ? 1 : 0
      });
    });
  });
  return out;
}

function extractDate(ts) {
  if (!ts) return '';
  const s = String(ts).split('T')[0].split(' ')[0];
  return s;
}

function extractAllDates(unified) {
  const set = new Set();
  unified.forEach(r => { if (r.created_at) set.add(r.created_at); });
  return Array.from(set).sort();
}

function isSuccess(channel, status) {
  const s = status.toLowerCase();
  if (channel === 'WhatsApp') return s === 'delivered' || s === 'read';
  if (channel === 'SMS')      return s === 'sent';
  if (channel === 'Email')    return s === 'delivered' || s === 'opened' || s === 'clicked';
  if (channel === 'Call')     return s === 'answered';
  return false;
}

function isFailure(channel, status) {
  const s = status.toLowerCase();
  if (channel === 'WhatsApp') return s === 'rejected';
  if (channel === 'SMS')      return s === 'failed';
  if (channel === 'Email')    return s === 'failed';
  if (channel === 'Call')     return s === 'failed' || s === 'rna';
  return false;
}

// ---- CHANNEL SUMMARY ----

function computeChannelSummary(unified) {
  const groups = {};
  unified.forEach(r => {
    if (!groups[r.channel]) groups[r.channel] = { tx:0, succ:0, fail:0, rev:0, bill:0, neutral:0 };
    const g = groups[r.channel];
    g.tx++;
    g.rev += r.revenue;
    if (r.is_success) g.succ++;
    else if (r.is_failure) g.fail++;
    else g.neutral++;
    if (r.is_charge) g.bill++;
  });
  const totalTx = Object.values(groups).reduce((s, g) => s + g.tx, 0);
  const totalRev = Object.values(groups).reduce((s, g) => s + g.rev, 0);
  const obj = {};
  Object.entries(groups).forEach(([ch, g]) => {
    obj[ch] = {
      transactions: g.tx, success: g.succ, fail: g.fail, neutral: g.neutral,
      revenue: g.rev, billable: g.bill,
      successRate: g.tx > 0 ? g.succ / g.tx : 0,
      failureRate: g.tx > 0 ? g.fail / g.tx : 0,
      billableRate: g.tx > 0 ? g.bill / g.tx : 0,
      revenueShare: totalRev > 0 ? g.rev / totalRev : 0,
      shareOfTotal: totalTx > 0 ? g.tx / totalTx : 0
    };
  });
  return obj;
}

// ---- DAILY TREND (aggregated across channels) ----

function computeDailyTrend(unified) {
  const days = {};
  unified.forEach(r => {
    if (!r.created_at) return;
    if (!days[r.created_at]) days[r.created_at] = { transactions:0, success:0, fail:0, revenue:0, activeUsers:new Set() };
    const g = days[r.created_at];
    g.transactions++;
    g.revenue += r.revenue;
    if (r.is_success) g.success++;
    else if (r.is_failure) g.fail++;
    g.activeUsers.add(r.user_id);
  });
  const obj = {};
  Object.entries(days).forEach(([d, g]) => {
    obj[d] = { transactions: g.transactions, success: g.success, fail: g.fail, revenue: g.revenue, activeUsers: g.activeUsers.size };
  });
  return obj;
}

// ---- DAILY DATA BY CHANNEL ----

function computeDailyByChannel(unified) {
  const daily = {};
  unified.forEach(r => {
    if (!r.created_at || !r.channel) return;
    if (!daily[r.channel]) daily[r.channel] = {};
    if (!daily[r.channel][r.created_at]) {
      daily[r.channel][r.created_at] = { transactions:0, success:0, fail:0, revenue:0, billable:0 };
    }
    const g = daily[r.channel][r.created_at];
    g.transactions++;
    g.revenue += r.revenue;
    if (r.is_success) g.success++;
    else if (r.is_failure) g.fail++;
    if (r.is_charge) g.billable++;
  });
  return daily;
}

// ---- TOP USERS ----

function computeTopUsers(unified, users) {
  const agg = {};
  unified.forEach(r => {
    if (!agg[r.user_id]) agg[r.user_id] = { tx:0, rev:0, channels:new Set() };
    agg[r.user_id].tx++;
    agg[r.user_id].rev += r.revenue;
    agg[r.user_id].channels.add(r.channel);
  });
  const userMap = {};
  (users || []).forEach(u => { userMap[u.user_id] = u; });
  return Object.entries(agg)
    .map(([uid, g]) => ({
      user_id: uid,
      user_name: (userMap[uid] || {}).user_name || uid,
      industry: (userMap[uid] || {}).field_of_business || '',
      total_transactions: g.tx,
      total_revenue: g.rev,
      channel_count: g.channels.size,
      channels_used: Array.from(g.channels).join(', ')
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 20);
}

// ---- CHURN RISK ----

function computeChurnRisk(unified, users) {
  const dates = unified.map(r => r.created_at).filter(Boolean).sort();
  const lastDate = dates.length ? dates[dates.length - 1] : '';
  const lastTs = lastDate ? new Date(lastDate).getTime() : 0;

  const userLast = {};
  unified.forEach(r => {
    if (!r.created_at) return;
    if (!userLast[r.user_id] || r.created_at > userLast[r.user_id].lastActive) {
      userLast[r.user_id] = { lastActive: r.created_at, tx:0, rev:0 };
    }
    userLast[r.user_id].tx++;
    userLast[r.user_id].rev += r.revenue;
  });

  const userMap = {};
  (users || []).forEach(u => { userMap[u.user_id] = u; });
  return Object.entries(userLast)
    .map(([uid, g]) => {
      const daysInactive = lastTs ? Math.max(0, Math.floor((lastTs - new Date(g.lastActive).getTime()) / 86400000)) : 0;
      let risk = 10;
      if (daysInactive >= 14) risk = 80;
      else if (daysInactive >= 7) risk = 60;
      else if (daysInactive >= 3) risk = 40;
      return {
        user_id: uid,
        user_name: (userMap[uid] || {}).user_name || uid,
        industry: (userMap[uid] || {}).field_of_business || '',
        last_active: g.lastActive,
        days_inactive: daysInactive,
        risk_score: risk,
        total_revenue: g.rev
      };
    })
    .filter(u => u.risk_score > 30)
    .sort((a, b) => b.risk_score - a.risk_score);
}
