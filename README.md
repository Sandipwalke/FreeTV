# FreeTV

A modern, client-side live TV directory powered by the public [iptv-org](https://github.com/iptv-org/iptv) channel list.

## Run locally

Open `index.html` through a local web server (for example, `python3 -m http.server`) so the playlist can be fetched by the browser.

## GitHub Pages

The included GitHub Actions workflow deploys automatically on every push to `main`. In repository **Settings → Pages**, set the source to **GitHub Actions** if GitHub has not selected it automatically. Once the workflow completes, the site is available at:

`https://sandipwalke.github.io/FreeTV/`

Streams are supplied by third parties. Availability and browser playback depend on each provider and the user's network.
