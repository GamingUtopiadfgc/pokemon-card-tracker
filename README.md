# 🎴 Pokémon Card Inventory Tracker

A desktop app built with [Electron](https://electronjs.org) for tracking your Pokémon card collection — with live card search, market prices, backup manager, and CSV export.

## Features

- 🔍 **Search cards** via the free [Pokémon TCG API](https://pokemontcg.io) — live card art + market prices
- ➕ **Add cards** with quantity, condition (M/NM/LP/MP/HP/D), and custom notes
- 🖼️ **Grid & List view** with card art, set info, condition badge, and price
- 🔧 **Edit/Delete** cards via a detail modal
- 💲 **Refresh price** per card using live TCG market data
- 📊 **Stats sidebar** — total cards, unique count, sets collected, estimated value
- 🗂️ **Filters** — by set, type, condition, rarity
- ↕️ **Sort** by name, set, value, quantity, date added
- 🗄️ **Backup Manager** — auto daily backups, manual backups, restore & delete
- ⬇️ **Export to CSV** / ⬆️ **Import from JSON**
- 💾 Inventory saved locally in your OS app data folder

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v18+

### Run in development
```bash
npm install
npm start
```

### Build Windows installer (.exe)
```bash
npm install
npm run build
```
The installer will be output to the `dist/` folder.

## Project Structure

```
├── main.js       # Electron main process (IPC, file I/O, backups)
├── preload.js    # Context bridge (IPC API exposed to renderer)
├── index.html    # App UI
├── style.css     # Dark Pokémon-themed styles
└── app.js        # Renderer logic (TCG API, inventory, filters, UI)
```

## Data Storage

Your inventory is saved to your OS user data directory:
- **Windows:** `%APPDATA%\poke-card-inventory-tracker\poke-inventory.json`
- **Backups:** `%APPDATA%\poke-card-inventory-tracker\backups\`

## License

MIT
