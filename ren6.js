/* ─── GLOBALS ─────────────────────────────────────────────── */
const API_URL = 'https://opensheet.elk.sh/1qO62L8EnuPFs_6Dra7XYxh7k-dUILWmsFw-autFdWEs/1';

let allSchools   = [];
let activeTab    = 'all';

/* Generate year keys: 2007-08 … 2025-26 */
const YEAR_KEYS = [];
for (let y = 2007; y <= 2025; y++) {
  const next = String(y + 1).slice(2);
  YEAR_KEYS.push(`${y}-${next}`);
}

/* ─── HELPERS ─────────────────────────────────────────────── */
function isEmpty(v) {
  if (v === undefined || v === null) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'na' || s === 'n/a' || s === 'no web site' || s === '0';
}

function clean(v) {
  return isEmpty(v) ? null : String(v).trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightText(text, query) {
  if (!query || query.length < 2) return escapeHtml(text || '');
  const escaped = escapeHtml(text || '');
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(re, '<span class="highlight">$1</span>');
}

/* Extract year-wise data from a school object */
function getYearData(school) {
  const years = [];
  YEAR_KEYS.forEach(yr => {
    const ev = clean(school[`Events_${yr}`]);
    const pr = clean(school[`Product_${yr}`]);
    const ot = clean(school[`Other_${yr}`]);
    if (ev || pr || ot) years.push({ year: yr, event: ev, product: pr, other: ot });
  });
  return years.reverse(); // most-recent first
}

/* Compute global stats */
function getStats(schools) {
  const locs = new Set();
  const yrs  = new Set();
  schools.forEach(s => {
    if (clean(s.LOCATION)) locs.add(clean(s.LOCATION));
    YEAR_KEYS.forEach(yr => {
      if (clean(s[`Events_${yr}`]) || clean(s[`Product_${yr}`]) || clean(s[`Other_${yr}`]))
        yrs.add(yr);
    });
  });
  return { total: schools.length, years: yrs.size, locations: locs.size };
}

/* ─── RENDER: LOADING ─────────────────────────────────────── */
function renderLoading() {
  document.getElementById('mainContent').innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      <span>Loading school records…</span>
    </div>`;
}

/* ─── RENDER: LANDING ─────────────────────────────────────── */
function renderLanding(stats) {
  document.getElementById('mainContent').innerHTML = `
    <div class="landing">
      <div class="hero-badge">Organisation Records</div>
      <h1 class="hero-title">Space <span style="color:var(--accent)">organisation</span> record</h1>
      <p class="hero-sub">
        Search for a school by name or code to explore its
        year-wise event and product history.
      </p>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num">${stats.total.toLocaleString()}</div>
          <div class="stat-label">Total Schools</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${stats.years}</div>
          <div class="stat-label">Years of Data</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${stats.locations.toLocaleString()}</div>
          <div class="stat-label">Unique Locations</div>
        </div>
      </div>
      <div class="orbit-hint">
        <div class="orbit-dot"></div>
        Ready to explore — use the search bar above
      </div>
    </div>`;
}

/* ─── RENDER: FIELD ROW (skip if empty) ───────────────────── */
function fieldRow(label, rawVal, link) {
  const v = clean(rawVal);
  if (!v) return '';
  let display = escapeHtml(v);
  if (link) {
    const href = v.startsWith('http') ? v : 'https://' + v;
    display = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(v)}</a>`;
  }
  return `
    <div class="field-row">
      <div class="field-label">${label}</div>
      <div class="field-val">${display}</div>
    </div>`;
}

/* ─── RENDER: TIMELINE HTML ───────────────────────────────── */
function renderTimeline(yearData, tab) {
  let filtered = yearData;
  if (tab === 'events')   filtered = yearData.filter(y => y.event);
  if (tab === 'products') filtered = yearData.filter(y => y.product);
  if (tab === 'others')   filtered = yearData.filter(y => y.other);

  if (!filtered.length) {
    return '<div class="empty-timeline">No data for this filter.</div>';
  }

  return filtered.map(y => {
    const entries = [];
    if ((tab === 'all' || tab === 'events')   && y.event)
      entries.push(`<div class="entry event"><div class="entry-type">Event</div><div class="entry-text">${escapeHtml(y.event)}</div></div>`);
    if ((tab === 'all' || tab === 'products') && y.product)
      entries.push(`<div class="entry product"><div class="entry-type">Product</div><div class="entry-text">${escapeHtml(y.product)}</div></div>`);
    if ((tab === 'all' || tab === 'others')   && y.other)
      entries.push(`<div class="entry other"><div class="entry-type">Other</div><div class="entry-text">${escapeHtml(y.other)}</div></div>`);
    if (!entries.length) return '';
    return `
      <div class="year-block">
        <div class="year-dot"></div>
        <div class="year-label">${escapeHtml(y.year)}</div>
        ${entries.join('')}
      </div>`;
  }).filter(Boolean).join('');
}

