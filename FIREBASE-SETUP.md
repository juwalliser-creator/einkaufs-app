# Firebase einrichten (einmalig, ca. 10 Minuten)

Damit du und dein Bruder **dieselben Daten** seht, braucht die App einen kostenlosen Cloud-Speicher bei Google (Firebase).

## Schritt 1: Google-Konto

Du brauchst ein Google-Konto (Gmail). Falls du eins hast, einfach weiter.

## Schritt 2: Firebase-Projekt anlegen

1. Öffne: https://console.firebase.google.com
2. Klicke **Projekt hinzufügen** (Add project)
3. Name z. B.: `einkaufs-app`
4. Google Analytics kannst du **deaktivieren** (nicht nötig)
5. Auf **Projekt erstellen** klicken und warten

## Schritt 3: Firestore aktivieren

1. Links im Menü: **Build** → **Firestore Database**
2. **Datenbank erstellen** klicken
3. Modus: **Im Produktionsmodus starten** → Weiter
4. Standort: `europe-west3 (Frankfurt)` wählen → **Aktivieren**

## Schritt 4: Sicherheitsregeln (wichtig)

1. Oben im Firestore-Bereich: Tab **Regeln** (Rules)
2. Alles ersetzen durch:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
    }
  }
}
```

3. **Veröffentlichen** klicken

> Hinweis: Jeder mit dem Gruppencode kann lesen/schreiben. Teile den Code nur mit deinem Bruder.

## Schritt 5: Web-App registrieren

1. Projektübersicht (Zahnrad oben links) → **Projekteinstellungen**
2. Nach unten scrollen → **App hinzufügen** → Symbol **Web** (`</>`)
3. App-Spitzname: `Einkaufs App` → **App registrieren**
4. Es erscheinen Werte wie `apiKey`, `projectId` usw.

## Schritt 6: Werte in die App eintragen

1. In VS Code die Datei `js/firebase-config.js` öffnen
2. Die Platzhalter durch deine echten Werte ersetzen, z. B.:

```javascript
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "einkaufs-app.firebaseapp.com",
  projectId: "einkaufs-app",
  storageBucket: "einkaufs-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

3. Datei speichern (Strg+S)

## Schritt 7: App neu hochladen

Wenn die App schon auf GitHub liegt:

1. GitHub Desktop öffnen
2. Du siehst die geänderten Dateien
3. Unten Summary: `Firebase Sync hinzugefügt`
4. **Commit to main** → **Push origin**

Nach 1–2 Minuten ist die Online-Version aktualisiert.

## Schritt 8: Link an deinen Bruder schicken

Schicke den Link **mit Gruppencode**, z. B.:

`https://DEIN-NAME.github.io/einkaufs-app/?gruppe=FAMILIE`

Beide müssen **denselben Gruppencode** haben (Standard: `FAMILIE`, änderbar in `firebase-config.js`).

In der App kannst du den Link auch über **Link teilen** kopieren.
