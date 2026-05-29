// ====================================================================
// dashboard.js — Main Dashboard Logic (Filters, Tabs, Interactivity)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- STATE ----
  const today = new Date().toISOString().split('T')[0];

  let state = {
    period: '30d',
    industry: 'All',
    channel: 'All',
    user: 'All',
    referenceDate: today
  };

  // ---- DOM REFS ----
  const periodFilter = document.getElementById('periodFilter');
  const dateFilter = document.getElementById('dateFilter');
  const industryFilter = document.getElementById('industryFilter');
  const channelFilter = document.getElementById('channelFilter');
  const userFilter = document.getElementById('userFilter');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const activePeriod = document.getElementById('active-period');
  const activeIndustry = document.getElementById('active-industry');
  const activeChannel = document.getElementById('active-channel');
  const activeUser = document.getElementById('active-user');

  // Set default date
  dateFilter.value = state.referenceDate;
  dateFilter.max = today;

  // ---- POPULATE INDUSTRY FILTER ----
  DATA.INDUSTRIES.sort().forEach(ind => {
    const opt = document.createElement('option');
    opt.value = ind;
    opt.textContent = ind;
    industryFilter.appendChild(opt);
  });

  // ---- POPULATE CHANNEL FILTER ----
  DATA.CHANNELS.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    channelFilter.appendChild(opt);
  });

  // ---- POPULATE USER SELECT (filtered by industry) ----
  function populateUserSelect(industry, selectedUser) {
    const users = industry && industry !== 'All'
      ? DATA.users.filter(u => u.industry === industry)
      : DATA.users;
    userFilter.innerHTML = '<option value="All">All Users</option>';
    users.sort((a, b) => a.name.localeCompare(b.name)).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.name;
      userFilter.appendChild(opt);
    });
    if (selectedUser && selectedUser !== 'All') {
      const exists = users.some(u => u.name === selectedUser);
      userFilter.value = exists ? selectedUser : 'All';
    } else {
      userFilter.value = 'All';
    }
    state.user = userFilter.value;
  }
  populateUserSelect('All', 'All');

  // ---- RENDER ON CHANGE ----
  function updateDashboard() {
    CHARTS.renderAll(state.period, state.industry, state.channel, state.referenceDate, state.user);
    activePeriod.textContent = periodFilter.options[periodFilter.selectedIndex].text;
    activeIndustry.textContent = state.industry === 'All' ? 'All Industries' : state.industry;
    activeChannel.textContent = state.channel === 'All' ? 'All Channels' : state.channel;
    activeUser.textContent = state.user === 'All' ? 'All Users' : state.user;
  }

  // ---- FILTER EVENTS ----
  periodFilter.addEventListener('change', () => {
    state.period = periodFilter.value;
    updateDashboard();
  });

  dateFilter.addEventListener('change', () => {
    state.referenceDate = dateFilter.value;
    updateDashboard();
  });

  industryFilter.addEventListener('change', () => {
    state.industry = industryFilter.value;
    populateUserSelect(state.industry, state.user);
    updateDashboard();
  });

  channelFilter.addEventListener('change', () => {
    state.channel = channelFilter.value;
    updateDashboard();
  });

  userFilter.addEventListener('change', () => {
    state.user = userFilter.value;
    updateDashboard();
  });

  // ---- TAB SWITCHING ----
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabContents.forEach(tc => tc.classList.remove('active'));
      document.getElementById(target).classList.add('active');
      window.location.hash = target;
      window.scrollTo(0, 0);
      // Trigger Chart.js resize after tab switch to fix hidden canvas sizing
      setTimeout(() => {
        if (typeof CHARTS !== 'undefined' && CHARTS.getChartInstances) {
          Object.values(CHARTS.getChartInstances()).forEach(c => {
            try { c.resize(); } catch(e) {}
          });
        }
        window.dispatchEvent(new Event('resize'));
      }, 50);
    });
  });

  // Restore tab from URL hash
  const hashTab = window.location.hash.replace('#', '');
  if (hashTab) {
    const match = document.querySelector(`.tab[data-tab="${hashTab}"]`);
    if (match) match.click();
  }

  // ---- INITIAL RENDER ----
  updateDashboard();
});