/* ─── RENDER: TABS HTML ───────────────────────────────────── */
function tabsHTML(current) {
  return ['all', 'events', 'products', 'others'].map(t => `
    <button class="tab-btn${current === t ? ' active' : ''}" data-tab="${t}">
      ${t.charAt(0).toUpperCase() + t.slice(1)}
    </button>`).join('');
}

/* ─── RENDER: DETAIL VIEW ─────────────────────────────────── */
function renderDetail(school) {
  const yearData   = getYearData(school);
  const totalYears = yearData.length;
  const totalEv    = yearData.filter(y => y.event).length;
  const totalPr    = yearData.filter(y => y.product).length;

  const phone   = clean(school.PHONE) || clean(school.New_Phone_Number);
  const email   = clean(school['School_E-mail_ID']);
  const website = clean(school.Website);

  /* Check which authority sections have any data */
  const hasPrincipal = clean(school.Principal_name) || clean(school['Principal_Phone_No.']) ||
                       clean(school['Principal_E-mail_ID']) || clean(school['Principal/Head']);
  const hasVP        = clean(school.Vice_principal_Name) || clean(school['Vice_Principal_Contact_no.']) ||
                       clean(school['Vice_Principal_E-mail_Id']);
  const hasCoord     = clean(school['SPACE_Club_Active_coordinators_&_nos.']) ||
                       clean(school['SPACE_coordinator_email-id']) || clean(school.CoordinatorEmail_ID) ||
                       clean(school["Other_astt._coordinator's_name_&no"]);

  document.getElementById('mainContent').innerHTML = `
    <!-- HEADER -->
    <div class="detail-header">
      <button class="back-btn" id="backBtn">&#8592; Back</button>
      <div>
        <div class="school-name-h">${escapeHtml(clean(school.ORGANISATION_NAME) || 'School')}</div>
        <div class="school-meta">
          ${phone ? `
          <span class="meta-chip">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07.01h3A2 2 0 017 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            ${escapeHtml(phone)}
          </span>` : ''}
          ${email ? `
          <span class="meta-chip">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${escapeHtml(email)}
          </span>` : ''}
        </div>
      </div>
    </div>

    <!-- 3-COLUMN GRID -->
    <div class="three-col">

      <!-- LEFT: School Details -->
      <div class="panel">
        <div class="panel-title">School Details</div>
        ${fieldRow('Organisation Code', school.ORGANISATION_CODE)}
        ${fieldRow('Address', school.ADDRESS)}
        ${fieldRow('Location', school.LOCATION)}
        ${fieldRow('Category', school['Category_A/B/C/G/AU/BU/AP/BP/'])}
        ${website ? fieldRow('Website', website, true) : ''}

        <div style="margin-top:18px;">
          <div class="auto-stat">
            <span class="auto-stat-label">Years Active</span>
            <span class="auto-stat-val">${totalYears}</span>
          </div>
          <div class="auto-stat">
            <span class="auto-stat-label">Total Events</span>
            <span class="auto-stat-val">${totalEv}</span>
          </div>
          <div class="auto-stat">
            <span class="auto-stat-label">Total Products</span>
            <span class="auto-stat-val">${totalPr}</span>
          </div>
        </div>
      </div>

      <!-- MIDDLE: Authority & Coordination -->
      <div class="panel">
        <div class="panel-title">Authority &amp; Coordination</div>

        ${hasPrincipal ? `
        <div class="sub-section">
          <div class="sub-section-title">Principal / Head</div>
          ${fieldRow('Name', school.Principal_name)}
          ${fieldRow('Role', school['Principal/Head'])}
          ${fieldRow('Phone', school['Principal_Phone_No.'])}
          ${fieldRow('Email', school['Principal_E-mail_ID'])}
        </div>` : ''}

        ${hasVP ? `
        <div class="sub-section">
          <div class="sub-section-title">Vice Principal</div>
          ${fieldRow('Name', school.Vice_principal_Name)}
          ${fieldRow('Phone', school['Vice_Principal_Contact_no.'])}
          ${fieldRow('Email', school['Vice_Principal_E-mail_Id'])}
        </div>` : ''}

        ${hasCoord ? `
        <div class="sub-section">
          <div class="sub-section-title">Coordinators</div>
          ${fieldRow('Active Coordinators', school['SPACE_Club_Active_coordinators_&_nos.'])}
          ${fieldRow('Coordinator Email', school['SPACE_coordinator_email-id'])}
          ${fieldRow('Alt Email', school.CoordinatorEmail_ID)}
          ${fieldRow('Assistant Coordinators', school["Other_astt._coordinator's_name_&no"])}
        </div>` : ''}

        ${!hasPrincipal && !hasVP && !hasCoord ? `
        <p style="color:var(--text3);font-size:13px;">No authority data available.</p>` : ''}
      </div>

      <!-- RIGHT: Timeline -->
      <div class="timeline-panel">
        <div class="timeline-tabs" id="timelineTabs">
          ${tabsHTML(activeTab)}
        </div>
        <div class="timeline-scroll" id="timelineContent">
          ${renderTimeline(yearData, activeTab)}
        </div>
      </div>

    </div>`;

  /* Back button */
  document.getElementById('backBtn').addEventListener('click', () => {
    activeTab = 'all';
    renderLanding(getStats(allSchools));
  });

  /* Tab switching */
  document.getElementById('timelineTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === activeTab));
    document.getElementById('timelineContent').innerHTML =
      renderTimeline(yearData, activeTab);
  });
}

