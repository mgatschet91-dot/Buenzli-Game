# 🏙️ Buenzlifight — Game Client

> **Buenzlifight** ist ein isometrisches Schweizer Städtebau-MMO im Browser.  
> Baue deine eigene Gemeinde, verwalte Wirtschaft & Infrastruktur und spiel mit anderen Spielern in Echtzeit.

🌐 **Jetzt spielen:** [buenzlifight.ch](https://buenzlifight.ch)

---

## ✨ Features

- 🗺️ **Alle 2'100+ Schweizer Gemeinden** — jede echte Gemeinde spielbar
- 🏗️ **Isometrische 3D-Engine** — Three.js basierter Raum-Viewer mit Avatar-System
- 👥 **Echtzeit-Multiplayer** — Avatare, Chat, Sprechblasen, Raum-Besuche
- 💰 **Vollständiges Wirtschaftssystem** — Treasury, Steuern, Kredite, Marktplatz
- 🏢 **Unternehmen** — Firmen gründen, Verträge abschliessen, Buslinie betreiben
- 🎉 **Party-System** — Mansion-Partys mit Polizei-Mechanik und Bussen
- 🚔 **Crime-System** — Gangster, Dealer, Polizei-NPCs
- 🚒 **Fahrzeug-System** — Polizei, Feuerwehr, Werkhof-LKW, Müllauto
- 🏆 **XP & Level** — Fortschritt, Achievements, Ranglisten
- 💬 **Motto & Profil** — Avatar-Outfits, Motto, Gemeinde-Badge

---

## ⚡ Tech Stack

| Technologie | Verwendung |
|-------------|-----------|
| **Next.js 14** | React Framework (App Router) |
| **TypeScript** | Typsicherheit |
| **Three.js** | Isometrischer 3D Raum-Viewer |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | UI-Komponenten |
| **Socket.IO Client** | Echtzeit-Multiplayer |

---

## 🗂️ Projektstruktur

```
mapGame/
├── public/
│   └── isometric/
│       └── src/
│           ├── game3d.js              # Haupt-Game-Engine (Three.js)
│           ├── game3d-character.js    # Avatar-System, Chat-Bubbles
│           ├── game3d-furniture.js    # Möbel & Raum-Objekte
│           └── game3d-npc.js          # NPC-System
├── src/
│   ├── app/                           # Next.js App Router Pages
│   ├── components/
│   │   ├── Game.tsx                   # Haupt-Game-Komponente
│   │   ├── game/
│   │   │   ├── CanvasIsometricGrid.tsx  # Isometrische Karten-Engine
│   │   │   ├── IsometricRoomViewer.tsx  # 3D Raum-Viewer (iframe)
│   │   │   ├── vehicleSystems.ts        # Fahrzeuge (Polizei, Feuerwehr...)
│   │   │   ├── pedestrianSystem.ts      # Fussgänger & Crime-NPCs
│   │   │   └── panels/                  # UI-Panels (Gebäude, Profil, Party...)
│   ├── hooks/                         # React Hooks (Multiplayer, Sync)
│   ├── lib/
│   │   ├── api/                       # API-Client-Funktionen
│   │   └── deltaSync.ts               # WebSocket Delta-Sync
│   └── context/
│       └── GameContext.tsx            # Globaler Game-State
├── .env.local.example                 # ⚙️ Konfigurationsvorlage
└── next.config.js
```

---

## 🚀 Schnellstart

### Voraussetzungen
- Node.js 18+
- Laufender [Buenzlifight Server Core](https://github.com/mgatschet91-dot/Buenzlifight-Server)

### Setup

```bash
# 1. Abhängigkeiten installieren
cd mapGame
npm install

# 2. Konfiguration anlegen
cp .env.local.example .env.local
# .env.local mit Server-URL befüllen
```

**.env.local:**
```env
NEXT_PUBLIC_CORE_API_URL=http://127.0.0.1:4100
NEXT_PUBLIC_AUTH_API_URL=http://127.0.0.1:4100
NEXT_PUBLIC_WEBSOCKET_URL=http://127.0.0.1:4100
```

```bash
# 3. Development-Server starten
npm run dev
# → http://localhost:3000
```

### Produktion
```bash
npm run build
npm start
```

---

## 🎮 Architektur

```
Browser
  └── Next.js App
        ├── CanvasIsometricGrid     ← Städtebau-Karte (Canvas 2D)
        │     ├── vehicleSystems    ← Fahrzeuge & Notfalleinsätze
        │     └── pedestrianSystem  ← NPCs & Crime
        ├── IsometricRoomViewer     ← 3D Raum (Three.js iframe)
        │     ├── game3d.js         ← Room-Engine
        │     └── game3d-character  ← Avatar & Chat
        └── deltaSync.ts            ← Socket.IO Verbindung zum Server
```

Der **Raum-Viewer** läuft in einem `<iframe>` mit Three.js und kommuniziert via `postMessage` mit dem React-Parent. Die **Karten-Engine** rendert die isometrische Stadtansicht direkt im Canvas.

---

## 🔗 Zusammenspiel mit Server

Der Client verbindet sich via **Socket.IO** mit dem Server Core und erhält autoritativen State:

- Alle 3 Sekunden: Stats, Crime-NPCs, Party-Updates, Gebäude-Änderungen
- Echtzeit: Avatar-Bewegungen, Chat, Fahrzeuge, Wetter

---

## 📦 Wichtige Befehle

```bash
npm run dev        # Development mit Hot-Reload
npm run build      # Produktions-Build
npm run lint       # ESLint prüfen
npm run typecheck  # TypeScript prüfen
```

---

## 🔗 Verwandte Repos

- **[Buenzlifight-Server](https://github.com/mgatschet91-dot/Buenzlifight-Server)** — Node.js Backend / Game-Server

---

*Made with ❤️ in der Schweiz 🇨🇭*
