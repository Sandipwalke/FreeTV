const DATA_URL = new URL('data/channels.json', document.baseURI).href;

const state = {
  channels: [],
  filtered: [],
  visible: 24,
  genre: '',
  country: '',
  query: '',
  current: null,
  hls: null
};

const $ = selector => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function label(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();
}

function logoHTML(channel, cls = 'channel-logo') {
  if (channel.logo) {
    return `<img class="${cls}" src="${escapeHTML(channel.logo)}" alt="" loading="lazy" onerror="this.style.display='none'>`;
  }

  return `<span class="${cls} fallback-logo">${escapeHTML(initials(channel.name))}</span>`;
}

function countries() {
  const values = [...new Set(state.channels.map(channel => channel.country).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  $('#countrySelect').innerHTML =
    '<option value="">All countries</option>' +
    values.map(country =>
      `<option value="${escapeHTML(country)}">${escapeHTML(country)}</option>`
    ).join('');
}

function genres() {
  const values = [...new Set(
    state.channels.flatMap(channel => channel.categories || []).filter(Boolean)
  )]
    .sort((a, b) => label(a).localeCompare(label(b)))
    .slice(0, 20);

  $('#genreChips').innerHTML =
    '<button class="chip active" data-genre="">All</button>' +
    values.map(genre =>
      `<button class="chip" data-genre="${escapeHTML(genre)}">${escapeHTML(label(genre))}</button>`
    ).join('');
}

function refresh() {
  const query = state.query.toLowerCase().trim();

  state.filtered = state.channels.filter(channel => {
    const categories = channel.categories || [];
    const haystack = [
      channel.name,
      channel.country,
      ...categories.map(label)
    ].join(' ').toLowerCase();

    return (!state.genre || categories.includes(state.genre))
      && (!state.country || channel.country === state.country)
      && (!query || haystack.includes(query));
  });

  state.visible = 24;
  renderGrid();
}

function renderGrid() {
  const visible = state.filtered.slice(0, state.visible);

  $('#channelGrid').innerHTML = visible.length
    ? visible.map(channel => {
        const index = state.filtered.indexOf(channel);
        return `<button class="channel-card" data-index="${index}">
          ${logoHTML(channel)}
          <span class="channel-info">
            <strong>${escapeHTML(channel.name)}</strong>
            <small>${escapeHTML(channel.country || 'Live stream')}</small>
          </span>
          <span class="live-tag">● LIVE</span>
        </button>`;
      }).join('')
    : '<div class="empty-state">No channels match your search.</div>';

  $('#loadMore').style.display =
    state.visible < state.filtered.length ? 'inline-block' : 'none';
}

function renderQuick() {
  const picks = [...state.channels]
    .slice(0, 8)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  $('#quickPicks').innerHTML = picks.map(channel =>
    `<button class="quick-item" data-index="${state.channels.indexOf(channel)}">
      ${logoHTML(channel)}
      <span>
        <strong>${escapeHTML(channel.name)}</strong>
        <small>${escapeHTML(channel.country || 'Live stream')}</small>
      </span>
      <span class="arrow">›</span>
    </button>`
  ).join('');
}

function stopPlayer() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }

  const video = $('#video');
  video.pause();
  video.removeAttribute('src');
  video.load();
}

function play(channel) {
  if (!channel?.url) return;

  const video = $('#video');

  stopPlayer();
  state.current = channel;

  $('#videoPlaceholder').style.display = 'none';
  video.style.display = 'block';

  if (window.Hls && Hls.isSupported() && /\.m3u8(?:$|[?#])/i.test(channel.url)) {
    state.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true
    });

    state.hls.loadSource(channel.url);
    state.hls.attachMedia(video);

    state.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data?.fatal) {
        console.warn('HLS playback failed:', data);
        $('#nowMeta').textContent = 'Stream could not be played in this browser';
      }
    });
  } else {
    video.src = channel.url;
  }

  video.play().catch(() => {});

  $('#nowTitle').textContent = channel.name;
  $('#nowMeta').textContent =
    [channel.country, channel.quality].filter(Boolean).join(' · ') || 'Live stream';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function load() {
  try {
    $('#channelGrid').innerHTML =
      '<div class="empty-state">Loading the channel guide<span class="loader"></span></div>';

    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Channel data returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const channels = Array.isArray(data) ? data : data.channels;

    if (!Array.isArray(channels) || !channels.length) {
      throw new Error('Channel data is empty');
    }

    state.channels = channels.filter(channel => channel.url && channel.name);

    if (!state.channels.length) {
      throw new Error('No playable channels were generated');
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

$('#searchInput').addEventListener('input', event => {
  state.query = event.target.value;
  refresh();
});

$('#countrySelect').addEventListener('change', event => {
  state.country = event.target.value;
  refresh();
});

$('#genreChips').addEventListener('click', event => {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  state.genre = chip.dataset.genre;
  document.querySelectorAll('.chip').forEach(item =>
    item.classList.toggle('active', item === chip)
  );
  refresh();
});

$('#channelGrid').addEventListener('click', event => {
  const card = event.target.closest('.channel-card');
  if (card) play(state.filtered[Number(card.dataset.index)]);
});

$('#quickPicks').addEventListener('click', event => {
  const item = event.target.closest('.quick-item');
  if (item) play(state.channels[Number(item.dataset.index)]);
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
    setTimeout(() => {
      $('#shareButton').innerHTML = '↗ <span>Share</span>';
    }, 1500);
  } catch {}
});

$('#themeButton').addEventListener('click', () =>
  document.body.classList.toggle('light')
);

load();
