# Firebase & Anmeldung einrichten

Damit du und dein Bruder **dieselben Daten** seht und nur **ihr zwei** (mit bestätigter E-Mail) reinkommt.

Geschätzter Aufwand für dich: **ca. 45–60 Minuten**, einmalig.

---

## Teil A: Firebase-Projekt (falls noch nicht erledigt)

### Schritt 1: Google-Konto

Du brauchst ein Google-Konto (Gmail).

### Schritt 2: Firebase-Projekt anlegen

1. Öffne: https://console.firebase.google.com  
2. **Projekt hinzufügen**  
3. Name z. B.: `einkaufs-app`  
4. Google Analytics kann **aus** bleiben  
5. **Projekt erstellen**

### Schritt 3: Firestore aktivieren

1. Links: **Build** → **Firestore Database**  
2. **Datenbank erstellen**  
3. Modus: **Im Produktionsmodus starten**  
4. Standort: `europe-west3 (Frankfurt)` → **Aktivieren**

### Schritt 4: Web-App registrieren

1. Projektübersicht (Zahnrad) → **Projekteinstellungen**  
2. Nach unten → **App hinzufügen** → **Web** (`</>`)  
3. Spitzname: `WG Planung` → **App registrieren**  
4. Werte kopieren (`apiKey`, `projectId`, …)

### Schritt 5: Werte in die App eintragen

1. Datei `js/firebase-config.js` öffnen  
2. Platzhalter durch deine echten Werte ersetzen  
3. Speichern (Strg+S)

---

## Teil B: E-Mail-Anmeldung aktivieren (neu, wichtig)

### Schritt 6: Authentication einschalten

1. Firebase Console → **Build** → **Authentication**  
2. **Los geht's** / **Get started**  
3. Tab **Sign-in method** / **Anmeldemethoden**  
4. **E-Mail/Passwort** (Email/Password) anklicken  
5. **Aktivieren** → **Speichern**

### Schritt 7: Authorized Domains prüfen

1. Authentication → **Settings** / **Einstellungen**  
2. Unter **Authorized domains** muss stehen:  
   - `localhost` (zum Testen am PC)  
   - `juwalliser-creator.github.io` (deine GitHub Pages URL)  
3. Fehlt die GitHub-Domain → **Add domain** → eintragen → speichern

### Schritt 8: Bestätigungs-Mail anpassen (optional)

1. Authentication → **Templates** / **Vorlagen**  
2. **Email address verification**  
3. Absendername z. B. `WG Planung` anpassen  
4. Speichern  

(Die Mail kommt von `noreply@…firebaseapp.com` – ggf. im **Spam** suchen.)

---

## Teil C: Firestore-Regeln (neu, wichtig)

Ohne diese Regeln funktioniert die Anmeldung **nicht** (Firebase blockiert Zugriff).

### Schritt 9: Regeln veröffentlichen

1. Firestore → Tab **Regeln** / **Rules**  
2. Alles ersetzen durch den Inhalt aus der Datei `firestore.rules` in diesem Projekt:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isVerified() {
      return isSignedIn() && request.auth.token.email_verified == true;
    }

    match /users/{userId} {
      allow read, write: if isVerified() && request.auth.uid == userId;
    }

    match /rooms/{roomId} {
      allow read, write: if isVerified();
    }
  }
}
```

3. **Veröffentlichen** / **Publish**

> Nur **eingeloggte Nutzer mit bestätigter E-Mail** dürfen lesen/schreiben. Der Gruppencode bleibt zusätzlich in der App.

---

## Teil D: App online stellen & testen

### Schritt 10: Code hochladen

1. GitHub Desktop öffnen  
2. Geänderte Dateien committen, z. B.: `Anmeldung mit E-Mail-Bestätigung`  
3. **Push origin**  
4. 2–5 Minuten warten  

### Schritt 11: Ersten Account anlegen (du)

1. App öffnen: https://juwalliser-creator.github.io/einkaufs-app/  
2. **Hard-Refresh** (iPhone: Seite neu laden / Cache leeren)  
3. Tab **Registrieren**  
4. Nutzername, E-Mail, Passwort, Passwort bestätigen  
5. **Angemeldet bleiben** aktiviert lassen → **Konto erstellen**  
6. E-Mail-Postfach öffnen → Link **Bestätigung** klicken  
7. Zur App → **Bestätigung prüfen**  
8. Gruppencode eingeben (z. B. `family`) → **Beitreten**

### Schritt 12: Zweiten Account (Bruder)

1. Link schicken (mit `?gruppe=family` wenn ihr wollt)  
2. Er registriert sich **mit seiner eigenen E-Mail**  
3. E-Mail bestätigen  
4. **Denselben Gruppencode** eingeben  

---

## So funktioniert „Angemeldet bleiben“

- Haken **an** (Standard): Du bleibst eingeloggt, auch nach App schließen  
- Haken **aus**: Login gilt nur für diese Browser-Sitzung  

---

## Kurz-Checkliste

- [ ] Firestore aktiv  
- [ ] Authentication → E-Mail/Passwort **an**  
- [ ] Domain `juwalliser-creator.github.io` erlaubt  
- [ ] Firestore-Regeln **veröffentlicht** (aus `firestore.rules`)  
- [ ] `firebase-config.js` ausgefüllt  
- [ ] Code gepusht  
- [ ] Account 1: registriert + E-Mail bestätigt  
- [ ] Account 2: registriert + E-Mail bestätigt  
- [ ] Beide in derselben Gruppe  

---

## Probleme?

| Problem | Lösung |
|--------|--------|
| Keine Mail | Spam prüfen, „Mail erneut senden“ |
| „Permission denied“ | Regeln aus Schritt 9 veröffentlicht? |
| Login klappt nicht | E-Mail/Passwort-Methode aktiviert? |
| Domain-Fehler | Authorized domains prüfen (Schritt 7) |

Bei Fragen: Fehlermeldung aus der App oder Browser-Konsole (F12) notieren.
