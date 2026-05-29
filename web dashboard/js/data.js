// ====================================================================
// data.js — Telcom OCA Dashboard Dummy Data
// Realistic 3-month dataset (Mar–May 2026)
// ====================================================================

let DATA;
try {
DATA = (() => {
  const CHANNELS = ['WhatsApp', 'SMS', 'Email', 'Call'];
  const INDUSTRIES = [
    'Financial Services', 'Retail', 'Healthcare', 'Education',
    'Technology', 'Telecommunication', 'Logistics', 'Government',
    'E-commerce', 'Media'
  ];

  // ---- USERS ----
  const users = [
    { id: 'USR001', name: 'PT Bank Central Asia', industry: 'Financial Services', joinDate: '2025-06-01' },
    { id: 'USR002', name: 'PT Bank Mandiri', industry: 'Financial Services', joinDate: '2025-07-15' },
    { id: 'USR003', name: 'PT Bank Rakyat Indonesia', industry: 'Financial Services', joinDate: '2025-05-10' },
    { id: 'USR004', name: 'PT Tokopedia', industry: 'E-commerce', joinDate: '2025-08-01' },
    { id: 'USR005', name: 'PT Shopee Indonesia', industry: 'E-commerce', joinDate: '2025-09-01' },
    { id: 'USR006', name: 'PT Bukalapak', industry: 'E-commerce', joinDate: '2025-10-15' },
    { id: 'USR007', name: 'PT Telkom Indonesia', industry: 'Telecommunication', joinDate: '2025-04-01' },
    { id: 'USR008', name: 'PT Indosat Ooredoo', industry: 'Telecommunication', joinDate: '2025-06-20' },
    { id: 'USR009', name: 'PT XL Axiata', industry: 'Telecommunication', joinDate: '2025-07-01' },
    { id: 'USR010', name: 'PT Gojek Indonesia', industry: 'Technology', joinDate: '2025-08-15' },
    { id: 'USR011', name: 'PT Grab Indonesia', industry: 'Technology', joinDate: '2025-09-20' },
    { id: 'USR012', name: 'PT Traveloka', industry: 'Technology', joinDate: '2025-10-01' },
    { id: 'USR013', name: 'PT Kimia Farma', industry: 'Healthcare', joinDate: '2025-11-01' },
    { id: 'USR014', name: 'PT Siloam Hospitals', industry: 'Healthcare', joinDate: '2025-06-01' },
    { id: 'USR015', name: 'PT Ruangguru', industry: 'Education', joinDate: '2025-08-01' },
    { id: 'USR016', name: 'PT Harapan Bangsa', industry: 'Education', joinDate: '2025-09-01' },
    { id: 'USR017', name: 'PT JNE Express', industry: 'Logistics', joinDate: '2025-07-10' },
    { id: 'USR018', name: 'PT J&T Express', industry: 'Logistics', joinDate: '2025-08-05' },
    { id: 'USR019', name: 'PT Pertamina', industry: 'Government', joinDate: '2025-05-20' },
    { id: 'USR020', name: 'PT Transmedia', industry: 'Media', joinDate: '2025-10-10' }
  ];

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  // ---- DATE HELPERS ----
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function generateDates(start, end) {
    const dates = [];
    const d = new Date(start);
    while (d <= end) {
      dates.push(formatDate(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  const startDate = new Date('2026-03-01');
  const endDate = new Date('2026-05-31');
  const allDates = generateDates(startDate, endDate);
  const totalDays = allDates.length;

  // ---- CHANNEL BASE METRICS (per day, per channel) ----
  // Typical daily volumes with realistic success rates
  const channelBase = {
    'WhatsApp': { avgDaily: 555, successRate: 0.95 },
    'SMS':      { avgDaily: 222, successRate: 0.90 },
    'Email':    { avgDaily: 444, successRate: 0.85 },
    'Call':     { avgDaily: 142, successRate: 0.72 }
  };

  // ---- GENERATE DAILY DATA ----
  function seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const rng = seededRandom(42);
  function rand(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function randFloat(min, max) { return rng() * (max - min) + min; }

  const dailyData = {};
  CHANNELS.forEach(ch => {
    dailyData[ch] = {};
  });

  allDates.forEach((date, idx) => {
    CHANNELS.forEach(ch => {
      const base = channelBase[ch];
      const dayOfWeek = new Date(date).getDay();
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 1.0;
      const noise = randFloat(0.7, 1.3);
      const tx = Math.round(base.avgDaily * weekendFactor * noise);
      const success = Math.round(tx * base.successRate * randFloat(0.92, 1.05));
      const rawFailure = Math.round(tx * (1 - base.successRate) * randFloat(0.7, 1.0));
      const failure = (ch === 'Call' || ch === 'SMS')
        ? tx - success
        : Math.min(rawFailure, Math.max(0, tx - success));
      const revenue = Math.round(tx * rand(1800, 5500));
      const billable = Math.round(tx * randFloat(0.65, 0.85));
      dailyData[ch][date] = { transactions: tx, success, failure, revenue, billable };
    });
  });

  // ---- PER-USER DATA (distribute daily totals across 20 users) ----
  const industryShares = {
    'Financial Services': 0.30, 'E-commerce': 0.18, 'Telecommunication': 0.15,
    'Technology': 0.12, 'Healthcare': 0.08, 'Education': 0.06,
    'Logistics': 0.06, 'Government': 0.03, 'Media': 0.02
  };
  const userWeights = users.map((u, i) => {
    const indShare = industryShares[u.industry] || 0.04;
    const count = users.filter(u2 => u2.industry === u.industry).length;
    return (indShare / count) * (0.7 + (i % 5) * 0.15);
  });
  const weightSum = userWeights.reduce((s, v) => s + v, 0);
  userWeights.forEach((v, i) => userWeights[i] = v / weightSum);

  const userData = {};
  users.forEach((u, idx) => {
    userData[u.id] = {};
    // Per-channel preference factor: gives each user a unique channel mix
    const chPref = {};
    CHANNELS.forEach((ch, ci) => {
      const seed = idx * 31 + ci * 17 + 7;
      chPref[ch] = 0.4 + ((seed * 13) % 100) / 100;
    });
    const prefAvg = Object.values(chPref).reduce((s, v) => s + v, 0) / CHANNELS.length;
    CHANNELS.forEach(ch => { chPref[ch] /= prefAvg; });

    CHANNELS.forEach(ch => {
      userData[u.id][ch] = {};
      allDates.forEach(date => {
        if (dailyData[ch][date]) {
          const src = dailyData[ch][date];
          const factor = userWeights[idx] * chPref[ch];
          const utx = Math.round(src.transactions * factor);
          const usucc = Math.round(src.success * factor);
          const ufail = (ch === 'Call' || ch === 'SMS')
            ? Math.max(0, utx - usucc)
            : Math.min(Math.round(src.failure * factor), Math.max(0, utx - usucc));
          userData[u.id][ch][date] = {
            transactions: utx,
            success: usucc,
            failure: ufail,
            revenue: Math.round(src.revenue * factor),
            billable: Math.round(src.billable * factor)
          };
        }
      });
    });
  });

  // ---- HOURLY DATA (average hourly pattern per channel) ----
  const hourlyPattern = {
    'WhatsApp': [0.02,0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.07,0.08,0.07,0.06,0.05,0.06,0.07,0.08,0.07,0.06,0.05,0.04,0.03,0.03,0.02,0.02],
    'SMS':      [0.01,0.01,0.01,0.01,0.02,0.03,0.04,0.06,0.07,0.07,0.06,0.05,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.04,0.03,0.02,0.02,0.01],
    'Email':    [0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.03,0.02,0.02,0.01],
    'Call':     [0.01,0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.06,0.07,0.06,0.05,0.04,0.05,0.06,0.07,0.07,0.06,0.05,0.04,0.03,0.02,0.02,0.01]
  };

  const hourlyData = [];
  for (let h = 0; h < 24; h++) {
    CHANNELS.forEach(ch => {
      const base = channelBase[ch];
      const dailyTx = base.avgDaily;
      const tx = Math.round(dailyTx * hourlyPattern[ch][h] * randFloat(0.8, 1.2));
      const success = Math.round(tx * base.successRate * randFloat(0.95, 1.02));
      const rawFail = Math.round(tx * (1 - base.successRate) * randFloat(0.7, 1.0));
      const fail = (ch === 'Call' || ch === 'SMS')
        ? tx - success
        : Math.min(rawFail, Math.max(0, tx - success));
      const neutral = tx - success - fail;
      const revenue = Math.round(tx * rand(1800, 5500));
      hourlyData.push({ hour: h, channel: ch, transactions: tx, success, fail, neutral, revenue });
    });
  }

  // ---- HELPER: GET DAILY DATA FOR A DATE RANGE ----
  function getDailyDataForRange(startDateStr, endDateStr, channelFilter, industryFilter, userFilter) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const result = {};

    CHANNELS.forEach(ch => {
      if (channelFilter !== 'All' && ch !== channelFilter) return;
      result[ch] = {};
    });

    const channelsToInclude = Object.keys(result);

    // User-specific data path
    if (userFilter && userFilter !== 'All') {
      const matchedUser = users.find(u => u.name === userFilter);
      if (matchedUser && userData[matchedUser.id]) {
        const uid = matchedUser.id;
        const d = new Date(start);
        while (d <= end) {
          const dateStr = formatDate(d);
          channelsToInclude.forEach(ch => {
            if (userData[uid][ch] && userData[uid][ch][dateStr]) {
              result[ch][dateStr] = userData[uid][ch][dateStr];
            }
          });
          d.setDate(d.getDate() + 1);
        }
        return result;
      }
    }

    // Industry-specific data path (aggregate data for all users in the industry)
    if (industryFilter && industryFilter !== 'All') {
      const industryUsers = users.filter(u => u.industry === industryFilter);
      const d = new Date(start);
      while (d <= end) {
        const dateStr = formatDate(d);
        channelsToInclude.forEach(ch => {
          let tx = 0, success = 0, failure = 0, revenue = 0, billable = 0;
          let hasData = false;
          industryUsers.forEach(u => {
            if (userData[u.id] && userData[u.id][ch] && userData[u.id][ch][dateStr]) {
              const row = userData[u.id][ch][dateStr];
              tx += row.transactions;
              success += row.success;
              failure += row.failure;
              revenue += row.revenue;
              billable += row.billable;
              hasData = true;
            }
          });
          if (hasData) {
            if (!result[ch][dateStr]) {
              result[ch][dateStr] = { transactions: 0, success: 0, failure: 0, revenue: 0, billable: 0 };
            }
            result[ch][dateStr].transactions += tx;
            result[ch][dateStr].success += success;
            result[ch][dateStr].failure += failure;
            result[ch][dateStr].revenue += revenue;
            result[ch][dateStr].billable += billable;
          }
        });
        d.setDate(d.getDate() + 1);
      }
      return result;
    }

    // Aggregate data path (no filters)
    const d = new Date(start);
    while (d <= end) {
      const dateStr = formatDate(d);
      channelsToInclude.forEach(ch => {
        if (dailyData[ch] && dailyData[ch][dateStr]) {
          result[ch][dateStr] = dailyData[ch][dateStr];
        }
      });
      d.setDate(d.getDate() + 1);
    }

    return result;
  }

  // ---- COMPUTED DATASETS (from the raw daily data) ----

  // Channel Summary
  function computeChannelSummary(data) {
    const summary = {};
    const grandTotal = { transactions: 0, revenue: 0 };
    CHANNELS.forEach(ch => {
      if (!data[ch]) return;
      let tx = 0, succ = 0, rev = 0, bill = 0, fail = 0, neutral = 0;
      Object.values(data[ch]).forEach(row => {
        tx += row.transactions;
        succ += row.success;
        fail += row.failure;
        neutral += (row.transactions - row.success - row.failure);
        rev += row.revenue;
        bill += row.billable;
      });
      const billableTx = Math.round(bill);
      summary[ch] = { transactions: tx, success: succ, fail, neutral, revenue: rev, billable: billableTx };
      grandTotal.transactions += tx;
      grandTotal.revenue += rev;
    });
    CHANNELS.forEach(ch => {
      if (summary[ch]) {
        summary[ch].successRate = summary[ch].transactions > 0 ? summary[ch].success / summary[ch].transactions : 0;
        summary[ch].failureRate = summary[ch].transactions > 0 ? summary[ch].fail / summary[ch].transactions : 0;
        summary[ch].billableRate = summary[ch].transactions > 0 ? summary[ch].billable / summary[ch].transactions : 0;
        summary[ch].revenueShare = grandTotal.revenue > 0 ? summary[ch].revenue / grandTotal.revenue : 0;
        summary[ch].shareOfTotal = grandTotal.transactions > 0 ? summary[ch].transactions / grandTotal.transactions : 0;
      }
    });
    return summary;
  }

  // Daily trend (aggregated across all channels)
  function computeDailyTrend(data, channels, totalUsers) {
    const trend = {};
    const chs = channels || CHANNELS.filter(ch => data[ch]);
    const dates = new Set();
    chs.forEach(ch => { Object.keys(data[ch]).forEach(d => dates.add(d)); });
    const userCount = totalUsers || users.length;
    Array.from(dates).sort().forEach(date => {
      let tx = 0, succ = 0, rev = 0, users = 0, fail = 0;
      chs.forEach(ch => {
        if (data[ch][date]) {
          const row = data[ch][date];
          tx += row.transactions;
          succ += row.success;
          fail += row.failure;
          rev += row.revenue;
        }
      });
      // Simulate active users as a fraction of total users
      const totalAvgDaily = chs.reduce((s, ch) => s + ((channelBase[ch] && channelBase[ch].avgDaily) || 0), 0);
      users = Math.round(userCount * (tx / (Math.max(totalAvgDaily, 1) * 1.5)));
      if (users < 1) users = 1;
      if (users > userCount) users = userCount;
      trend[date] = { transactions: tx, success: succ, fail, revenue: rev, activeUsers: users };
    });
    return trend;
  }

  // ---- GET USER SHARE (fraction of total data attributed to this user) ----
  function getUserShare(userName) {
    const idx = users.findIndex(u => u.name === userName);
    if (idx === -1) return 0;
    return userWeights[idx];
  }

  // ---- INITIAL STATE ----
  const initialData = getDailyDataForRange('2026-03-01', '2026-05-31', 'All', 'All');
  const initialSummary = computeChannelSummary(initialData);
  const initialTrend = computeDailyTrend(initialData);

  // ---- INACTIVITY COMPUTATION ----
  // For each user, find the average interval (gap in days) between active days,
  // then average across all filtered users.
  function computeInactivityData(startStr, endStr, channelFilter, industryFilter, userFilter) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    let relevantUsers = users;

    if (industryFilter && industryFilter !== 'All') {
      relevantUsers = relevantUsers.filter(u => u.industry === industryFilter);
    }
    if (userFilter && userFilter !== 'All') {
      relevantUsers = relevantUsers.filter(u => u.name === userFilter || u.user_name === userFilter);
    }

    const channelsToCheck = channelFilter && channelFilter !== 'All' ? [channelFilter] : CHANNELS;
    let totalAvgInterval = 0;
    let maxInactiveDay = 0;
    let userCount = 0;

    relevantUsers.forEach(u => {
      // Collect all dates where user had any transaction
      const activeDates = [];
      const d = new Date(start);
      while (d <= end) {
        const dateStr = formatDate(d);
        let hasActivity = false;

        for (let ci = 0; ci < channelsToCheck.length; ci++) {
          const ch = channelsToCheck[ci];
          if (userData[u.id] && userData[u.id][ch] && userData[u.id][ch][dateStr] && userData[u.id][ch][dateStr].transactions > 0) {
            hasActivity = true;
            break;
          }
        }

        if (hasActivity) {
          activeDates.push(new Date(d));
        }
        d.setDate(d.getDate() + 1);
      }

      // Calculate gaps between consecutive active days
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
        // User was active only once — gap from start to that date or that date to end
        const activeDate = activeDates[0];
        const diffFromStart = Math.round((activeDate - start) / (1000 * 60 * 60 * 24));
        const diffToEnd = Math.round((end - activeDate) / (1000 * 60 * 60 * 24));
        const singleGap = Math.max(diffFromStart, diffToEnd);
        totalAvgInterval += singleGap;
        if (singleGap > maxInactiveDay) maxInactiveDay = singleGap;
        userCount++;
      }
      // If user has 0 active days, skip (no interval to compute)
    });

    const avgInactiveInterval = userCount > 0 ? Math.round(totalAvgInterval / userCount) : 0;

    return {
      avgInactiveInterval,
      totalUsers: userCount,
      maxInactiveDay
    };
  }

  // ---- RETURN PUBLIC API ----
  return {
    CHANNELS,
    INDUSTRIES,
    users,
    userMap,
    allDates,
    hourlyData,
    dailyData,
    channelBase,
    getDailyDataForRange,
    getUserShare,
    computeChannelSummary,
    computeDailyTrend,
    computeInactivityData,
    initialSummary,
    initialTrend,
    initialData
  };
})();
} catch (e) {
  console.error('[data.js] Failed to generate dummy data:', e);
  DATA = {
    CHANNELS: ['WhatsApp', 'SMS', 'Email', 'Call'],
    INDUSTRIES: [],
    users: [],
    userMap: {},
    allDates: [],
    hourlyData: [],
    dailyData: {},
    channelBase: {},
    getDailyDataForRange: function() { return {}; },
    getUserShare: function() { return 0; },
    computeChannelSummary: function() { return {}; },
    computeDailyTrend: function() { return {}; },
    computeInactivityData: function() { return { avgInactiveInterval: 0, totalUsers: 0, maxInactiveDay: 0 }; },
    initialSummary: {},
    initialTrend: {},
    initialData: {}
  };
}
