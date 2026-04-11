# BuenzliFight - Schweizer Gemeinde-Simulator

Multiplayer isometrischer Gemeinde-Simulator fuer die Schweiz, gebaut mit **Next.js 16**, **TypeScript**, **Pixi.js** und **Socket.IO**.

Spiel online: [buenzlifight.ch](https://buenzlifight.ch)

## Features

- **Isometrische Rendering Engine**: Basiert auf [isometric-city](https://github.com/amilich/isometric-city) von amilich, erweitert mit Pixi.js
- **Multiplayer**: Echtzeit-Synchronisation via Socket.IO / WebSocket
- **Alle 2'100+ Schweizer Gemeinden**: Jede echte Gemeinde spielbar, mit BFS-Nummer und Kanton
- **Wirtschaftssystem**: Treasury, Steuern, Kredite, Schulden, Marktplatz, Handel
- **Unternehmen**: Firmen gruenden, Vertraege abschliessen, Arbeitsauftraege
- **Events**: Buenzli-Events, Katastrophen, Inspektionen
- **Sozial**: Chat, Partnerschaften, XP/Level-System, Ranglisten

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Pixi.js 8, Tailwind CSS
- **Backend**: Node.js (raw HTTP + Socket.IO), MySQL
- **Rendering**: Pixi.js (isometrisch)
- **Auth**: JWT + Supabase

## Getting Started

### Voraussetzungen

- Node.js (v18+)
- MySQL 8+
- npm

### Installation

1. **Repository klonen und Dependencies installieren:**
   ```bash
   cd mapGame && npm install
   cd ../server-core && npm install
   ```

2. **Datenbank einrichten:**
   ```bash
   # SQL Migrationen ausfuehren (001-052)
   mysql -u root -p buenzlifight < sql/052_all_swiss_municipalities.sql
   ```

3. **Development starten:**
   ```bash
   # Terminal 1: Server
   cd server-core && node index.js

   # Terminal 2: Client
   cd mapGame && npm run dev
   ```

4. **Spiel oeffnen:**
   [http://localhost:3000](http://localhost:3000)

## Attribution

Dieses Projekt basiert auf [isometric-city](https://github.com/amilich/isometric-city) von **amilich** (MIT License).
Siehe `LICENSE` und `NOTICE.md` fuer vollstaendige Attributions-Details.

## License

MIT License — siehe `LICENSE`.
