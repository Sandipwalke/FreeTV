const CHANNELS_URL = 'https://iptv-org.github.io/iptv/channels.json';
const state = { channels: [], filtered: [], visible: 24, genre: '', country: '', query: '', current: null };
const $ = (selector) => document.querySelector(selector);

function normalizeChannel(channel) {
  const countries = Array.isArray(channel.countries) ? channel.countries.map(c => typeof c === 'string' ? c : c.name).filter(Boolean) : [];
  const categories = Array.isArray(channel.categories) ? channel.categories.map(c => typeof c === 'string' ? c : c.name).filter(Boolean) : [];
  return {
    name: channel.name || 'Untitled channel',
    url: channel.url || '',
    logo: channel.logo || '',
    country: countries.join('; '),
    countries,
    group: categories[0] || 'General',
    groups: categories
  };
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
  const values = [...new Set(state.channels.flatMap(c => c.countries))].sort((a, b) => a.localeCompare(b));
  $('#countrySelect').innerHTML = '<option value="">All countries</option>' +
    values.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
}

function genres() {
  const values = [...new Set(state.channels.flatMap(c => c.groups))].filter(Boolean).sort((a, b) => a.localeCompare(b)).slice(0, 20);
  $('#genreChips').innerHTML = '<button class="chip active" data-genre="">All</button>' +
    values.map(g => `<button class="chip" data-genre="${escapeHTML(g)}">${escapeHTML(g)}</button>`).join('');
}

function refresh() {
  const q = state.query.toLowerCase().trim();
  state.filtered = state.channels.filter(c =>
    (!state.genre || c.groups.includes(state.genre)) &&
    (!state.country || c.countries.includes(state.country)) &&
    (!q || `${c.name} ${c.country} ${c.groups.join(' ')}`.toLowerCase().includes(q))
  );
  state.visible = 24;
  renderGrid();
}

function renderGrid() {
  const visible = state.filtered.slice(0, state.visible);
  $('#channelGrid').innerHTML = visible.length
    ? visible.map(c => `<button class="channel-card" data-index="${state.filtered.indexOf(c)}">${logoHTML(c)}<span class="channel-info"><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.country || c.group)}</small></span><span class="live-tag">● LIVE</span></button>`).join('')
    : '<div class="empty-state">No channels match your search.</div>';
  $('#loadMore').style.display = state.visible < state.filtered.length ? 'inline-block' : 'none';
}

function renderQuick() {
  const picks = [...state.channels].sort(() => Math.random() - 0.5).slice(0, 4);
  $('#quickPicks').innerHTML = picks.map(c =>
    `<button class="quick-item" data-url="${encodeURIComponent(c.url)}">${logoHTML(c)}<span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.country || c.group)}</small></span><span class="arrow">›</span></button>`
  ).join('');
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
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
  $('#nowMeta').textContent = [channel.country, channel.group].filter(Boolean).join(' · ') || 'Live stream';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function load() {
  try {
    const response = await fetch(CHANNELS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Channel API returned ${response.status}`);
    const data = await response.json();
    state.channels = data.map(normalizeChannel).filter(c => /^https?:\/\//i.test(c.url));
    if (!state.channels.length) throw new Error('No channels found');
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
    $('#channelGrid').innerHTML = '<div class="empty-state">The channel guide could not be loaded.<br><small>Please refresh and try again.</small></div>';
    $('#quickPicks').innerHTML = '<p style="color:var(--muted);font-size:12px">Channel guide temporarily unavailable.</p>';
  }
}

$('#searchInput').addEventListener('input', e => { state.query = e.target.value; refresh(); });
$('#countrySelect').addEventListener('change', e => { state.country = e.target.value; refresh(); });
$('#genreChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.genre = chip.dataset.genre;
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === chip));
  refresh();
});
$('#channelGrid').addEventListener('click', e => {
  const card = e.target.closest('.channel-card');
  if (card) play(state.filtered[Number(card.dataset.index)]);
});
$('#quickPicks').addEventListener('click', e => {
  const item = e.target.closest('.quick-item');
  if (item) play(state.channels.find(c => c.url === decodeURIComponent(item.dataset.url)));
});
$('#randomButton').addEventListener('click', () => {
  if (state.channels.length) play(state.channels[Math.floor(Math.random() * state.channels.length)]);
});
$('#loadMore').addEventListener('click', () => { state.visible += 24; renderGrid(); });
$('#shareButton').addEventListener('click', async () => {
  if (!state.current) return;
  try {
    await navigator.clipboard.writeText(state.current.url);
    $('#shareButton').innerHTML = '✓ <span>Copied</span>';
    setTimeout(() => $('#shareButton').innerHTML = '↗ <span>Share</span>', 1500);
  } catch {}
});
$('#themeButton').addEventListener('click', () => document.body.classList.toggle('light'));
load();
