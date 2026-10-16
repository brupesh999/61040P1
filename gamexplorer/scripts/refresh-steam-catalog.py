"""Refresh catalog metadata and remote image URLs. Never downloads image files."""
import html
from datetime import date
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlencode, urlparse

# Established games with recognizable store artwork; no community grids are used.
APPS = [
    620, 400, 220, 70, 550, 500,
    105600, 413150, 367520, 504230, 268910, 391540, 588650, 646570,
    212680, 590380, 239030, 653530, 250900, 219150, 274170, 40800,
    224760, 239350, 48000, 304430, 26800, 107100, 237930, 462770,
    387290, 206440, 207170, 251730, 489830, 22330, 22370, 22380,
    292030, 20920, 570940, 335300, 374320, 814380, 200710,
    49520, 8870, 205100, 319630, 204360,
    3837340, 1462040, 2909400, 39210, 2515020,
    787480, 304240, 883710, 2050650, 3764200,
    631510, 329050, 1608070, 524220, 1113560, 359870, 292120, 637650,
]
assert len(APPS) == len(set(APPS))
EXISTING_COVER_APPS = [601150, 1145360]
ALLOWED_HOSTS = {
    'shared.fastly.steamstatic.com', 'shared.akamai.steamstatic.com',
    'shared.cloudflare.steamstatic.com', 'cdn.akamai.steamstatic.com',
    'cdn.cloudflare.steamstatic.com',
}

def fetch_json(url):
    response = subprocess.run(
        ['curl', '--fail', '--silent', '--show-error', '--max-time', '25', url],
        check=True, capture_output=True, text=True,
    )
    return json.loads(response.stdout)


def available_image(url, appid):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS:
        raise RuntimeError(f'Unexpected artwork host for {appid}')
    if not any(parsed.path.startswith(f'{prefix}{appid}/') for prefix in ['/steam/apps/', '/store_item_assets/steam/apps/']):
        raise RuntimeError(f'Artwork does not belong to app {appid}')
    head = subprocess.run(
        ['curl', '--head', '--fail', '--silent', '--show-error', '--max-time', '25', url],
        capture_output=True, text=True,
    )
    return head.returncode == 0 and 'content-type: image/' in head.stdout.lower()


def fetch_entry(appid):
    url = f'https://store.steampowered.com/api/appdetails?appids={appid}&cc=us&l=english'
    record = fetch_json(url)[str(appid)]
    if not record.get('success'):
        raise RuntimeError(f'Steam did not return app {appid}')
    game = record['data']
    if game.get('type') != 'game' or game.get('steam_appid') != appid:
        raise RuntimeError(f'Unexpected Steam identity/type for {appid}')
    release_date = game.get('release_date', {}).get('date', '')
    year = re.search(r'\b(19|20)\d{2}\b', release_date)
    if not year or not game.get('developers'):
        raise RuntimeError(f'Missing release year/developer for {appid}')
    cover = f'https://cdn.akamai.steamstatic.com/steam/apps/{appid}/library_600x900.jpg'
    if not available_image(cover, appid):
        query = urlencode({'input_json': json.dumps({
            'ids': [{'appid': appid}],
            'context': {'country_code': 'US', 'language': 'english'},
            'data_request': {'include_assets': True},
        })})
        items = fetch_json(f'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?{query}').get('response', {}).get('store_items', [])
        item = next((item for item in items if item.get('appid') == appid and item.get('success') == 1), {})
        assets = item.get('assets', {})
        filename = assets.get('library_capsule')
        pattern = assets.get('asset_url_format', '')
        candidate = 'https://shared.akamai.steamstatic.com/store_item_assets/' + pattern.replace('${FILENAME}', filename) if filename and '${FILENAME}' in pattern else None
        if candidate and available_image(candidate, appid):
            cover = candidate
        elif appid not in {207170, 251730}:
            raise RuntimeError(f'Missing portrait artwork for {appid}')
        else:
            # Retain official provenance; the UI uses a title tile for landscape art.
            cover = game['header_image']
    return {
        'title': html.unescape(game['name']).strip(),
        'developer': ', '.join(html.unescape(name) for name in game['developers']),
        'releaseYear': int(year.group()),
        'steamAppId': appid,
        'coverUrl': cover,
        'sourceUrl': f'https://store.steampowered.com/app/{appid}/',
    }


if __name__ == '__main__':
    rows = []
    for appid in APPS + EXISTING_COVER_APPS:
        rows.append(fetch_entry(appid))
        print(f'{len(rows)}/{len(APPS) + len(EXISTING_COVER_APPS)}: {rows[-1]["title"]}', flush=True)
        time.sleep(0.5)

    # Only metadata and URLs are written; image bytes remain on Steam.
    path = Path(__file__).resolve().parents[1] / 'data' / 'steam-catalog.json'
    path.write_text(json.dumps({'retrievedOn': date.today().isoformat(), 'source': 'Steam store metadata', 'games': rows[:len(APPS)], 'existingCovers': rows[len(APPS):]}, indent=2, ensure_ascii=False) + '\n')
    print(f'Saved {len(APPS)} metadata entries and remote cover URLs. No image files saved.', flush=True)
