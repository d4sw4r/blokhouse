# Contributing to Blokhouse

Vielen Dank für dein Interesse an Blokhouse! Diese Anleitung hilft dir beim Einstieg.

## Lokales Setup

### Voraussetzungen
- Node.js >= 18
- Git

### Schritte

1. **Repository klonen**
   ```bash
   git clone https://github.com/d4sw4r/blokhouse.git
   cd blokhouse
   ```

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

3. **Umgebungsvariablen konfigurieren**
   ```bash
   cp .env.example .env
   # .env anpassen mit deinen Werten
   ```

4. **Datenbank einrichten**
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

5. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```

Die App läuft dann unter `http://localhost:3000`.

## Coding Guidelines

- **TypeScript bevorzugt**: Wir nutzen TypeScript für bessere Code-Qualität
- **ESLint**: Der Code muss durch ESLint laufen (`npm run lint`)
- **Tests**: Keine Pflicht, aber willkommen. Wenn du Tests schreiben möchtest, nutze die bestehende Teststruktur

## Pull Request Prozess

1. **Branch erstellen**
   ```bash
   git checkout -b feature/deine-feature-beschreibung
   ```

2. **Änderungen committen**
   - Aussagekräftige Commit-Messages verwenden
   - Kleine, fokussierte Commits bevorzugen

3. **PR öffnen**
   - Beschreibenden Titel verwenden
   - PR-Template ausfüllen (Checkliste nicht vergessen!)
   - Auf `main` branch targeten

4. **Review**
   - Geduldig auf Feedback warten
   - Angeforderte Änderungen umsetzen

## Issue Labels

| Label | Beschreibung |
|-------|--------------|
| `bug` | Etwas funktioniert nicht wie erwartet |
| `enhancement` | Neue Features oder Verbesserungen |
| `documentation` | Dokumentation betreffend |
| `good first issue` | Gut für Einsteiger geeignet |

## Fragen?

Bei Unklarheiten einfach ein Issue öffnen oder im PR diskutieren.
