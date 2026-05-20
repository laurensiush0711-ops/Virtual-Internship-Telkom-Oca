// ====================================================================
// charts.js — Chart.js Configurations for Telcom OCA Dashboard
// ====================================================================

const CHARTS = (() => {
  const COLORS = {
    whatsapp: '#25D366',
    sms: '#34B7F1',
    email: '#6C5CE7',
    call: '#FD79A8',
    success: '#00B894',
    failure: '#E17055',
    neutral: '#DFE6E9',
    revenue: '#FDCB6E',
    primary: '#CC0000',
    darkBg: '#2D3436'
  };

  const channelColors = {
    'WhatsApp': COLORS.whatsapp,
    'SMS': COLORS.sms,
    'Email': COLORS.email,
    'Call': COLORS.call
  };

  let chartInstances = {};

  // ---- HELPERS ----
  function formatIDR(val) {
    if (val >= 1e9) return 'Rp' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return 'Rp' + (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return 'Rp' + (val / 1e3).toFixed(0) + 'K';
    return 'Rp' + val;
  }

  function formatNum(val) {
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
    return val.toString();
  }

  function formatPct(val) {
    return (val * 100).toFixed(1) + '%';
  }

  function destroyChart(key) {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      delete chartInstances[key];
    }
  }

  // ---- KPI CARDS ----
  function updateKPIs(data, prevData, summary, trend, activeUserCount, prevActiveUserCount) {
    // Current period
    let totalTx = 0, totalRev = 0, totalSucc = 0, totalFail = 0, totalBill = 0;
    Object.values(data).forEach(chData => {
      Object.values(chData).forEach(row => {
        totalTx += row.transactions;
        totalSucc += row.success;
        totalFail += row.failure;
        totalRev += row.revenue;
        totalBill += row.billable;
      });
    });

    const activeUsers = activeUserCount != null ? activeUserCount : 20;
    const successRate = totalTx > 0 ? totalSucc / totalTx : 0;
    const billableRate = totalTx > 0 ? totalBill / totalTx : 0;

    // Churn rate: at-risk users / total users
    const totalUsers = DATA.users ? DATA.users.length : 20;
    const atRiskUsers = (DATA.churnRisk && DATA.churnRisk.length)
      ? DATA.churnRisk.length
      : Math.round(totalUsers * 0.25);
    const churnRate = totalUsers > 0 ? atRiskUsers / totalUsers : 0;

    // Previous period
    let prevTx = 0, prevRev = 0, prevSucc = 0, prevFail = 0, prevBill = 0;
    if (prevData) {
      Object.values(prevData).forEach(chData => {
        Object.values(chData).forEach(row => {
          prevTx += row.transactions;
          prevSucc += row.success;
          prevFail += row.failure;
          prevRev += row.revenue;
          prevBill += row.billable;
        });
      });
    }

    const prevActiveUsers = prevActiveUserCount != null ? prevActiveUserCount : 20;
    const prevSuccessRate = prevTx > 0 ? prevSucc / prevTx : 0;
    const prevBillableRate = prevTx > 0 ? prevBill / prevTx : 0;

    // Helper: update a delta element
    // For "inverted" metrics (failure rate), a decrease is good (green up)
    function setDelta(id, current, previous, invert) {
      const el = document.getElementById(id);
      if (!el) return;
      if (!previous || previous === 0) {
        el.textContent = 'N/A';
        el.className = 'kpi-delta flat';
        return;
      }
      const raw = ((current - previous) / previous) * 100;
      if (Math.abs(raw) < 0.05) {
        el.textContent = '0.0%';
        el.className = 'kpi-delta flat';
      } else if (invert) {
        if (raw > 0) {
          el.textContent = raw.toFixed(1) + '%';
          el.className = 'kpi-delta up-fail';
        } else {
          el.textContent = Math.abs(raw).toFixed(1) + '%';
          el.className = 'kpi-delta down-succ';
        }
      } else {
        if (raw > 0) {
          el.textContent = raw.toFixed(1) + '%';
          el.className = 'kpi-delta up';
        } else {
          el.textContent = Math.abs(raw).toFixed(1) + '%';
          el.className = 'kpi-delta down';
        }
      }
    }

    // Update KPI values
    document.getElementById('kpi-total-tx').textContent = formatNum(totalTx);
    document.getElementById('kpi-active-users').textContent = activeUsers;
    document.getElementById('kpi-active-users').className = 'kpi-value' + (prevActiveUserCount > activeUserCount ? ' trend-down' : ' trend-up');

    const successRateEl = document.getElementById('kpi-success-rate');
    successRateEl.textContent = formatPct(successRate);
    successRateEl.className = 'kpi-value';

    document.getElementById('kpi-churn-rate').textContent = formatPct(churnRate);
    document.getElementById('kpi-revenue').textContent = formatIDR(totalRev);
    document.getElementById('kpi-billable-rate').textContent = formatPct(billableRate);

    // Update deltas
    setDelta('delta-total-tx', totalTx, prevTx);
    setDelta('delta-active-users', activeUsers, prevActiveUsers);
    setDelta('delta-success-rate', successRate, prevSuccessRate);
    setDelta('delta-churn-rate', churnRate, null);
    setDelta('delta-revenue', totalRev, prevRev);
    setDelta('delta-billable-rate', billableRate, prevBillableRate);
  }

  // ---- CHANNEL VOLUME BAR CHART ----
  function renderChannelVolume(canvasId, summary) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const channels = Object.keys(summary).filter(ch => summary[ch].transactions > 0);
    if (!channels.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }
    const labels = channels;
    const volumes = channels.map(ch => summary[ch].transactions);
    const colors = channels.map(ch => channelColors[ch]);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Transactions',
          data: volumes,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => 'Transactions: ' + formatNum(ctx.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => formatNum(v) }
          }
        }
      }
    });
  }

  // ---- REVENUE BY CHANNEL DONUT ----
  function renderRevenueDonut(canvasId, summary) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const channels = Object.keys(summary).filter(ch => summary[ch].revenue > 0);
    if (!channels.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }
    const revenues = channels.map(ch => summary[ch].revenue);
    const colors = channels.map(ch => channelColors[ch]);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: channels,
        datasets: [{
          data: revenues,
          backgroundColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ctx.label + ': ' + formatIDR(ctx.raw) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  // ---- DAILY TRANSACTION TREND LINE ----
  function renderDailyTxTrend(canvasId, trend, dataByChannel) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const dates = Object.keys(trend).sort();
    if (!dates.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }

    const labels = dates.map(d => { const p = d.split('-'); return p[1] + '/' + p[2]; });
    const dailyTx = dates.map(d => trend[d].transactions);

    // 7-day rolling average
    const rolling7 = dailyTx.map((_, i) => {
      const window = dailyTx.slice(Math.max(0, i - 6), i + 1);
      return Math.round(window.reduce((s, v) => s + v, 0) / window.length);
    });

    const datasets = [{
      label: 'Daily',
      data: dailyTx,
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary + '20',
      fill: true,
      tension: 0.3,
      pointRadius: 1
    }, {
      label: '7-day avg',
      data: rolling7,
      borderColor: COLORS.primary,
      borderDash: [4, 3],
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 0
    }];

    // Channel-level lines (when no channel filter is active)
    if (dataByChannel) {
      const channelKeys = Object.keys(dataByChannel).filter(ch => ch !== '__meta__');
      channelKeys.forEach(ch => {
        const chData = dates.map(d => (dataByChannel[ch] && dataByChannel[ch][d]) ? dataByChannel[ch][d].transactions : null);
        datasets.push({
          label: ch,
          data: chData,
          borderColor: channelColors[ch] || COLORS.neutral,
          borderWidth: 1,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          hidden: true
        });
      });
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': ' + formatNum(ctx.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => formatNum(v) }
          },
          x: {
            ticks: { maxTicksLimit: 10, maxRotation: 45 }
          }
        }
      }
    });
  }

  // ---- DAILY REVENUE TREND LINE ----
  function renderDailyRevenueTrend(canvasId, trend, dataByChannel) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const dates = Object.keys(trend).sort();
    if (!dates.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }

    const labels = dates.map(d => { const p = d.split('-'); return p[1] + '/' + p[2]; });
    const dailyRev = dates.map(d => trend[d].revenue);

    // 7-day rolling average
    const rolling7 = dailyRev.map((_, i) => {
      const window = dailyRev.slice(Math.max(0, i - 6), i + 1);
      return Math.round(window.reduce((s, v) => s + v, 0) / window.length);
    });

    const datasets = [{
      label: 'Daily Revenue',
      data: dailyRev,
      borderColor: COLORS.revenue,
      backgroundColor: COLORS.revenue + '20',
      fill: true,
      tension: 0.3,
      pointRadius: 1
    }, {
      label: '7-day avg',
      data: rolling7,
      borderColor: COLORS.revenue,
      borderDash: [4, 3],
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 0
    }];

    // Channel-level lines
    if (dataByChannel) {
      const channelKeys = Object.keys(dataByChannel).filter(ch => ch !== '__meta__');
      channelKeys.forEach(ch => {
        const chData = dates.map(d => (dataByChannel[ch] && dataByChannel[ch][d]) ? dataByChannel[ch][d].revenue : null);
        datasets.push({
          label: ch,
          data: chData,
          borderColor: channelColors[ch] || COLORS.neutral,
          borderWidth: 1,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          hidden: true
        });
      });
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': ' + formatIDR(ctx.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => formatIDR(v) }
          },
          x: {
            ticks: { maxTicksLimit: 10, maxRotation: 45 }
          }
        }
      }
    });
  }

  // ---- SUCCESS RATE BY CHANNEL BAR ----
  function renderSuccessRateByChannel(canvasId, summary) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const channels = Object.keys(summary).filter(ch => summary[ch].transactions > 0);
    if (!channels.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }
    const successRates = channels.map(ch => summary[ch].successRate);
    const failureRates = channels.map(ch => summary[ch].failureRate);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: channels,
        datasets: [
          {
            label: 'Success Rate',
            data: successRates,
            backgroundColor: COLORS.success,
            borderRadius: 4
          },
          {
            label: 'Failure Rate',
            data: failureRates,
            backgroundColor: COLORS.failure,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': ' + formatPct(ctx.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            ticks: { callback: v => formatPct(v) }
          }
        }
      }
    });
  }

  // ---- STATUS DISTRIBUTION STACKED BAR ----
  function renderStatusDistribution(canvasId, summary) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const channels = Object.keys(summary).filter(ch => summary[ch].transactions > 0);
    if (!channels.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: channels,
        datasets: [
          {
            label: 'Success',
            data: channels.map(ch => summary[ch].success),
            backgroundColor: COLORS.success
          },
          {
            label: 'Failure',
            data: channels.map(ch => summary[ch].fail),
            backgroundColor: COLORS.failure
          },
          {
            label: 'Neutral',
            data: channels.map(ch => summary[ch].neutral || 0),
            backgroundColor: COLORS.neutral
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': ' + formatNum(ctx.raw)
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            ticks: { callback: v => formatNum(v) }
          }
        }
      }
    });
  }

  // ---- TOP REVENUE USERS TABLE ----
  function renderTopUsersTable(canvasId, summary, industryFilter, userFilter) {
    const container = document.getElementById('top-users-table');
    if (!container) return;

    let userRevenue;

    // Use real data if available (from Apps Script)
    if (DATA.topUsers && DATA.topUsers.length) {
      userRevenue = DATA.topUsers
        .filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                     (userFilter === 'All' || u.user_name === userFilter))
        .map(u => ({
          name: u.user_name,
          industry: u.industry,
          revenue: u.total_revenue,
          transactions: u.total_transactions,
          channels: u.channels_used
        }));
    } else {
      // Fallback: generate from dummy data
      const allUsers = DATA.users.filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                                               (userFilter === 'All' || u.name === userFilter || u.user_name === userFilter));
      const totalRev = Object.values(summary).reduce((s, ch) => s + ch.revenue, 0);
      userRevenue = allUsers.map((u, i) => {
        const share = (allUsers.length - i) / (allUsers.length * (allUsers.length + 1) / 2);
        const rev = Math.round(totalRev * share * 0.6);
        return { name: u.user_name || u.name, industry: u.industry, revenue: rev, transactions: Math.round(rev / 2500) };
      }).sort((a, b) => b.revenue - a.revenue);
    }

    if (!userRevenue.length) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">No data matches current filters</div>';
      return;
    }

    const totalRev = userRevenue.reduce((s, u) => s + u.revenue, 0);

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>Industry</th>
            <th>Transactions</th>
            <th>Revenue</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
    `;

    userRevenue.slice(0, 20).forEach((u, i) => {
      const share = totalRev > 0 ? (u.revenue / totalRev * 100).toFixed(1) : '0.0';
      html += `
        <tr>
          <td>${i + 1}</td>
          <td>${u.name}</td>
          <td>${u.industry}</td>
          <td>${formatNum(u.transactions)}</td>
          <td>${formatIDR(u.revenue)}</td>
          <td>${share}%</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ---- CHURN RISK TABLE ----
  function renderChurnRiskTable(industryFilter, userFilter) {
    const container = document.getElementById('churn-risk-table');
    if (!container) return;

    let churnUsers;

    // Use real data if available (from Apps Script)
    if (DATA.churnRisk && DATA.churnRisk.length) {
      churnUsers = DATA.churnRisk
        .filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                     (userFilter === 'All' || u.user_name === userFilter))
        .map(u => ({
          name: u.user_name,
          industry: u.industry,
          daysInactive: u.days_inactive,
          riskScore: u.risk_score,
          revenue: u.total_revenue
        }))
        .sort((a, b) => b.riskScore - a.riskScore);
    } else {
      // Fallback: generate simulated churn data
      churnUsers = DATA.users
        .filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                     (userFilter === 'All' || u.name === userFilter || u.user_name === userFilter))
        .map((u, i) => {
          const seed = u.id ? u.id.charCodeAt(u.id.length - 1) : (i * 7 + 13);
          const daysInactive = 2 + (seed % 25);
          const riskScore = Math.min(95, 20 + daysInactive * 2 + (seed % 15));
          return { name: u.user_name || u.name, industry: u.industry, riskScore, daysInactive };
        })
        .filter(u => u.riskScore > 40)
        .sort((a, b) => b.riskScore - a.riskScore);
    }

    if (!churnUsers.length) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">No at-risk users match current filters</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Industry</th>
            <th>Days Inactive</th>
            <th>Risk Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    churnUsers.forEach(u => {
      const status = u.riskScore >= 70 ? 'Critical' : u.riskScore >= 50 ? 'Warning' : 'Monitor';
      const statusClass = status.toLowerCase();
      html += `
        <tr>
          <td>${u.name}</td>
          <td>${u.industry}</td>
          <td>${u.daysInactive}</td>
          <td>${u.riskScore}</td>
          <td><span class="badge badge-${statusClass}">${status}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ---- WHATSAPP READ RATE LINE ----
  function renderWhatsAppReadRate(canvasId, trend, data) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const dates = Object.keys(trend).sort();
    const waData = data && data['WhatsApp'] ? data['WhatsApp'] : {};
    const deliveryRates = dates.map(d => {
      if (waData[d]) {
        return waData[d].transactions > 0 ? waData[d].success / waData[d].transactions : 0;
      }
      return trend[d].transactions > 0 ? trend[d].success / trend[d].transactions : 0;
    });
    const totalDelivered = dates.map(d => waData[d] ? waData[d].success : trend[d].success);
    const totalRead = dates.map((d, i) => Math.round(totalDelivered[i] * (0.38 + (i % 5) * 0.03)));
    const readRates = totalDelivered.map((d, i) => d > 0 ? totalRead[i] / d : 0);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dates.map(d => {
          if (d.includes('T')) return d.split('T')[1].slice(0, 5);
          const parts = d.split('-');
          return parts[1] + '/' + parts[2];
        }),
        datasets: [
          {
            label: 'Delivery Rate',
            data: deliveryRates,
            borderColor: COLORS.success,
            backgroundColor: COLORS.success + '20',
            fill: true,
            tension: 0.3,
            pointRadius: 1
          },
          {
            label: 'Read Rate',
            data: readRates,
            borderColor: COLORS.whatsapp,
            backgroundColor: COLORS.whatsapp + '20',
            fill: true,
            tension: 0.3,
            pointRadius: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': ' + formatPct(ctx.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            ticks: { callback: v => formatPct(v) }
          },
          x: {
            ticks: { maxTicksLimit: 10, maxRotation: 45 }
          }
        }
      }
    });
  }

  // ---- COMBINED TRANSACTION + REVENUE TREND (dual-axis) ----
  function renderCombinedTrend(canvasId, trend) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const dates = Object.keys(trend).sort();
    if (!dates.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }

    const isHourly = dates[0] && dates[0].includes('T');
    const labels = dates.map(d => {
      if (isHourly) return d.split('T')[1].slice(0, 5);
      const p = d.split('-');
      return p[1] + '/' + p[2];
    });
    const dailyTx = dates.map(d => trend[d].transactions);
    const dailyRev = dates.map(d => trend[d].revenue);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Transactions',
            type: 'bar',
            data: dailyTx,
            backgroundColor: COLORS.primary + '80',
            borderColor: COLORS.primary,
            borderWidth: 1,
            borderRadius: isHourly ? 2 : 3,
            order: 2,
            yAxisID: 'y',
            barPercentage: isHourly ? 0.8 : 0.6
          },
          {
            label: 'Revenue',
            type: 'line',
            data: dailyRev,
            borderColor: COLORS.revenue,
            backgroundColor: COLORS.revenue + '20',
            fill: true,
            tension: 0.3,
            pointRadius: isHourly ? 2 : 1,
            borderWidth: 2,
            order: 1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.label === 'Revenue') return 'Revenue: ' + formatIDR(ctx.raw);
                return 'Transactions: ' + formatNum(ctx.raw);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            position: 'left',
            ticks: { callback: v => formatNum(v) }
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: v => formatIDR(v) }
          },
          x: {
            ticks: {
              maxTicksLimit: isHourly ? dates.length : 10,
              maxRotation: isHourly ? 0 : 45
            }
          }
        }
      }
    });
  }

  // ---- SUCCESS VS FAILURE RATE BY CHANNEL (stacked bar, period-aggregated) ----
  function renderSuccessRateTrend(canvasId, dataByChannel) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!dataByChannel) return;

    const channelKeys = Object.keys(dataByChannel).filter(ch => ch !== '__meta__' && dataByChannel[ch] && Object.keys(dataByChannel[ch]).length > 0);
    if (!channelKeys.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }

    // Aggregate across all dates in the period for each channel
    const aggregated = channelKeys.map(ch => {
      let tx = 0, succ = 0, fail = 0;
      Object.values(dataByChannel[ch]).forEach(row => {
        tx += row.transactions || 0;
        succ += row.success || 0;
        fail += row.failure || 0;
      });
      return {
        channel: ch,
        totalTransactions: tx,
        totalSuccess: succ,
        totalFailure: fail,
        successRate: tx > 0 ? succ / tx : 0,
        failureRate: tx > 0 ? fail / tx : 0
      };
    });

    // Sort by total transactions descending
    aggregated.sort((a, b) => b.totalTransactions - a.totalTransactions);

    const labels = aggregated.map(a => a.channel);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Success',
            data: aggregated.map(a => a.successRate),
            backgroundColor: COLORS.success,
            borderRadius: 4
          },
          {
            label: 'Failure',
            data: aggregated.map(a => a.failureRate),
            backgroundColor: COLORS.failure,
            borderRadius: 4
          },
          {
            label: 'Other / Processing',
            data: aggregated.map(a => {
              const neutral = a.totalTransactions - a.totalSuccess - a.totalFailure;
              return a.totalTransactions > 0 ? neutral / a.totalTransactions : 0;
            }),
            backgroundColor: '#DFE6E9',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const ch = aggregated[ctx.dataIndex];
                return ctx.dataset.label + ': ' + formatPct(ctx.raw)
                  + ' (' + formatNum(ch.totalTransactions) + ' txns)';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true
          },
          y: {
            beginAtZero: true,
            max: 1,
            stacked: true,
            ticks: { callback: v => formatPct(v) }
          }
        }
      }
    });
  }

  // ---- MONO-CHANNEL USERS TABLE ----
  function renderMonoChannelUsers(industryFilter, userFilter) {
    const container = document.getElementById('mono-channel-table');
    if (!container) return;

    let monoUsers;

    if (DATA.topUsers && DATA.topUsers.length && DATA.topUsers[0].channels_used !== undefined) {
      monoUsers = DATA.topUsers
        .filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                     (userFilter === 'All' || u.user_name === userFilter) &&
                     (u.channels_used || '').split(',').length <= 1)
        .map(u => ({
          name: u.user_name,
          industry: u.industry,
          channel: u.channels_used || 'Unknown',
          revenue: u.total_revenue || 0,
          transactions: u.total_transactions || 0
        }));
    } else {
      // Simulate mono-channel detection from dummy data
      const allUsers = DATA.users.filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                                               (userFilter === 'All' || u.name === userFilter || u.user_name === userFilter));
      monoUsers = allUsers.map((u, i) => {
        const seed = i * 13 + 7;
        const channelIdx = seed % 4;
        const channelNames = ['WhatsApp', 'SMS', 'Email', 'Call'];
        const channel = channelNames[channelIdx];
        const baseRev = 5000000 + (seed * 150000 % 20000000);
        return {
          name: u.user_name || u.name,
          industry: u.industry,
          channel,
          channelIdx,
          revenue: baseRev,
          transactions: Math.round(baseRev / 2800),
          priority: seed % 3 === 0 ? 'High' : seed % 3 === 1 ? 'Medium' : 'Low'
        };
      }).filter(u => u.channelIdx === 0 || u.channelIdx === 2);
    }

    if (!monoUsers || !monoUsers.length) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">No mono-channel users match current filters</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Industry</th>
            <th>Current Channel</th>
            <th>Transactions</th>
            <th>Revenue</th>
            <th>Upsell Priority</th>
          </tr>
        </thead>
        <tbody>
    `;

    monoUsers.forEach(u => {
      const priorityClass = (u.priority || 'Low').toLowerCase();
      html += `
        <tr>
          <td>${u.name}</td>
          <td>${u.industry}</td>
          <td><span class="badge badge-${u.channel.toLowerCase()}">${u.channel}</span></td>
          <td>${formatNum(u.transactions)}</td>
          <td>${formatIDR(u.revenue)}</td>
          <td><span class="badge badge-${priorityClass}">${u.priority || 'Low'}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ---- CHANNEL STABILITY SCORECARD ----
  function renderChannelStability(summary, channelDailyData) {
    const container = document.getElementById('channel-stability-table');
    if (!container) return;

    const channels = Object.keys(summary).filter(ch => summary[ch].transactions > 0);
    if (!channels.length) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">No data matches current filters</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Channel</th>
            <th>Avg Success Rate</th>
            <th>Min Success Rate</th>
            <th>Max Success Rate</th>
            <th>Std Dev</th>
            <th>Stability</th>
          </tr>
        </thead>
        <tbody>
    `;

    channels.forEach(ch => {
      const s = summary[ch];
      let avgRate = s.successRate;
      let minRate = avgRate;
      let maxRate = avgRate;
      let stdDev = 0.02;

      if (channelDailyData && channelDailyData[ch]) {
        const dailyRates = [];
        Object.values(channelDailyData[ch]).forEach(row => {
          if (row.transactions > 0) {
            dailyRates.push(row.success / row.transactions);
          }
        });
        if (dailyRates.length > 1) {
          const sum = dailyRates.reduce((a, b) => a + b, 0);
          avgRate = sum / dailyRates.length;
          minRate = Math.min(...dailyRates);
          maxRate = Math.max(...dailyRates);
          const variance = dailyRates.reduce((sq, v) => sq + (v - avgRate) ** 2, 0) / (dailyRates.length - 1);
          stdDev = Math.sqrt(variance);
        }
      } else {
        // Fallback estimate when no daily breakdown available
        const estVariance = ch === 'Call' ? 0.08 : ch === 'Email' ? 0.05 : ch === 'SMS' ? 0.03 : 0.02;
        minRate = Math.max(0, avgRate - estVariance * 2);
        maxRate = Math.min(1, avgRate + estVariance * 2);
        stdDev = estVariance;
      }

      const stability = stdDev <= 0.03 ? 'Stable' : stdDev <= 0.06 ? 'Moderate' : 'Unstable';
      const stabilityClass = stability.toLowerCase();

      html += `
        <tr>
          <td><strong>${ch}</strong></td>
          <td>${formatPct(avgRate)}</td>
          <td>${formatPct(minRate)}</td>
          <td>${formatPct(maxRate)}</td>
          <td>${(stdDev * 100).toFixed(1)}%</td>
          <td><span class="badge badge-${stabilityClass}">${stability}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ---- CHURN ALERT OVERVIEW (compact, top 5) ----
  function renderChurnAlertOverview(industryFilter, userFilter) {
    const container = document.getElementById('churn-alert-overview');
    if (!container) return;

    let churnUsers;

    if (DATA.churnRisk && DATA.churnRisk.length) {
      churnUsers = DATA.churnRisk
        .filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                     (userFilter === 'All' || u.user_name === userFilter))
        .map(u => ({
          name: u.user_name,
          industry: u.industry,
          daysInactive: u.days_inactive,
          riskScore: u.risk_score
        }))
        .sort((a, b) => b.riskScore - a.riskScore);
    } else {
      churnUsers = DATA.users
        .filter(u => (industryFilter === 'All' || u.industry === industryFilter) &&
                     (userFilter === 'All' || u.name === userFilter || u.user_name === userFilter))
        .map((u, i) => {
          const seed = u.id ? u.id.charCodeAt(u.id.length - 1) : (i * 7 + 13);
          const daysInactive = 2 + (seed % 25);
          const riskScore = Math.min(95, 20 + daysInactive * 2 + (seed % 15));
          return { name: u.user_name || u.name, industry: u.industry, riskScore, daysInactive };
        })
        .filter(u => u.riskScore > 40)
        .sort((a, b) => b.riskScore - a.riskScore);
    }

    const top5 = churnUsers.slice(0, 5);

    if (!top5.length) {
      container.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center;font-size:13px;">No at-risk users match filters</div>';
      return;
    }

    let html = '';
    top5.forEach(u => {
      const status = u.riskScore >= 70 ? 'Critical' : u.riskScore >= 50 ? 'Warning' : 'Monitor';
      const statusClass = status.toLowerCase();
      html += `
        <div class="churn-item">
          <div class="churn-item-top">
            <span class="badge badge-${statusClass}">${status}</span>
            <span class="churn-name">${u.name}</span>
          </div>
          <div class="churn-item-bottom">
            <span class="churn-meta">${u.daysInactive}d inactive</span>
            <span class="churn-score">Risk: ${u.riskScore}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ---- CHANNEL USAGE DONUT (transaction share %) ----
  function renderChannelUsage(canvasId, summary) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const channels = Object.keys(summary).filter(ch => summary[ch].transactions > 0);
    if (!channels.length) {
      const parent = canvas.parentElement;
      if (parent) parent.innerHTML = '<div class="empty-chart">No data matches current filters</div>';
      return;
    }

    const shares = channels.map(ch => summary[ch].transactions);
    const colors = channels.map(ch => channelColors[ch]);

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: channels,
        datasets: [{
          data: shares,
          backgroundColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ctx.label + ': ' + formatNum(ctx.raw) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  // ---- PRIOR PERIOD HELPER ----
  function computePriorData(period, channel, industry, referenceDate, user, defaultBillableRate) {
    if (period === 'all') return {};
    const isHourly = ['1h', '4h', '6h', '12h', '24h'].includes(period);
    if (isHourly) {
      const hours = period === '1h' ? 1 : period === '4h' ? 4 : period === '6h' ? 6 : period === '12h' ? 12 : 24;
      const refIdx = DATA.allDates.indexOf(referenceDate);
      const prevDateIdx = refIdx > 0 ? refIdx - 1 : Math.max(0, DATA.allDates.length - 2);
      const prevDate = DATA.allDates[prevDateIdx] || DATA.allDates[0];
      if (!DATA.hourlyData || !DATA.hourlyData.length) return DATA.getDailyDataForRange(prevDate, prevDate, channel, industry, user);
      const prior = {};
      DATA.CHANNELS.forEach(ch => {
        if (channel !== 'All' && ch !== channel) return;
        prior[ch] = { [prevDate]: { transactions: 0, success: 0, failure: 0, revenue: 0, billable: 0 } };
      });
      DATA.hourlyData.forEach(h => {
        if (channel !== 'All' && h.channel !== channel) return;
        if (h.hour < 24 - hours) return;
        if (prior[h.channel] && prior[h.channel][prevDate]) {
          prior[h.channel][prevDate].transactions += h.transactions;
          prior[h.channel][prevDate].success += h.success;
          prior[h.channel][prevDate].failure += h.fail;
          prior[h.channel][prevDate].revenue += h.revenue;
        }
      });
      // Scale prior by industry using actual prevDate daily data
      if (industry !== 'All' && user === 'All') {
        const industryData = DATA.getDailyDataForRange(prevDate, prevDate, channel, industry, 'All');
        Object.keys(prior).forEach(ch => {
          const fullTx = DATA.dailyData[ch] && DATA.dailyData[ch][prevDate]
            ? DATA.dailyData[ch][prevDate].transactions : 0;
          const indTx = industryData[ch] && industryData[ch][prevDate]
            ? industryData[ch][prevDate].transactions : 0;
          const ratio = fullTx > 0 ? indTx / fullTx : 0;
          prior[ch][prevDate].transactions = Math.round(prior[ch][prevDate].transactions * ratio);
          prior[ch][prevDate].success = Math.round(prior[ch][prevDate].success * ratio);
          prior[ch][prevDate].failure = Math.round(prior[ch][prevDate].failure * ratio);
          prior[ch][prevDate].revenue = Math.round(prior[ch][prevDate].revenue * ratio);
        });
      }
      // Scale prior by user
      if (user !== 'All') {
        const share = DATA.getUserShare ? DATA.getUserShare(user) : 0;
        Object.keys(prior).forEach(ch => {
          prior[ch][prevDate].transactions = Math.round(prior[ch][prevDate].transactions * share);
          prior[ch][prevDate].success = Math.round(prior[ch][prevDate].success * share);
          prior[ch][prevDate].failure = Math.round(prior[ch][prevDate].failure * share);
          prior[ch][prevDate].revenue = Math.round(prior[ch][prevDate].revenue * share);
        });
      }
      const billRate = defaultBillableRate || 0.78;
      Object.keys(prior).forEach(ch => {
        prior[ch][prevDate].billable = Math.round(prior[ch][prevDate].transactions * billRate);
      });
      return prior;
    } else {
      const days = period === '7d' ? 7 : 30;
      const endDate = new Date(referenceDate);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days + 1);
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - days + 1);
      const prevStartStr = prevStartDate.toISOString().split('T')[0];
      const prevEndStr = prevEndDate.toISOString().split('T')[0];
      return DATA.getDailyDataForRange(prevStartStr, prevEndStr, channel, industry, user);
    }
  }

  // ---- PUBLIC RENDER FUNCTION ----
  function renderAll(period, industry, channel, referenceDate, user) {
    user = user || 'All';
    referenceDate = referenceDate || new Date().toISOString().split('T')[0];
    const isHourly = ['1h', '4h', '6h', '12h', '24h'].includes(period);

    let data, prevData, summary, trend;

    // Compute filtered user count before data fetching (needed by both hourly and daily paths)
    let filteredUserCount;
    if (user !== 'All') {
      filteredUserCount = 1;
    } else if (industry !== 'All') {
      filteredUserCount = DATA.users.filter(u => u.industry === industry).length;
    } else {
      filteredUserCount = DATA.users.length;
    }

    if (isHourly) {
      const hours = period === '1h' ? 1 : period === '4h' ? 4 : period === '6h' ? 6 : period === '12h' ? 12 : 24;
      // Use referenceDate to find correct latest date
      const refIdx = DATA.allDates.indexOf(referenceDate);
      const latestDate = refIdx >= 0 ? DATA.allDates[refIdx] : DATA.allDates[DATA.allDates.length - 1];

      // Fallback to daily if hourly data is missing (e.g. live data without hourly)
      if (!DATA.hourlyData || !DATA.hourlyData.length) {
        const startStr = latestDate;
        const endStr = latestDate;
        data = DATA.getDailyDataForRange(startStr, endStr, channel, industry, user);
        prevData = computePriorData(period, channel, industry, referenceDate, user);
        summary = DATA.computeChannelSummary(data);
        trend = DATA.computeDailyTrend(data, null, filteredUserCount);
      } else {
      data = DATA.getDailyDataForRange(latestDate, latestDate, channel, industry, user);

      // Compute actual billable rate from current daily data
      let currentDailyTx = 0, currentDailyBill = 0;
      Object.values(data).forEach(chData => {
        Object.values(chData).forEach(row => {
          currentDailyTx += row.transactions;
          currentDailyBill += row.billable;
        });
      });
      const currentBillableRate = currentDailyTx > 0 ? currentDailyBill / currentDailyTx : 0;

      prevData = computePriorData(period, channel, industry, referenceDate, user, currentBillableRate);

      const hourlySummary = {};
      DATA.CHANNELS.forEach(ch => {
        if (channel !== 'All' && ch !== channel) return;
        hourlySummary[ch] = {
          transactions: 0, success: 0, fail: 0, neutral: 0,
          revenue: 0, billable: 0, successRate: 0, failureRate: 0,
          billableRate: 0, revenueShare: 0, shareOfTotal: 0
        };
      });

      DATA.hourlyData.forEach(h => {
        if (channel !== 'All' && h.channel !== channel) return;
        if (h.hour < 24 - hours) return;
        if (hourlySummary[h.channel]) {
          hourlySummary[h.channel].transactions += h.transactions;
          hourlySummary[h.channel].success += h.success;
          hourlySummary[h.channel].fail += h.fail;
          hourlySummary[h.channel].neutral += h.neutral;
          hourlySummary[h.channel].revenue += h.revenue;
        }
      });

      // Scale hourly summary by industry using actual daily data proportions (per-channel)
      if (industry !== 'All' && user === 'All') {
        Object.keys(hourlySummary).forEach(ch => {
          const fullTx = DATA.dailyData[ch] && DATA.dailyData[ch][latestDate]
            ? DATA.dailyData[ch][latestDate].transactions : 0;
          const industryTx = data[ch] && data[ch][latestDate]
            ? data[ch][latestDate].transactions : 0;
          const ratio = fullTx > 0 ? industryTx / fullTx : 0;
          const s = hourlySummary[ch];
          s.transactions = Math.round(s.transactions * ratio);
          s.success = Math.round(s.success * ratio);
          s.fail = Math.round(s.fail * ratio);
          s.neutral = Math.round(s.neutral * ratio);
          s.revenue = Math.round(s.revenue * ratio);
          s.billable = Math.round(s.billable * ratio);
        });
      }

      const totalHrTx = Object.values(hourlySummary).reduce((s, c) => s + c.transactions, 0);
      const totalHrRev = Object.values(hourlySummary).reduce((s, c) => s + c.revenue, 0);
      Object.keys(hourlySummary).forEach(ch => {
        const s = hourlySummary[ch];
        s.successRate = s.transactions > 0 ? s.success / s.transactions : 0;
        s.failureRate = s.transactions > 0 ? s.fail / s.transactions : 0;
        s.billableRate = currentBillableRate;
        s.revenueShare = totalHrRev > 0 ? s.revenue / totalHrRev : 0;
        s.shareOfTotal = totalHrTx > 0 ? s.transactions / totalHrTx : 0;
        s.billable = Math.round(s.transactions * currentBillableRate);
      });

      summary = hourlySummary;

      const hourlyTrend = {};
      for (let h = 24 - hours; h < 24; h++) {
        const hourKey = latestDate + 'T' + String(h).padStart(2, '0') + ':00';
        hourlyTrend[hourKey] = { transactions: 0, success: 0, fail: 0, revenue: 0, activeUsers: 0 };
        DATA.hourlyData.forEach(row => {
          if (channel !== 'All' && row.channel !== channel) return;
          if (row.hour === h) {
            hourlyTrend[hourKey].transactions += row.transactions;
            hourlyTrend[hourKey].success += row.success;
            hourlyTrend[hourKey].fail += row.fail || 0;
            hourlyTrend[hourKey].revenue += row.revenue;
          }
        });
      }

      // Scale hourly trend by industry
      let fullAllTx = 0, industryAllTx = 0;
      if (industry !== 'All' && user === 'All') {
        DATA.CHANNELS.forEach(ch => {
          if (DATA.dailyData[ch] && DATA.dailyData[ch][latestDate]) {
            fullAllTx += DATA.dailyData[ch][latestDate].transactions;
          }
          if (data[ch] && data[ch][latestDate]) {
            industryAllTx += data[ch][latestDate].transactions;
          }
        });
        const trendRatio = fullAllTx > 0 ? industryAllTx / fullAllTx : 0;
        Object.keys(hourlyTrend).forEach(date => {
          const t = hourlyTrend[date];
          t.transactions = Math.round(t.transactions * trendRatio);
          t.success = Math.round(t.success * trendRatio);
          t.fail = Math.round(t.fail * trendRatio);
          t.revenue = Math.round(t.revenue * trendRatio);
          t.activeUsers = Math.max(1, Math.round(t.activeUsers * trendRatio));
        });
      }

      trend = hourlyTrend;

      // Build hourly per-channel data for success rate trend
      const hourlyDataByChannel = {};
      DATA.CHANNELS.forEach(ch => {
        if (channel !== 'All' && ch !== channel) return;
        hourlyDataByChannel[ch] = {};
      });
      for (let h = 24 - hours; h < 24; h++) {
        const hourKey = latestDate + 'T' + String(h).padStart(2, '0') + ':00';
        DATA.hourlyData.forEach(row => {
          if (channel !== 'All' && row.channel !== channel) return;
          if (row.hour === h) {
            if (!hourlyDataByChannel[row.channel][hourKey]) {
              hourlyDataByChannel[row.channel][hourKey] = { transactions: 0, success: 0 };
            }
            hourlyDataByChannel[row.channel][hourKey].transactions += row.transactions;
            hourlyDataByChannel[row.channel][hourKey].success += row.success;
          }
        });
      }

      // Scale hourly charts by industry (trend + dataByChannel)
      if (industry !== 'All' && user === 'All') {
        const trendRatio = fullAllTx > 0 ? industryAllTx / fullAllTx : 0;
        Object.keys(hourlyDataByChannel).forEach(ch => {
          Object.keys(hourlyDataByChannel[ch]).forEach(hk => {
            const e = hourlyDataByChannel[ch][hk];
            e.transactions = Math.round(e.transactions * trendRatio);
            e.success = Math.round(e.success * trendRatio);
          });
        });
      }

      // Scale hourly charts by user share (hourlyData lacks user dimension)
      if (user !== 'All') {
        const share = DATA.getUserShare ? DATA.getUserShare(user) : 0;
        if (share > 0) {
          Object.keys(hourlySummary).forEach(ch => {
            const s = hourlySummary[ch];
            s.transactions = Math.round(s.transactions * share);
            s.success = Math.round(s.success * share);
            s.fail = Math.round(s.fail * share);
            s.neutral = Math.round(s.neutral * share);
            s.revenue = Math.round(s.revenue * share);
            s.billable = Math.round(s.billable * share);
          });
          Object.keys(trend).forEach(date => {
            const t = trend[date];
            t.transactions = Math.round(t.transactions * share);
            t.success = Math.round(t.success * share);
            t.revenue = Math.round(t.revenue * share);
            t.fail = Math.round(t.fail * share);
            t.activeUsers = Math.max(1, Math.round(t.activeUsers * share));
          });
          Object.keys(hourlyDataByChannel).forEach(ch => {
            Object.keys(hourlyDataByChannel[ch]).forEach(hk => {
              const e = hourlyDataByChannel[ch][hk];
              e.transactions = Math.round(e.transactions * share);
              e.success = Math.round(e.success * share);
            });
          });
        }
      }
      // Set activeUsers for hourly trend proportionally to transaction volume
      const totalHourlyTx = Object.values(trend).reduce((s, t) => s + t.transactions, 0);
      Object.keys(trend).forEach(date => {
        trend[date].activeUsers = totalHourlyTx > 0
          ? Math.max(1, Math.round(filteredUserCount * (trend[date].transactions / totalHourlyTx)))
          : 1;
      });
      }
    } else {
      let startStr, endStr;
      if (period === 'all') {
        startStr = DATA.allDates[0];
        endStr = DATA.allDates[DATA.allDates.length - 1];
      } else {
        const days = period === '7d' ? 7 : 30;
        const endDate = new Date(referenceDate);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - days + 1);
        startStr = startDate.toISOString().split('T')[0];
        endStr = endDate.toISOString().split('T')[0];
      }

      data = DATA.getDailyDataForRange(startStr, endStr, channel, industry, user);
      prevData = computePriorData(period, channel, industry, referenceDate, user);
      summary = DATA.computeChannelSummary(data);
      trend = DATA.computeDailyTrend(data, null, filteredUserCount);
    }

    // Compute active user count based on filters
    let activeUserCount = filteredUserCount;
    let prevActiveUserCount = filteredUserCount;

    // Guard: skip rendering if no data
    const hasData = data && Object.keys(data).length > 0 &&
                    Object.values(data).some(chData =>
                      Object.values(chData).some(r => r.transactions > 0));
    if (!hasData) {
      updateKPIs(data || {}, prevData || {}, summary || {}, trend || {}, activeUserCount || 0, prevActiveUserCount || 0);
      return;
    }

    // Render everything
    updateKPIs(data, prevData, summary, trend, activeUserCount, prevActiveUserCount);
    renderChannelVolume('chart-channel-volume', summary);
    renderRevenueDonut('chart-revenue-donut', summary);
    renderCombinedTrend('chart-combined-trend', trend);
    renderSuccessRateTrend('chart-success-rate-trend', isHourly && hourlyDataByChannel ? hourlyDataByChannel : data);
    renderSuccessRateByChannel('chart-success-rate', summary);
    renderStatusDistribution('chart-status-dist', summary);
    renderTopUsersTable(null, summary, industry, user);
    renderChurnRiskTable(industry, user);
    renderMonoChannelUsers(industry, user);
    renderChannelStability(summary, data);
    renderChurnAlertOverview(industry, user);
    renderChannelUsage('chart-channel-usage', summary);

    // WhatsApp read rate (only when WhatsApp is active)
    const chs = Object.keys(summary);
    if (chs.includes('WhatsApp')) {
      renderWhatsAppReadRate('chart-read-rate', trend, data);
    }
  }

  return { renderAll, formatNum, formatIDR, formatPct, destroyChart };
})();
