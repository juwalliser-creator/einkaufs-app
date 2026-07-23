# Einkauf & Wochenplan (mit Live-Sync)

Mobile Web-App für **gemeinsame** Einkaufsliste, Lebensmittel-Datenbank und Wochenplan.

Wenn du etwas änderst, sieht dein Bruder es **sofort** auf seinem Handy – und umgekehrt.

## Funktionen

- **Einkaufsliste** – gemeinsam, live synchronisiert
- **Lebensmittel** – gemeinsame Datenbank, per + zur Liste
- **Wochenplan** – gemeinsamer Wochenplan
- **Link teilen** – Button oben rechts kopiert den Gruppen-Link

## Einmalig: Firebase einrichten

**Wichtig:** Ohne Firebase funktioniert die Synchronisation nicht.

Folge der Datei **`FIREBASE-SETUP.md`** – Schritt für Schritt, auch ohne Programmierkenntnisse.

Kurz: Firebase-Projekt anlegen → Firestore aktivieren → Werte in `js/firebase-config.js` eintragen.

## Lokal testen (Windows)

```powershell
cd C:\Users\bpwal\einkaufs-app
python -m http.server 8080
```

Browser: `http://localhost:8080`

Zum Testen der Sync: Link in zwei Browser-Tabs oder auf zwei Handys öffnen.

## Mit Bruder teilen

1. App auf GitHub Pages veröffentlichen (siehe vorherige Anleitung)
2. In der App auf **Link teilen** tippen
3. Link per WhatsApp schicken

Der Link enthält automatisch den Gruppencode, z. B.:

`https://deinname.github.io/einkaufs-app/?gruppe=FAMILIE`

Beide müssen **denselben Gruppencode** nutzen.

## Dateien

- `index.html` – Oberfläche
- `css/style.css` – Design
- `js/app.js` – App-Logik & Sync
- `js/firebase-config.js` – **hier Firebase-Daten eintragen**
- `FIREBASE-SETUP.md` – Firebase-Anleitung
- `manifest.json`, `sw.js` – PWA