/* ─── SEARCH / DROPDOWN ───────────────────────────────────── */
function updateDropdown(query) {
  const dd = document.getElementById('dropdown');
  if (!query || query.length < 2) { dd.style.display = 'none'; return; }

  const q = query.toLowerCase();
  const matches = allSchools.filter(s => {
    const name  = (s.ORGANISATION_NAME   || '').toLowerCase();
    const code  = (s.ORGANISATION_CODE   || '').toLowerCase();
    const phone = (s.PHONE || s.New_Phone_Number || '').toLowerCase();
    return name.includes(q) || code.includes(q) || phone.includes(q);
  }).slice(0, 10);

  if (!matches.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = matches.map(s => `
    <div class="dropdown-item" data-code="${escapeHtml(s.ORGANISATION_CODE || '')}">
      <div class="match-name">${highlightText(s.ORGANISATION_NAME, query)}</div>
      ${clean(s.ORGANISATION_CODE)
        ? `<div class="match-code">${highlightText(s.ORGANISATION_CODE, query)}</div>` : ''}
    </div>`).join('');

  dd.style.display = 'block';

  dd.querySelectorAll('.dropdown-item').forEach((item, i) => {
    item.addEventListener('click', () => {
      const school = matches[i];
      document.getElementById('searchInput').value = clean(school.ORGANISATION_NAME) || '';
      dd.style.display = 'none';
      activeTab = 'all';
      renderDetail(school);
    });
  });
}

/* ─── INIT ────────────────────────────────────────────────── */
async function init() {
  renderLoading();
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allSchools = await res.json();
    renderLanding(getStats(allSchools));
  } catch (err) {
    document.getElementById('mainContent').innerHTML = `
      <div class="loading-wrap">
        <span style="color:var(--accent3);">
          &#9888; Failed to load data — ${escapeHtml(err.message)}
        </span>
      </div>`;
  }
}

/* ─── EVENT LISTENERS ─────────────────────────────────────── */
document.getElementById('searchInput').addEventListener('input', e => {
  updateDropdown(e.target.value);
});

document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('dropdown').style.display = 'none';
  }
  if (e.key === 'Enter') {
    const q = e.target.value.toLowerCase().trim();
    const match = allSchools.find(s =>
      (s.ORGANISATION_NAME  || '').toLowerCase() === q ||
      (s.ORGANISATION_CODE  || '').toLowerCase() === q
    );
    if (match) {
      document.getElementById('dropdown').style.display = 'none';
      activeTab = 'all';
      renderDetail(match);
    }
  }
});

/* Close dropdown on outside click */
document.addEventListener('click', e => {
  if (!document.getElementById('searchWrap').contains(e.target))
    document.getElementById('dropdown').style.display = 'none';
});

/* Start */
init();
