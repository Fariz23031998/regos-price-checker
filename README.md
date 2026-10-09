# REGOS Price Checker

Local kiosk that reads product prices from a REGOS Firebird database and shows the name and price when a barcode is scanned.

The service polls Firebird for catalog changes, copies items, prices, and barcodes into SQLite, and serves the page at `http://localhost:3000`. It uses wire encryption, which Firebird 3 requires by default.

## Setup

1. Install Node.js 20 or newer and run a Firebird server that can open the REGOS `.fdb` file.
2. From this folder, install dependencies:

```
npm install
```

3. Edit `backend/config.json`. Set `database` to the `.fdb` path. The other defaults match a local REGOS install: host `localhost`, port `3050`, user `SYSDBA`, price type `1`.

`check_time` is how often the service looks for changes, in seconds.

## Run

Development, with the API on port 3000 and the page on port 5173:

```
npm run dev
```

One local page:

```
npm start
```

Open `http://localhost:3000`.

## Screen

The page asks for a barcode. A scanner can type into the focused field and send Enter.

- A match shows the product name, its unit, and the rounded price.
- An unknown barcode shows `Товар не найдено!`.
- A product with no price shows `Цена не указано!`.
- The screen returns to `СКАНИРУЙТЕ ШТРИХКОД` after the reset time.

Typed commands:

- `update` reloads the catalog from Firebird.
- `settings` changes font sizes, colors, the screen reset time, and the sync interval.
- `connection` changes the Firebird host, database path, user, password, and price type.

Display settings are stored in `backend/settings.json`. Connection settings are stored in `backend/config.json`. Logs are written to `backend/logs/`.
