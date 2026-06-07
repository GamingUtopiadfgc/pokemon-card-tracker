# Changelog

## [1.0.8] - 2026-06-07

### Changed
- Manual entry lookup flow simplified — type the card name in the Name field, then click **🔍 Look Up Info** (next to Add to Inventory) to cross-reference the TCG API; pick a result and all remaining fields auto-fill; no separate search bar needed

---

## [1.0.7] - 2026-06-07

### Added
- **Settings panel** — new ⚙ Settings button in the header opens a settings modal with app version display, a "Check for Updates" button that queries GitHub for the latest release, and an "Open Data Folder" shortcut to your inventory and backups location

---

## [1.0.6] - 2026-06-07

### Added
- Manual entry tab now cross-references the TCG API — type a card name in the lookup bar, pick from a live dropdown of matching cards, and all fields (name, supertype, set, number, rarity, types, market price, image) are auto-filled; every field stays editable so you can override anything before saving

---

## [1.0.5] - 2026-06-07

### Added
- **More filters** — sidebar now includes Supertype (Pokémon / Trainer / Energy checkboxes), Price Range (min / max), Date Added window (last 7 / 30 / 90 days, this year), and Min Quantity
- **Manual card entry** — "✏️ Enter Manually" tab in the Add Card modal lets you input any card directly (name, supertype, set, number, rarity, types, price, image URL, quantity, condition, notes) without needing a TCG API match

---

## [1.0.4] - 2026-06-07

### Changed
- Installer now automatically closes any running instance of the app before updating, preventing file-lock errors during install

---

## [1.0.3] - 2026-06-07

### Fixed
- Card grid cells now hold their full portrait height — switched from aspect-ratio to explicit pixel height so the layout cannot collapse regardless of image load state

---

## [1.0.2] - 2026-06-07

### Fixed
- Card images now load correctly in large collections — switched from lazy to eager loading so Electron no longer skips images inside the scrollable grid
- Cards now hold their portrait shape while images are loading (min-height added as safety net)

---

## [1.0.1] - 2026-06-07

### Fixed
- Export CSV button now opens the save dialog correctly (event listener was missing)
- Import JSON button now opens the file picker correctly (event listener was missing)
- Card images now show a placeholder when they fail to load instead of going blank
- Card grid no longer collapses into thin lines with large collections

### Changed
- Card grid switched to a fixed 9-column layout so card art is clearly visible at all collection sizes
- Installer now silently removes any previously installed version before installing the new one (your inventory data and backups are always preserved)

---

## [1.0.0] - 2026-05-17

### Initial release
- Live card search via Pokémon TCG API with card art and market prices
- Add cards with quantity, condition, and notes
- Grid and list view with filters (set, type, condition, rarity) and sorting
- Edit and delete cards via detail modal
- Refresh market price per card
- Collection stats (total cards, unique count, sets, estimated value)
- Export inventory to CSV
- Import inventory from JSON
- Backup manager — auto daily backups, manual backups, restore and delete
