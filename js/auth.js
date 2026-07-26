(function (global) {
  "use strict";

  let auth = null;
  let db = null;
  let onAuthenticated = null;
  let onSignedOut = null;
  let pendingUsername = "";

  const els = {};

  function cacheElements() {
    els.authOverlay = document.getElementById("auth-overlay");
    els.verifyOverlay = document.getElementById("verify-overlay");
    els.authSubtitle = document.getElementById("auth-subtitle");
    els.authTabLogin = document.getElementById("auth-tab-login");
    els.authTabRegister = document.getElementById("auth-tab-register");
    els.loginForm = document.getElementById("login-form");
    els.registerForm = document.getElementById("register-form");
    els.loginEmail = document.getElementById("login-email");
    els.loginPassword = document.getElementById("login-password");
    els.loginStaySignedIn = document.getElementById("login-stay-signed-in");
    els.registerUsername = document.getElementById("register-username");
    els.registerEmail = document.getElementById("register-email");
    els.registerPassword = document.getElementById("register-password");
    els.registerPasswordConfirm = document.getElementById("register-password-confirm");
    els.registerStaySignedIn = document.getElementById("register-stay-signed-in");
    els.verifyEmailDisplay = document.getElementById("verify-email-display");
    els.checkVerificationBtn = document.getElementById("check-verification-btn");
    els.resendVerificationBtn = document.getElementById("resend-verification-btn");
    els.verifyLogoutBtn = document.getElementById("verify-logout-btn");
    els.logoutBtn = document.getElementById("logout-btn");
    els.sideMenuUser = document.getElementById("side-menu-user");
  }

  function showToast(message) {
    if (typeof global.showAppToast === "function") {
      global.showAppToast(message);
    }
  }

  function normalizeUsername(value) {
    return (value || "").trim().replace(/\s+/g, " ");
  }

  function authErrorMessage(error) {
    const code = error && error.code ? error.code : "";
    switch (code) {
      case "auth/email-already-in-use":
        return "Diese E-Mail ist bereits registriert.";
      case "auth/invalid-email":
        return "Bitte eine gültige E-Mail eingeben.";
      case "auth/weak-password":
        return "Passwort zu schwach (mindestens 6 Zeichen).";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "E-Mail oder Passwort ist falsch.";
      case "auth/too-many-requests":
        return "Zu viele Versuche – bitte später erneut probieren.";
      default:
        return (error && error.message) ? error.message : "Authentifizierungsfehler";
    }
  }

  function hideAllAuthOverlays() {
    if (els.authOverlay) els.authOverlay.classList.add("hidden");
    if (els.verifyOverlay) els.verifyOverlay.classList.add("hidden");
  }

  function showAuthPanel(mode) {
    hideAllAuthOverlays();
    if (els.authOverlay) els.authOverlay.classList.remove("hidden");
    const isRegister = mode === "register";
    if (els.authSubtitle) {
      els.authSubtitle.textContent = isRegister
        ? "Erstelle dein Konto für die WG-Planung."
        : "Melde dich an, um deine Gruppe zu nutzen.";
    }
    if (els.loginForm) els.loginForm.classList.toggle("hidden", isRegister);
    if (els.registerForm) els.registerForm.classList.toggle("hidden", !isRegister);
    if (els.authTabLogin) {
      els.authTabLogin.classList.toggle("active", !isRegister);
      els.authTabLogin.setAttribute("aria-selected", isRegister ? "false" : "true");
    }
    if (els.authTabRegister) {
      els.authTabRegister.classList.toggle("active", isRegister);
      els.authTabRegister.setAttribute("aria-selected", isRegister ? "true" : "false");
    }
  }

  function showVerifyPanel(email) {
    hideAllAuthOverlays();
    if (els.verifyOverlay) els.verifyOverlay.classList.remove("hidden");
    if (els.verifyEmailDisplay) els.verifyEmailDisplay.textContent = email || "";
  }

  function applyPersistence(staySignedIn) {
    const persistence = staySignedIn
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    return auth.setPersistence(persistence);
  }

  function refreshAuthToken(user) {
    if (!user || typeof user.getIdToken !== "function") {
      return Promise.resolve();
    }
    return user.getIdToken(true).catch(function () {
      return null;
    });
  }

  function proceedAsVerifiedUser(user) {
    hideAllAuthOverlays();
    const username = pendingUsername || user.displayName || "";
    pendingUsername = "";
    refreshAuthToken(user).then(function () {
      return saveUserProfile(user, username);
    }).finally(function () {
      if (typeof onAuthenticated === "function") onAuthenticated(user);
    });
  }
  function saveUserProfile(user, username) {
    if (!db || !user) return Promise.resolve();
    const cleanName = normalizeUsername(username || user.displayName || "");
    return db.collection("users").doc(user.uid).set({
      username: cleanName || "Nutzer",
      email: user.email || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  function updateSideMenuUser(user) {
    if (!els.sideMenuUser || !els.logoutBtn) return;
    if (!user) {
      els.sideMenuUser.classList.add("hidden");
      els.logoutBtn.classList.add("hidden");
      els.sideMenuUser.textContent = "";
      return;
    }
    const label = user.displayName || user.email || "Angemeldet";
    els.sideMenuUser.textContent = label;
    els.sideMenuUser.classList.remove("hidden");
    els.logoutBtn.classList.remove("hidden");
  }

  function handleAuthStateChange(user) {
    updateSideMenuUser(user);
    if (!user) {
      hideAllAuthOverlays();
      showAuthPanel("login");
      if (typeof onSignedOut === "function") onSignedOut();
      return;
    }
    if (!user.emailVerified) {
      showVerifyPanel(user.email);
      if (typeof onSignedOut === "function") onSignedOut();
      return;
    }
    proceedAsVerifiedUser(user);
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;
    const staySignedIn = els.loginStaySignedIn.checked;
    applyPersistence(staySignedIn).then(function () {
      return auth.signInWithEmailAndPassword(email, password);
    }).then(function (credential) {
      return refreshAuthToken(credential.user);
    }).then(function () {
      showToast("Willkommen zurück!");
    }).catch(function (error) {
      showToast(authErrorMessage(error));
    });
  }

  function handleRegisterSubmit(event) {
    event.preventDefault();
    const username = normalizeUsername(els.registerUsername.value);
    const email = els.registerEmail.value.trim();
    const password = els.registerPassword.value;
    const confirm = els.registerPasswordConfirm.value;
    const staySignedIn = els.registerStaySignedIn.checked;

    if (username.length < 2) {
      showToast("Nutzername mindestens 2 Zeichen");
      return;
    }
    if (password !== confirm) {
      showToast("Passwörter stimmen nicht überein");
      return;
    }
    if (password.length < 6) {
      showToast("Passwort mindestens 6 Zeichen");
      return;
    }

    pendingUsername = username;
    applyPersistence(staySignedIn).then(function () {
      return auth.createUserWithEmailAndPassword(email, password);
    }).then(function (credential) {
      return credential.user.updateProfile({ displayName: username }).then(function () {
        return credential.user.sendEmailVerification();
      }).then(function () {
        return saveUserProfile(credential.user, username);
      }).then(function () {
        showVerifyPanel(email);
        showToast("Konto erstellt – bitte E-Mail bestätigen");
      });
    }).catch(function (error) {
      pendingUsername = "";
      showToast(authErrorMessage(error));
    });
  }

  function handleResendVerification() {
    const user = auth.currentUser;
    if (!user) return;
    user.sendEmailVerification().then(function () {
      showToast("Bestätigungs-Mail erneut gesendet");
    }).catch(function (error) {
      showToast(authErrorMessage(error));
    });
  }

  function handleCheckVerification() {
    const user = auth.currentUser;
    if (!user) return;
    user.reload().then(function () {
      const current = auth.currentUser;
      if (current && current.emailVerified) {
        return refreshAuthToken(current).then(function () {
          showToast("E-Mail bestätigt – willkommen!");
          handleAuthStateChange(current);
        });
      }
      showToast("Noch nicht bestätigt – bitte Link in der Mail öffnen");
    }).catch(function (error) {
      showToast(authErrorMessage(error));
    });
  }

  function handleLogout() {
    return auth.signOut().then(function () {
      showToast("Abgemeldet");
    }).catch(function (error) {
      showToast(authErrorMessage(error));
    });
  }

  function bindEvents() {
    if (els.authTabLogin) {
      els.authTabLogin.addEventListener("click", function () {
        showAuthPanel("login");
      });
    }
    if (els.authTabRegister) {
      els.authTabRegister.addEventListener("click", function () {
        showAuthPanel("register");
      });
    }
    if (els.loginForm) els.loginForm.addEventListener("submit", handleLoginSubmit);
    if (els.registerForm) els.registerForm.addEventListener("submit", handleRegisterSubmit);
    if (els.resendVerificationBtn) els.resendVerificationBtn.addEventListener("click", handleResendVerification);
    if (els.checkVerificationBtn) els.checkVerificationBtn.addEventListener("click", handleCheckVerification);
    if (els.verifyLogoutBtn) els.verifyLogoutBtn.addEventListener("click", handleLogout);
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", handleLogout);
  }

  function init(firestoreDb, callbacks) {
    cacheElements();
    db = firestoreDb;
    onAuthenticated = callbacks && callbacks.onAuthenticated;
    onSignedOut = callbacks && callbacks.onSignedOut;
    auth = firebase.auth();
    bindEvents();
    auth.onAuthStateChanged(handleAuthStateChange);
  }

  function getCurrentUser() {
    return auth ? auth.currentUser : null;
  }

  function isVerified() {
    const user = getCurrentUser();
    return !!(user && user.emailVerified);
  }

  global.WGAuth = {
    init: init,
    getCurrentUser: getCurrentUser,
    isVerified: isVerified,
    logout: handleLogout,
    showLogin: function () { showAuthPanel("login"); },
  };
})(window);
