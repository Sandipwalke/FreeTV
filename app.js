const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const state = { channels: [], filtered: [], visible: 24, genre: '', country: '', query: '', current: null };
const $ = (selector) => document.querySelector(selector);

function attr(line, name) {
  const match = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF')) continue;

    const url = lines[i + 1] && !lines[i + 1].startsWith('#')
      ? lines[i + 1].trim()
      : '';

    if (!/^https?:\/\//i.test(url)) continue;

    const title = lines[i].slice(lines[i].lastIndexOf(',') + 1).trim() || 'Untitled channel';
    const countryValue = attr(lines[i], 'tvg-country');
    const groupValue = attr(lines[i], 'group-title');

    result.push({
      name: title,
      url,
      logo: attr(lines[i], 'tvg-logo'),
      country: countryValue,
      countries: countryValue.split(/[;,]/).map(x => x.trim()).filter(Boolean),
      group: groupValue || 'General'
    });
  }

  return result;
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
}

function logoHTML(channel, cls = 'channel-logo') {
  if (channel.logo) {
    return `<img class="${cls}" src="${escapeHTML(channel.logo)}" alt="" loading="lazy" onerror="this.style.display='none'>`;
  }
  return `<span class="${cls} fallback-logo">${escapeHTML(initials(channel.name))}</span>`;
}

function countries() {
  const values = [...new Set(state.channels.flatMap(c => c.countries))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  $('#countrySelect').innerHTML =
    '<option value="">All countries</option>' +
    values.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
}

function genres() {
  const values = [...new Set(state.channels.map(c => c.group).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 20);

  $('#genreChips').innerHTML =
    '<button class="chip active" data-genre="">All</button>' +
    values.map(g => `<button class="chip" data-genre="${escapeHTML(g)}">${escapeHTML(g)}</button>`).join('');
}

function refresh() {
  const q = state.query.toLowerCase().trim();

  state.filtered = state.channels.filter(c =>
    (!state.genre || c.group === state.genre) &&
    (!state.country || c.countries.includes(state.country)) &&
    (!q || `${c.name} ${c.country} ${c.group}`.toLowerCase().includes(q))
  );

  state.visible = 24;
  renderGrid();
}

function renderGrid() {
  const visible = state.filtered.slice(0, state.visible);

  $('#channelGrid').innerHTML = visible.length
    ? visible.map(c =>
        `<button class="channel-card" data-index="${state.filtered.indexOf(c)}">${logoHTML(c)}<span class="channel-info"><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.country || c.group)}</small></span><span class="live-tag">● LIVE</span></button>`
      ).join('')
    : '<div class="empty-state">No channels match your search.</div>';

  $('#loadMore').style.display =
    state.visible < state.filtered.length ? 'inline-block' : 'none';
}

function renderQuick() {
  const picks = [...state.channels].sort(() => Math.random() - 0.5).slice(0, 4);

  $('#quickPicks').innerHTML = picks.map(c =>
    `<button class="quick-item" data-url="${encodeURIComponent(c.url)}">${logoHTML(c)}<span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.country || c.group)}</small></span><span class="arrow">›</span></button>`
  ).join('');
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, x => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[x]));
}

function play(channel) {
  if (!channel?.url) return;

  state.current = channel;
  const video = $('#video');

  $('#videoPlaceholder').style.display = 'none';
  video.style.display = 'block';
  video.src = channel.url;
  video.play().catch(() => {});

  $('#nowTitle').textContent = channel.name;
  $('#nowMeta').textContent =
    [channel.country, channel.group].filter(Boolean).join(' · ') || 'Live stream';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function load() {
  try {
    const response = await fetch(PLAYLIST_URL, {
      mode: 'cors',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Playlist returned HTTP ${response.status}`);
    }

    const text = await response.text();

    if (!text.trim().startsWith('#EXTM3U')) {
      throw new Error('Playlist response is not a valid M3U file');
    }

    state.channels = parseM3U(text);

    if (!state.channels.length) {
      throw new Error('No browser-compatible channels found');
    }

    const count = $('#heroCount');
    if (count) count.textContent = state.channels.length.toLocaleString();

    countries();
    genres();
    refresh();
    renderQuick();
  } catch (error) {
    console.error('FreeTV channel loading failed:', error);

    const count = $('#heroCount');
    if (count) count.textContent = '—';

    $('#channelGrid').innerHTML =
      '<div class="empty-state">The channel guide could not be loaded.<br><small>Please refresh and try again.</small></div>';

    $('#quickPicks').innerHTML =
      '<p style="color:var(--muted);font-size:12px">Channel guide temporarily unavailable.</p>';
  }
}

$('#searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  refresh();
});

$('#countrySelect').addEventListener('change', e => {
  state.country = e.target.value;
  refresh();
});

$('#genreChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;

  state.genre = chip.dataset.genre;
  document.querySelectorAll('.chip').forEach(x =>
    x.classList.toggle('active', x === chip)
  );
  refresh();
});

$('#channelGrid').addEventListener('click', e => {
  const card = e.target.closest('.channel-card');
  if (card) play(state.filtered[Number(card.dataset.index)]);
});

$('#quickPicks').addEventListener('click', e => {
  const item = e.target.closest('.quick-item');
  if (item) {
    play(state.channels.find(c => c.url === decodeURIComponent(item.dataset.url)));
  }
});

$('#randomButton').addEventListener('click', () => {
  if (state.channels.length) {
    play(state.channels[Math.floor(Math.random() * state.channels.length)]);
  }
});

$('#loadMore').addEventListener('click', () => {
  state.visible += 24;
  renderGrid();
});

$('#shareButton').addEventListener('click', async () => {
  if (!state.current) return;

  try {
    await navigator.clipboard.writeText(state.current.url);
    $('#shareButton').innerHTML = '✓ <span>Copied</span>';
    setTimeout(() => $('#shareButton').innerHTML = '↗ <span>Share</span>', 1500);
  } catch {}
});

$('#themeButton').addEventListener('click', () =>
  document.body.classList.toggle('light')
);

load();
