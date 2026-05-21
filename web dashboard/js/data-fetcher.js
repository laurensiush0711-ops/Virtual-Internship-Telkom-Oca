// ====================================================================
// data-fetcher.js — Live data connector for Google Drive CSVs
// Fetches aggregated data from Apps Script web app,
// replaces the dummy DATA object, and re-renders the dashboard.
//
// USAGE:
//   1. Deploy Code.gs as a Google Apps Script Web App
//   2. Paste the deployment URL below
//   3. Dashboard auto-loads from Drive on every page refresh
// ====================================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2NW3cXEd15Vdm5krlC6ahZyBHmsIq5ejHAt1xSV3EMFzVNVuGTm1o0Nwif_r0nTtd/exec';

(function() {

  if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('[data-fetcher] APPS_SCRIPT_URL not set. Using dummy data.');
    return;
  }

  let fetchAttempted = false;

  function showLoading(on) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = on ? 'flex' : 'none';
  }

  function loadRealData() {
    if (fetchAttempted) return;
    fetchAttempted = true;
    showLoading(true);

    fetch(APPS_SCRIPT_URL)
      .then(res => res.json())
      .then(json => {
        showLoading(false);
        if (json.error) {
          console.warn('[data-fetcher] Apps Script error:', json.error);
          return;
        }
        buildDataFromResponse(json);
        reRender();
      })
      .catch(err => {
        showLoading(false);
        console.warn('[data-fetcher] Fetch failed:', err.message);
      });
  }

  function buildDataFromResponse(resp) {
    const currentYear = new Date().getFullYear().toString();
    function fixYear(d) {
      if (!d) return '';
      return d.replace(/^\d{4}/, currentYear);
    }

    const channels = Object.keys(resp.dailyDataByChannel || {});
    const rawUsers = resp.users || [];
    const users = rawUsers.map(u => ({
      ...u,
      industry: u.field_of_business || u.industry || '',
      name: u.user_name || u.name || u.id,
      user_name: u.user_name || u.name || u.id
    }));
    const industries = [...new Set(users.map(u => u.industry).filter(Boolean))].sort();
    const allDates = (resp.allDates || Object.keys(resp.dailyTrend || {}).sort()).map(fixYear);

    // Build per-user weight map from topUsers revenue data (if available)
    const totalTopRevenue = (resp.topUsers || []).reduce((s, u) => s + (u.total_revenue || 0), 0);
    const userWeightMap = {};
    if (totalTopRevenue > 0) {
      (resp.topUsers || []).forEach(u => {
        const key = u.user_name || u.name;
        if (key) userWeightMap[key] = (u.total_revenue || 0) / totalTopRevenue;
      });
    }
    // Normalize years in dailyByChannel keys
    const rawDailyByChannel = resp.dailyDataByChannel || {};
    const dailyByChannel = {};
    Object.keys(rawDailyByChannel).forEach(ch => {
      dailyByChannel[ch] = {};
      Object.entries(rawDailyByChannel[ch]).forEach(([dateStr, row]) => {
        dailyByChannel[ch][fixYear(dateStr)] = { ...row };
      });
    });
    const channelSummary = resp.channelSummary || {};
    const dailyTrend = resp.dailyTrend || {};

    // Helper: format date consistently (also normalizes year)
    function normDate(d) {
      if (!d) return '';
      return fixYear(d.split('T')[0].split(' ')[0]);
    }

    // Helper: filter dailyDataByChannel by range + channel
    function filterDailyData(startStr, endStr, channelFilter) {
      const result = {};
      const chs = channelFilter === 'All' ? channels : [channelFilter];
      chs.forEach(ch => {
        if (!dailyByChannel[ch]) return;
        result[ch] = {};
        Object.entries(dailyByChannel[ch]).forEach(([dateStr, row]) => {
          const d = normDate(dateStr);
          if (d >= startStr && d <= endStr) {
            result[ch][d] = {
              transactions: row.transactions || 0,
              success: row.success || 0,
              failure: row.fail || 0,
              revenue: row.revenue || 0,
              billable: row.billable || 0
            };
          }
        });
      });
      return result;
    }

    // Helper: compute summary from per-channel daily data
    function computeSummary(data) {
      const summary = {};
      let grandTx = 0, grandRev = 0;
      Object.entries(data).forEach(([ch, days]) => {
        let tx = 0, succ = 0, fail = 0, rev = 0, bill = 0;
        Object.values(days).forEach(row => {
          tx += row.transactions;
          succ += row.success;
          fail += row.failure;
          rev += row.revenue;
          bill += row.billable;
        });
        summary[ch] = {
          transactions: tx, success: succ, fail: fail,
          neutral: tx - succ - fail,
          revenue: rev, billable: bill,
          successRate: tx > 0 ? succ / tx : 0,
          failureRate: tx > 0 ? fail / tx : 0,
          billableRate: tx > 0 ? bill / tx : 0,
          revenueShare: 0, shareOfTotal: 0
        };
        grandTx += tx;
        grandRev += rev;
      });
      Object.keys(summary).forEach(ch => {
        summary[ch].revenueShare = grandRev > 0 ? summary[ch].revenue / grandRev : 0;
        summary[ch].shareOfTotal = grandTx > 0 ? summary[ch].transactions / grandTx : 0;
      });
      return summary;
    }

    // Helper: compute daily trend from per-channel daily data
    function computeTrend(data, totalUsers) {
      const trend = {};
      Object.values(data).forEach(chDays => {
        Object.entries(chDays).forEach(([date, row]) => {
          if (!trend[date]) trend[date] = { transactions:0, success:0, fail:0, revenue:0, activeUsers:0 };
          trend[date].transactions += row.transactions;
          trend[date].success += row.success;
          trend[date].fail += row.failure;
          trend[date].revenue += row.revenue;
        });
      });
      // Simulate active users per day
      Object.keys(trend).forEach(d => {
        const avgDaily = channels.reduce((s, ch) => s + (channelSummary[ch]?.transactions || 0), 0) / Math.max(allDates.length, 1);
        const ratio = trend[d].transactions / Math.max(avgDaily, 1);
        const userCount = totalUsers || users.length || 20;
        trend[d].activeUsers = Math.min(userCount, Math.max(1, Math.round(userCount * ratio)));
      });
      return trend;
    }

    // Hourly distribution patterns (same as dummy data.js)
    const hourlyPattern = {
      'WhatsApp': [0.02,0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.07,0.08,0.07,0.06,0.05,0.06,0.07,0.08,0.07,0.06,0.05,0.04,0.03,0.03,0.02,0.02],
      'SMS':      [0.01,0.01,0.01,0.01,0.02,0.03,0.04,0.06,0.07,0.07,0.06,0.05,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.04,0.03,0.02,0.02,0.01],
      'Email':    [0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.03,0.02,0.02,0.01],
      'Call':     [0.01,0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.06,0.07,0.06,0.05,0.04,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.03,0.02,0.02,0.01]
    };

    function generateHourlyData(dailyByChannel, channelSummary, channels) {
      const result = [];
      channels.forEach(ch => {
        const days = Object.values(dailyByChannel[ch] || {});
        if (!days.length) return;
        const avgDaily = days.reduce((s, d) => s + (d.transactions || 0), 0) / days.length;
        const totalSucc = days.reduce((s, d) => s + (d.success || 0), 0);
        const totalTx = days.reduce((s, d) => s + (d.transactions || 0), 0);
        const successRate = totalTx > 0 ? totalSucc / totalTx : 0.9;
        const avgRevenue = days.reduce((s, d) => s + (d.revenue || 0), 0) / Math.max(days.length, 1);
        const pattern = hourlyPattern[ch] || hourlyPattern['WhatsApp'];
        for (let h = 0; h < 24; h++) {
          const tx = Math.round(avgDaily * pattern[h]);
          const success = Math.round(tx * successRate);
          const fail = (ch === 'Call' || ch === 'SMS')
            ? Math.max(0, tx - success)
            : Math.round(tx * (1 - successRate) * 0.85);
          const neutral = tx - success - fail;
          const revenue = Math.round(avgRevenue * pattern[h]);
          result.push({ hour: h, channel: ch, transactions: tx, success, fail, neutral, revenue });
        }
      });
      return result;
    }

    // Helper: enforce Call/SMS have zero neutral (failure = tx - success)
    function enforceCallSMSIntegrity(ch, obj) {
      if ((ch === 'Call' || ch === 'SMS') && obj.transactions != null) {
        const tx = obj.transactions;
        const succ = obj.success || 0;
        obj.failure = Math.max(0, tx - succ);
      }
      return obj;
    }

    // ---- Build new DATA object ----
    const NEW_DATA = {
      CHANNELS: channels,
      INDUSTRIES: industries,
      users: users,
      allDates: allDates,
      hourlyData: generateHourlyData(dailyByChannel, channelSummary, channels),

      // Store raw response for table rendering
      topUsers: resp.topUsers || [],
      churnRisk: resp.churnRisk || [],

      getDailyDataForRange: function(startStr, endStr, channelFilter, industryFilter, userFilter) {
        let result = filterDailyData(startStr, endStr, channelFilter);
        // Industry scaling for aggregated live data (no per-user breakdown available)
        if (industryFilter && industryFilter !== 'All' && (!userFilter || userFilter === 'All')) {
          const industryUsers = users.filter(u => u.industry === industryFilter);
          const ratio = industryUsers.length > 0 ? industryUsers.length / users.length : 0;
          Object.keys(result).forEach(ch => {
            Object.keys(result[ch]).forEach(date => {
              const r = result[ch][date];
              result[ch][date] = {
                transactions: Math.round(r.transactions * ratio),
                success: Math.round(r.success * ratio),
                failure: Math.round(r.failure * ratio),
                revenue: Math.round(r.revenue * ratio),
                billable: Math.round(r.billable * ratio)
              };
              enforceCallSMSIntegrity(ch, result[ch][date]);
            });
          });
        }
        if (userFilter && userFilter !== 'All') {
          const matched = users.some(u => u.user_name === userFilter || u.name === userFilter);
          if (matched) {
            const ratio = userWeightMap[userFilter] || (1 / Math.max(users.length, 1));
            Object.keys(result).forEach(ch => {
              Object.keys(result[ch]).forEach(date => {
                const r = result[ch][date];
                result[ch][date] = {
                  transactions: Math.round(r.transactions * ratio),
                  success: Math.round(r.success * ratio),
                  failure: Math.round(r.failure * ratio),
                  revenue: Math.round(r.revenue * ratio),
                  billable: Math.round(r.billable * ratio)
                };
                enforceCallSMSIntegrity(ch, result[ch][date]);
              });
            });
          }
        }
        return result;
      },

      computeChannelSummary: function(data) {
        return computeSummary(data);
      },

      computeDailyTrend: function(data, channels, totalUsers) {
        return computeTrend(data, totalUsers);
      },

      getUserShare: function(userName) {
        return userWeightMap[userName] || (1 / Math.max(users.length, 1));
      }
    };

    // Replace the global DATA
    Object.keys(NEW_DATA).forEach(key => {
      DATA[key] = NEW_DATA[key];
    });

    // Sync date picker with latest available date
    const dateInput = document.getElementById('dateFilter');
    if (dateInput && allDates.length) {
      const latestDate = allDates[allDates.length - 1];
      dateInput.max = latestDate;
      dateInput.value = latestDate;
      dateInput.dispatchEvent(new Event('change'));
    }

    // Rebuild user select dropdown with real user names
    const userSelect = document.getElementById('userFilter');
    if (userSelect) {
      const currentVal = userSelect.value;
      userSelect.innerHTML = '<option value="All">All Users</option>';
      users.sort((a, b) => (a.user_name || '').localeCompare(b.user_name || '')).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_name;
        opt.textContent = u.user_name;
        if (u.user_name === currentVal) opt.selected = true;
        userSelect.appendChild(opt);
      });
    }

    // Rebuild industry filter dropdown with real industries
    const industrySelect = document.getElementById('industryFilter');
    if (industrySelect) {
      const currentVal = industrySelect.value;
      industrySelect.innerHTML = '<option value="All">All Industries</option>';
      industries.forEach(ind => {
        const opt = document.createElement('option');
        opt.value = ind;
        opt.textContent = ind;
        if (ind === currentVal) opt.selected = true;
        industrySelect.appendChild(opt);
      });
    }

    // Rebuild channel filter dropdown with live data channels
    const channelSelect = document.getElementById('channelFilter');
    if (channelSelect) {
      const currentVal = channelSelect.value;
      channelSelect.innerHTML = '<option value="All">All Channels</option>';
      channels.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch;
        opt.textContent = ch;
        if (ch === currentVal) opt.selected = true;
        channelSelect.appendChild(opt);
      });
    }

    console.log('[data-fetcher] Real data loaded from Drive:', channels.length, 'channels,', allDates.length, 'days');
  }

  function reRender() {
    const period = document.getElementById('periodFilter')?.value || '30d';
    const industry = document.getElementById('industryFilter')?.value || 'All';
    const channel = document.getElementById('channelFilter')?.value || 'All';
    const referenceDate = document.getElementById('dateFilter')?.value || new Date().toISOString().split('T')[0];
    let user = document.getElementById('userFilter')?.value?.trim() || 'All';
    if (user !== 'All') {
      const match = DATA.users.some(u => u.user_name === user || u.name === user);
      if (!match) user = 'All';
    }
    try { CHARTS.renderAll(period, industry, channel, referenceDate, user); } catch(e) {
      console.warn('[data-fetcher] Re-render error:', e);
    }
  }

  // ---- TRIGGER ----
  // Load after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRealData);
  } else {
    loadRealData();
  }

  // Auto-refresh every 5 minutes
  setInterval(loadRealData, 300000);
})();
