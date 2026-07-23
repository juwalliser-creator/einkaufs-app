(function () {
  "use strict";

  const ROOM_STORAGE_KEY = "einkaufsapp_room";
  const MEAL_PLAN_DEBOUNCE_MS = 450;

  const DAYS = [
    { key: "monday", label: "Montag" },
    { key: "tuesday", label: "Dienstag" },
    { key: "wednesday", label: "Mittwoch" },
    { key: "thursday", label: "Donnerstag" },
    { key: "friday", label: "Freitag" },
    { key: "saturday", label: "Samstag" },
    { key: "sunday", label: "Sonntag" },
  ];

  const MEALS = [
    { key: "breakfast", label: "Frühstück" },
    { key: "lunch", label: "Mittagessen" },
    { key: "dinner", label: "Abendessen" },
  ];

  const DEFAULT_FOODS = [
    { name: "Milch", category: "Milchprodukte" },
    { name: "Butter", category: "Milchprodukte" },
    { name: "Joghurt", category: "Milchprodukte" },
    { name: "Käse", category: "Milchprodukte" },
    { name: "Eier", category: "Milchprodukte" },
    { name: "Brot", category: "Backwaren" },
    { name: "Brötchen", category: "Backwaren" },
    { name: "Nudeln", category: "Vorrat" },
    { name: "Reis", category: "Vorrat" },
    { name: "Mehl", category: "Vorrat" },
    { name: "Zucker", category: "Vorrat" },
    { name: "Salz", category: "Vorrat" },
    { name: "Pfeffer", category: "Vorrat" },
    { name: "Olivenöl", category: "Vorrat" },
    { name: "Tomaten", category: "Obst & Gemüse" },
    { name: "Gurke", category: "Obst & Gemüse" },
    { name: "Paprika", category: "Obst & Gemüse" },
    { name: "Zwiebeln", category: "Obst & Gemüse" },
    { name: "Knoblauch", category: "Obst & Gemüse" },
    { name: "Kartoffeln", category: "Obst & Gemüse" },
    { name: "Salat", category: "Obst & Gemüse" },
    { name: "Äpfel", category: "Obst & Gemüse" },
    { name: "Bananen", category: "Obst & Gemüse" },
    { name: "Hähnchenbrust", category: "Fleisch & Fisch" },
    { name: "Rinderhack", category: "Fleisch & Fisch" },
    { name: "Lachs", category: "Fleisch & Fisch" },
    { name: "Wasser", category: "Getränke" },
    { name: "Saft", category: "Getränke" },
    { name: "Kaffee", category: "Getränke" },
  ];

  const VIEW_META = {
    shopping: { title: "Einkaufsliste" },
    foods: { title: "Lebensmittel" },
    mealplan: { title: "Wochenplan" },
  };

  let db = null;
  let roomCode = "";
  let roomRef = null;
  let unsubscribeRoom = null;
  let isRemoteUpdate = false;
  let isInitialized = false;
  let mealPlanTimer = null;
  let toastTimer = null;
  let activeView = "shopping";

  let foods = [];
  let shoppingList = [];
  let mealPlan = {};
  let weekOffset = 0;

  const els = {
    pageTitle: document.getElementById("page-title"),
    setupOverlay: document.getElementById("setup-overlay"),
    roomCodeInput: document.getElementById("room-code-input"),
    joinRoomBtn: document.getElementById("join-room-btn"),
    createRoomBtn: document.getElementById("create-room-btn"),
    shareLinkBtn: document.getElementById("share-link-btn"),
    shoppingList: document.getElementById("shopping-list"),
    shoppingEmpty: document.getElementById("shopping-empty"),
    foodGroups: document.getElementById("food-groups"),
    foodsEmpty: document.getElementById("foods-empty"),
    foodSearch: document.getElementById("food-search"),
    addFoodForm: document.getElementById("add-food-form"),
    newFoodName: document.getElementById("new-food-name"),
    newFoodCategory: document.getElementById("new-food-category"),
    saveFoodOnly: document.getElementById("save-food-only"),
    mealPlanEl: document.getElementById("meal-plan"),
    weekLabel: document.getElementById("week-label"),
    toast: document.getElementById("toast"),
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2200);
  }

  function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ");
  }

  function normalizeRoomCode(code) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
  }

  function createDefaultFoods() {
    return DEFAULT_FOODS.map(function (item) {
      return { id: uid(), name: item.name, category: item.category };
    });
  }

  function setSyncStatus() {
    /* Sync-Status wird nicht mehr im Header angezeigt */
  }

  function firebaseConfigured() {
    const config = window.FIREBASE_CONFIG || {};
    return (
      config.apiKey &&
      config.apiKey !== "HIER_DEIN_API_KEY" &&
      config.projectId &&
      config.projectId !== "HIER_DEIN_PROJECT_ID"
    );
  }

  function getRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeRoomCode(params.get("gruppe") || "");
  }

  function getStoredRoom() {
    return normalizeRoomCode(localStorage.getItem(ROOM_STORAGE_KEY) || "");
  }

  function saveRoom(code) {
    roomCode = normalizeRoomCode(code);
    localStorage.setItem(ROOM_STORAGE_KEY, roomCode);
    const url = new URL(window.location.href);
    url.searchParams.set("gruppe", roomCode);
    window.history.replaceState({}, "", url.toString());
  }

  function getShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("gruppe", roomCode);
    return url.toString();
  }

  function hideSetupOverlay() {
    els.setupOverlay.classList.add("hidden");
  }

  function showSetupOverlay(defaultCode) {
    els.roomCodeInput.value = defaultCode || getStoredRoom() || window.DEFAULT_GROUP_CODE || "FAMILIE";
    els.setupOverlay.classList.remove("hidden");
  }

  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function initFirebase() {
    if (!firebaseConfigured()) {
      setSyncStatus("Firebase nicht eingerichtet – siehe FIREBASE-SETUP.md", "error");
      showSetupOverlay(window.DEFAULT_GROUP_CODE || "FAMILIE");
      return false;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    return true;
  }

  function applyRemoteData(data) {
    isRemoteUpdate = true;
    foods = Array.isArray(data.foods) ? data.foods : [];
    shoppingList = Array.isArray(data.shopping) ? data.shopping : [];
    mealPlan = data.mealPlan && typeof data.mealPlan === "object" ? data.mealPlan : {};
    weekOffset = typeof data.weekOffset === "number" ? data.weekOffset : 0;
    isRemoteUpdate = false;
    isInitialized = true;
    renderActiveView();
  }

  function connectToRoom(code) {
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      showToast("Bitte einen Gruppencode eingeben");
      return;
    }

    if (!initFirebase()) {
      showToast("Firebase zuerst einrichten (FIREBASE-SETUP.md)");
      return;
    }

    if (unsubscribeRoom) {
      unsubscribeRoom();
      unsubscribeRoom = null;
    }

    saveRoom(normalized);
    hideSetupOverlay();
    setSyncStatus("Verbinde mit Gruppe " + roomCode + "…", "");

    roomRef = db.collection("rooms").doc(roomCode);

    unsubscribeRoom = roomRef.onSnapshot(
      function (snapshot) {
        if (!snapshot.exists) {
          if (!isInitialized) {
            foods = createDefaultFoods();
            shoppingList = [];
            mealPlan = {};
            weekOffset = 0;
            isInitialized = true;
            persistAll();
            renderActiveView();
          }
          setSyncStatus("Gruppe " + roomCode + " – verbunden", "online");
          return;
        }

        applyRemoteData(snapshot.data());
        setSyncStatus("Gruppe " + roomCode + " – live synchronisiert", "online");
      },
      function (error) {
        console.error(error);
        setSyncStatus("Verbindungsfehler – Internet prüfen", "error");
        showToast("Sync-Fehler: " + error.message);
      }
    );
  }

  function persistAll() {
    if (isRemoteUpdate || !roomRef) return;

    roomRef.set(
      {
        foods: foods,
        shopping: shoppingList,
        mealPlan: mealPlan,
        weekOffset: weekOffset,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ).catch(function (error) {
      console.error(error);
      setSyncStatus("Speichern fehlgeschlagen", "error");
      showToast("Konnte nicht speichern");
    });
  }

  function persistFoods() {
    persistAll();
  }

  function persistShopping() {
    persistAll();
  }

  function persistMealPlanDebounced() {
    clearTimeout(mealPlanTimer);
    mealPlanTimer = setTimeout(persistAll, MEAL_PLAN_DEBOUNCE_MS);
  }

  function findFoodByName(name) {
    const normalized = normalizeName(name).toLowerCase();
    return foods.find(function (food) {
      return food.name.toLowerCase() === normalized;
    });
  }

  function addFoodToDatabase(name, category) {
    const cleanName = normalizeName(name);
    if (!cleanName) return null;

    const existing = findFoodByName(cleanName);
    if (existing) return existing;

    const food = { id: uid(), name: cleanName, category: category || "Sonstiges" };
    foods.push(food);
    foods.sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    persistFoods();
    return food;
  }

  function addToShoppingList(food) {
    const alreadyOnList = shoppingList.some(function (item) {
      return !item.checked && item.foodId === food.id;
    });

    if (alreadyOnList) {
      showToast(food.name + " ist bereits auf der Liste");
      return false;
    }

    shoppingList.unshift({
      id: uid(),
      foodId: food.id,
      name: food.name,
      checked: false,
      addedAt: Date.now(),
    });
    persistShopping();
    renderShoppingList();
    showToast(food.name + " zur Einkaufsliste hinzugefügt");
    return true;
  }

  function removeShoppingItem(id) {
    shoppingList = shoppingList.filter(function (item) {
      return item.id !== id;
    });
    persistShopping();
    renderShoppingList();
  }

  function toggleShoppingItem(id) {
    shoppingList = shoppingList.map(function (item) {
      if (item.id === id) {
        return Object.assign({}, item, { checked: !item.checked });
      }
      return item;
    });
    persistShopping();
    renderShoppingList();
  }

  function renderShoppingList() {
    els.shoppingList.innerHTML = "";

    if (shoppingList.length === 0) {
      els.shoppingEmpty.classList.remove("hidden");
      return;
    }

    els.shoppingEmpty.classList.add("hidden");

    shoppingList.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "item-row" + (item.checked ? " checked" : "");

      const checkboxWrap = document.createElement("label");
      checkboxWrap.className = "checkbox-wrap";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.checked;
      checkbox.addEventListener("change", function () {
        toggleShoppingItem(item.id);
      });
      checkboxWrap.appendChild(checkbox);

      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = item.name;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "icon-btn";
      removeBtn.setAttribute("aria-label", item.name + " entfernen");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () {
        removeShoppingItem(item.id);
      });

      li.appendChild(checkboxWrap);
      li.appendChild(name);
      li.appendChild(removeBtn);
      els.shoppingList.appendChild(li);
    });
  }

  function renderFoods() {
    const query = els.foodSearch.value.trim().toLowerCase();
    const filtered = foods.filter(function (food) {
      return (
        food.name.toLowerCase().includes(query) ||
        food.category.toLowerCase().includes(query)
      );
    });

    const grouped = {};
    filtered.forEach(function (food) {
      if (!grouped[food.category]) grouped[food.category] = [];
      grouped[food.category].push(food);
    });

    els.foodGroups.innerHTML = "";
    const categories = Object.keys(grouped).sort(function (a, b) {
      return a.localeCompare(b, "de");
    });

    if (categories.length === 0) {
      els.foodsEmpty.classList.remove("hidden");
      return;
    }

    els.foodsEmpty.classList.add("hidden");

    categories.forEach(function (category) {
      const section = document.createElement("section");
      section.className = "food-group";

      const heading = document.createElement("h3");
      heading.textContent = category;
      section.appendChild(heading);

      const list = document.createElement("div");
      list.className = "food-group-list";

      grouped[category].forEach(function (food) {
        const row = document.createElement("div");
        row.className = "food-row";

        const info = document.createElement("div");
        info.style.flex = "1";
        const name = document.createElement("div");
        name.className = "item-name";
        name.textContent = food.name;
        info.appendChild(name);

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn-add";
        addBtn.setAttribute("aria-label", food.name + " zur Liste hinzufügen");
        addBtn.textContent = "+";
        addBtn.addEventListener("click", function () {
          addToShoppingList(food);
        });

        row.appendChild(info);
        row.appendChild(addBtn);
        list.appendChild(row);
      });

      section.appendChild(list);
      els.foodGroups.appendChild(section);
    });
  }

  function getWeekStart(offset) {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + diffToMonday + offset * 7);
    return monday;
  }

  function formatDate(date) {
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  function weekPlanKey(weekStart) {
    return weekStart.toISOString().slice(0, 10);
  }

  function getDayPlan(weekKey, dayKey) {
    if (!mealPlan[weekKey]) mealPlan[weekKey] = {};
    if (!mealPlan[weekKey][dayKey]) {
      mealPlan[weekKey][dayKey] = { breakfast: "", lunch: "", dinner: "" };
    }
    return mealPlan[weekKey][dayKey];
  }

  function renderMealPlan() {
    const weekStart = getWeekStart(weekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekKey = weekPlanKey(weekStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (weekOffset === 0) {
      els.weekLabel.textContent = "Diese Woche";
    } else if (weekOffset === 1) {
      els.weekLabel.textContent = "Nächste Woche";
    } else if (weekOffset === -1) {
      els.weekLabel.textContent = "Letzte Woche";
    } else {
      els.weekLabel.textContent = formatDate(weekStart) + " – " + formatDate(weekEnd);
    }

    els.mealPlanEl.innerHTML = "";

    DAYS.forEach(function (day, index) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);

      const card = document.createElement("article");
      card.className = "day-card";
      if (date.getTime() === today.getTime()) {
        card.classList.add("is-today");
      }

      const header = document.createElement("div");
      header.className = "day-header";
      const title = document.createElement("h3");
      title.textContent = day.label;
      const dateLabel = document.createElement("span");
      dateLabel.className = "day-date";
      dateLabel.textContent = formatDate(date);
      header.appendChild(title);
      header.appendChild(dateLabel);
      card.appendChild(header);

      const dayPlan = getDayPlan(weekKey, day.key);

      MEALS.forEach(function (meal) {
        const field = document.createElement("div");
        field.className = "meal-field";

        const label = document.createElement("label");
        label.textContent = meal.label;
        label.setAttribute("for", weekKey + "-" + day.key + "-" + meal.key);

        const textarea = document.createElement("textarea");
        textarea.id = weekKey + "-" + day.key + "-" + meal.key;
        textarea.placeholder = "z.B. Pasta mit Tomatensauce";
        textarea.value = dayPlan[meal.key] || "";
        textarea.addEventListener("input", function () {
          dayPlan[meal.key] = textarea.value;
          persistMealPlanDebounced();
        });

        field.appendChild(label);
        field.appendChild(textarea);
        card.appendChild(field);
      });

      els.mealPlanEl.appendChild(card);
    });
  }

  function renderActiveView() {
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "foods") renderFoods();
    if (activeView === "mealplan") renderMealPlan();
  }

  function switchView(viewName) {
    activeView = viewName;

    document.querySelectorAll(".view").forEach(function (view) {
      view.classList.remove("active");
    });
    document.getElementById("view-" + viewName).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      const isActive = btn.dataset.view === viewName;
      btn.classList.toggle("active", isActive);
      if (isActive) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    els.pageTitle.textContent = VIEW_META[viewName].title;
    renderActiveView();
  }

  function handleAddFood(addToList) {
    const name = els.newFoodName.value;
    const category = els.newFoodCategory.value;

    if (!normalizeName(name)) {
      showToast("Bitte einen Namen eingeben");
      return;
    }

    const food = addFoodToDatabase(name, category);
    els.newFoodName.value = "";
    renderFoods();

    if (addToList) {
      addToShoppingList(food);
    } else {
      showToast(food.name + " in Datenbank gespeichert");
    }
  }

  async function shareAppLink() {
    const url = getShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Einkaufs-App",
          text: "Tritt unserer gemeinsamen Einkaufsliste bei:",
          url: url,
        });
        return;
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link kopiert – an deinen Bruder schicken!");
    } catch {
      prompt("Link kopieren und per WhatsApp schicken:", url);
    }
  }

  function bindEvents() {
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.dataset.view);
      });
    });

    els.addFoodForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleAddFood(true);
    });

    els.saveFoodOnly.addEventListener("click", function () {
      handleAddFood(false);
    });

    els.foodSearch.addEventListener("input", renderFoods);

    document.getElementById("clear-checked").addEventListener("click", function () {
      shoppingList = shoppingList.filter(function (item) {
        return !item.checked;
      });
      persistShopping();
      renderShoppingList();
      showToast("Erledigte Artikel entfernt");
    });

    document.getElementById("clear-all").addEventListener("click", function () {
      if (shoppingList.length === 0) return;
      if (confirm("Gesamte Einkaufsliste leeren?")) {
        shoppingList = [];
        persistShopping();
        renderShoppingList();
        showToast("Einkaufsliste geleert");
      }
    });

    document.getElementById("prev-week").addEventListener("click", function () {
      weekOffset -= 1;
      persistAll();
      renderMealPlan();
    });

    document.getElementById("next-week").addEventListener("click", function () {
      weekOffset += 1;
      persistAll();
      renderMealPlan();
    });

    els.joinRoomBtn.addEventListener("click", function () {
      connectToRoom(els.roomCodeInput.value);
    });

    els.createRoomBtn.addEventListener("click", function () {
      els.roomCodeInput.value = generateRoomCode();
    });

    els.shareLinkBtn.addEventListener("click", shareAppLink);
  }

  function startApp() {
    bindEvents();
    switchView("shopping");

    if (!initFirebase()) {
      showSetupOverlay(window.DEFAULT_GROUP_CODE || "FAMILIE");
      return;
    }

    const urlRoom = getRoomFromUrl();
    const storedRoom = getStoredRoom();
    const defaultRoom = window.DEFAULT_GROUP_CODE || "FAMILIE";

    if (urlRoom) {
      connectToRoom(urlRoom);
      return;
    }

    if (storedRoom) {
      connectToRoom(storedRoom);
      return;
    }

    showSetupOverlay(defaultRoom);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* optional */
      });
    });
  }

  startApp();
})();
