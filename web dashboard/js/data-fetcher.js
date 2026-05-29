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
  let fetchInProgress = false;

  function showLoading(on) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = on ? 'flex' : 'none';
  }

  function showDataSourceStatus(status, message) {
    const el = document.getElementById('data-source-status');
    if (!el) return;
    el.style.display = 'inline';
    el.className = 'data-source-status ' + status;
    el.textContent = message;
  }

  function loadRealData() {
    if (fetchInProgress) return;
    fetchInProgress = true;
    showLoading(true);

    fetch(APPS_SCRIPT_URL)
      .then(res => res.json())
      .then(json => {
        showLoading(false);
        fetchInProgress = false;
        fetchAttempted = true;
        if (json.error) {
          console.warn('[data-fetcher] Apps Script error:', json.error);
          showDataSourceStatus('error', 'Live data error — using demo data');
          return;
        }
        buildDataFromResponse(json);
        reRender();
        showDataSourceStatus('live', '● Live data connected');
      })
      .catch(err => {
        showLoading(false);
        fetchInProgress = false;
        console.warn('[data-fetcher] Fetch failed:', err.message);
        showDataSourceStatus('offline', 'Offline — using demo data');
      });
  }

  function buildDataFromResponse(resp) {
    const currentYear = new Date().getFullYear();
    function fixYear(d) {
      if (!d) return '';
      const parts = d.split('-');
      if (parts.length >= 1) {
        const yr = parseInt(parts[0], 10);
        if (yr < 2020 || yr > 2030) {
          parts[0] = String(currentYear);
          return parts.join('-');
        }
      }
      return d;
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
              failure: row.failure || 0,
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
          transactions: tx, success: succ, failure: fail,
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
          if (!trend[date]) trend[date] = { transactions:0, success:0, failure:0, revenue:0, activeUsers:0 };
          trend[date].transactions += row.transactions;
          trend[date].success += row.success;
          trend[date].failure += row.failure;
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

    // Hourly distribution patterns (normalized to sum to 1.0)
    const hourlyPattern = {
      'WhatsApp': [0.0196,0.0098,0.0098,0.0098,0.0098,0.0196,0.0294,0.0490,0.0686,0.0784,0.0686,0.0588,0.0490,0.0588,0.0686,0.0784,0.0686,0.0588,0.0490,0.0392,0.0294,0.0294,0.0196,0.0196],
      'SMS':      [0.0104,0.0104,0.0104,0.0104,0.0208,0.0313,0.0417,0.0625,0.0729,0.0729,0.0625,0.0521,0.0521,0.0625,0.0729,0.0729,0.0625,0.0521,0.0417,0.0417,0.0313,0.0208,0.0208,0.0104],
      'Email':    [0.0103,0.0103,0.0103,0.0103,0.0206,0.0309,0.0515,0.0619,0.0722,0.0722,0.0619,0.0515,0.0412,0.0515,0.0619,0.0722,0.0722,0.0619,0.0515,0.0412,0.0309,0.0206,0.0206,0.0103],
      'Call':     [0.0110,0.0110,0.0110,0.0110,0.0110,0.0220,0.0330,0.0549,0.0659,0.0769,0.0659,0.0549,0.0440,0.0549,0.0659,0.0769,0.0769,0.0659,0.0549,0.0440,0.0330,0.0220,0.0220,0.0110]
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
          const failure = (ch === 'Call' || ch === 'SMS')
            ? Math.max(0, tx - success)
            : Math.round(tx * (1 - successRate) * 0.85);
          const neutral = tx - success - failure;
          const revenue = Math.round(avgRevenue * pattern[h]);
          result.push({ hour: h, channel: ch, transactions: tx, success, failure, neutral, revenue });
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
        if (obj.fail != null) obj.fail = obj.failure;
        if (obj.neutral != null) obj.neutral = 0;
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
      },

      computeInactivityData: function(startStr, endStr, channelFilter, industryFilter, userFilter) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        let relevantUsers = users;

        if (industryFilter && industryFilter !== 'All') {
          relevantUsers = relevantUsers.filter(u => u.industry === industryFilter);
        }
        if (userFilter && userFilter !== 'All') {
          relevantUsers = relevantUsers.filter(u => u.user_name === userFilter || u.name === userFilter);
        }

        const channelsToCheck = channelFilter && channelFilter !== 'All' ? [channelFilter] : channels;

        // Simple deterministic hash for simulating per-user daily activity
        function simpleHash(str) {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash) / 2147483647;
        }

        // Check if a channel has aggregate activity on a given date
        function channelHasActivity(ch, dateStr) {
          if (dailyByChannel[ch] && dailyByChannel[ch][dateStr]) {
            return dailyByChannel[ch][dateStr].transactions > 0;
          }
          return false;
        }

        let totalAvgInterval = 0;
        let maxInactiveDay = 0;
        let userCount = 0;

        relevantUsers.forEach(u => {
          const userWeight = userWeightMap[u.user_name] || (1 / Math.max(users.length, 1));
          const activeDates = [];
          const d = new Date(start);
          while (d <= end) {
            const dateStr = d.toISOString().split('T')[0];

            // Simulate per-user activity: user is active if:
            // 1. At least one channel has aggregate activity on this date, AND
            // 2. A deterministic hash (userId + date) falls within user's weight probability
            let hasActivity = false;
            for (let ci = 0; ci < channelsToCheck.length; ci++) {
              const ch = channelsToCheck[ci];
              if (channelHasActivity(ch, dateStr)) {
                const hash = simpleHash(u.id + dateStr);
                if (hash < userWeight * channelsToCheck.length) {
                  hasActivity = true;
                  break;
                }
              }
            }

            if (hasActivity) {
              activeDates.push(new Date(d));
            }
            d.setDate(d.getDate() + 1);
          }

          if (activeDates.length >= 2) {
            let totalGap = 0;
            let gapCount = 0;
            let maxGap = 0;

            for (let i = 1; i < activeDates.length; i++) {
              const diffTime = activeDates[i].getTime() - activeDates[i - 1].getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              totalGap += diffDays;
              gapCount++;
              if (diffDays > maxGap) maxGap = diffDays;
            }

            const avgGap = gapCount > 0 ? totalGap / gapCount : 0;
            totalAvgInterval += avgGap;
            if (maxGap > maxInactiveDay) maxInactiveDay = maxGap;
            userCount++;
          } else if (activeDates.length === 1) {
            const activeDate = activeDates[0];
            const diffFromStart = Math.round((activeDate - start) / (1000 * 60 * 60 * 24));
            const diffToEnd = Math.round((end - activeDate) / (1000 * 60 * 60 * 24));
            const singleGap = Math.max(diffFromStart, diffToEnd);
            totalAvgInterval += singleGap;
            if (singleGap > maxInactiveDay) maxInactiveDay = singleGap;
            userCount++;
          }
        });

        const avgInactiveInterval = userCount > 0 ? Math.round(totalAvgInterval / userCount) : 0;

        return {
          avgInactiveInterval: avgInactiveInterval,
          totalUsers: userCount,
          maxInactiveDay: maxInactiveDay
        };
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
