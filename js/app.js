(function () {
  "use strict";

  const ROOM_STORAGE_KEY = "einkaufsapp_room";

  const DAYS = [
    { key: "monday", label: "Montag" },
    { key: "tuesday", label: "Dienstag" },
    { key: "wednesday", label: "Mittwoch" },
    { key: "thursday", label: "Donnerstag" },
    { key: "friday", label: "Freitag" },
    { key: "saturday", label: "Samstag" },
    { key: "sunday", label: "Sonntag" },
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
    dishes: { title: "Gerichte" },
    mealplan: { title: "Wochenplan" },
  };

  let db = null;
  let roomCode = "";
  let roomRef = null;
  let unsubscribeRoom = null;
  let isRemoteUpdate = false;
  let isInitialized = false;
  let toastTimer = null;
  let pendingWrites = 0;
  let activeView = "shopping";
  let selectedDishId = null;

  let foods = [];
  let dishes = [];
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
    menuToggle: document.getElementById("menu-toggle"),
    sideMenu: document.getElementById("side-menu"),
    sideMenuOverlay: document.getElementById("side-menu-overlay"),
    shoppingList: document.getElementById("shopping-list"),
    shoppingEmpty: document.getElementById("shopping-empty"),
    foodGroups: document.getElementById("food-groups"),
    foodsEmpty: document.getElementById("foods-empty"),
    foodSearch: document.getElementById("food-search"),
    addFoodForm: document.getElementById("add-food-form"),
    newFoodName: document.getElementById("new-food-name"),
    newFoodCategory: document.getElementById("new-food-category"),
    saveFoodOnly: document.getElementById("save-food-only"),
    addDishForm: document.getElementById("add-dish-form"),
    newDishName: document.getElementById("new-dish-name"),
    newDishIngredients: document.getElementById("new-dish-ingredients"),
    dishSearch: document.getElementById("dish-search"),
    dishList: document.getElementById("dish-list"),
    dishesEmpty: document.getElementById("dishes-empty"),
    dishDetailOverlay: document.getElementById("dish-detail-overlay"),
    dishDetailTitle: document.getElementById("dish-detail-title"),
    dishDetailIngredients: document.getElementById("dish-detail-ingredients"),
    closeDishDetail: document.getElementById("close-dish-detail"),
    addDishToPlanBtn: document.getElementById("add-dish-to-plan-btn"),
    dayPickerOverlay: document.getElementById("day-picker-overlay"),
    dayPickerHint: document.getElementById("day-picker-hint"),
    dayPickerList: document.getElementById("day-picker-list"),
    closeDayPicker: document.getElementById("close-day-picker"),
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

  function parseIngredients(text) {
    return text
      .split("\n")
      .map(function (line) {
        return normalizeName(line);
      })
      .filter(Boolean);
  }

  function createDefaultFoods() {
    return DEFAULT_FOODS.map(function (item) {
      return { id: uid(), name: item.name, category: item.category };
    });
  }

  function setSyncStatus() {}

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
      showSetupOverlay(window.DEFAULT_GROUP_CODE || "FAMILIE");
      return false;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    return true;
  }

  function migrateMealPlanEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return { dishId: "", dishName: "" };
    }
    if (entry.dishId !== undefined || entry.dishName !== undefined) {
      return {
        dishId: entry.dishId || "",
        dishName: entry.dishName || "",
      };
    }
    const legacyName = entry.lunch || entry.dinner || entry.breakfast || "";
    return { dishId: "", dishName: legacyName };
  }

  function applyRemoteData(data) {
    isRemoteUpdate = true;
    if (Array.isArray(data.foods)) foods = data.foods;
    if (Array.isArray(data.dishes)) dishes = data.dishes;
    if (Array.isArray(data.shopping)) shoppingList = data.shopping;
    if (data.mealPlan && typeof data.mealPlan === "object") mealPlan = data.mealPlan;
    if (typeof data.weekOffset === "number") weekOffset = data.weekOffset;
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

    roomRef = db.collection("rooms").doc(roomCode);

    unsubscribeRoom = roomRef.onSnapshot(
      function (snapshot) {
        if (pendingWrites > 0) return;

        if (!snapshot.exists) {
          if (!isInitialized) {
            foods = createDefaultFoods();
            dishes = [];
            shoppingList = [];
            mealPlan = {};
            weekOffset = 0;
            isInitialized = true;
            persistAll();
            renderActiveView();
          }
          return;
        }

        applyRemoteData(snapshot.data());
      },
      function (error) {
        console.error(error);
        showToast("Sync-Fehler: " + error.message);
      }
    );
  }

  function persistAll() {
    if (isRemoteUpdate || !roomRef) return;

    pendingWrites += 1;
    roomRef.set(
      {
        foods: foods,
        dishes: dishes,
        shopping: shoppingList,
        mealPlan: mealPlan,
        weekOffset: weekOffset,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ).catch(function (error) {
      console.error(error);
      showToast("Konnte nicht speichern");
    }).finally(function () {
      setTimeout(function () {
        pendingWrites -= 1;
      }, 400);
    });
  }

  function findFoodByName(name) {
    const normalized = normalizeName(name).toLowerCase();
    return foods.find(function (food) {
      return food.name.toLowerCase() === normalized;
    });
  }

  function findDishById(id) {
    return dishes.find(function (dish) {
      return dish.id === id;
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
    persistAll();
    return food;
  }

  function addDish(name, ingredientsText) {
    const cleanName = normalizeName(name);
    if (!cleanName) return null;

    const dish = {
      id: uid(),
      name: cleanName,
      ingredients: parseIngredients(ingredientsText),
    };
    dishes.push(dish);
    dishes.sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    persistAll();
    return dish;
  }

  function deleteDish(id) {
    dishes = dishes.filter(function (dish) {
      return dish.id !== id;
    });

    Object.keys(mealPlan).forEach(function (weekKey) {
      DAYS.forEach(function (day) {
        const entry = mealPlan[weekKey] && mealPlan[weekKey][day.key];
        if (entry && entry.dishId === id) {
          mealPlan[weekKey][day.key] = { dishId: "", dishName: "" };
        }
      });
    });

    persistAll();
    if (selectedDishId === id) {
      closeDishDetailModal();
    }
    renderDishes();
    if (activeView === "mealplan") renderMealPlan();
    showToast("Gericht gelöscht");
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
    persistAll();
    renderShoppingList();
    showToast(food.name + " zur Einkaufsliste hinzugefügt");
    return true;
  }

  function removeShoppingItem(id) {
    shoppingList = shoppingList.filter(function (item) {
      return item.id !== id;
    });
    persistAll();
    renderShoppingList();
  }

  function toggleShoppingItem(id) {
    shoppingList = shoppingList.map(function (item) {
      if (item.id === id) {
        return Object.assign({}, item, { checked: !item.checked });
      }
      return item;
    });
    persistAll();
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
        addBtn.addEventListener("click", function (event) {
          event.stopPropagation();
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

  function renderDishes() {
    const query = els.dishSearch.value.trim().toLowerCase();
    const filtered = dishes.filter(function (dish) {
      const ingredientText = dish.ingredients.join(" ").toLowerCase();
      return dish.name.toLowerCase().includes(query) || ingredientText.includes(query);
    });

    els.dishList.innerHTML = "";

    if (filtered.length === 0) {
      els.dishesEmpty.classList.remove("hidden");
      return;
    }

    els.dishesEmpty.classList.add("hidden");

    filtered.forEach(function (dish) {
      const row = document.createElement("div");
      row.className = "dish-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");

      const info = document.createElement("div");
      info.className = "dish-row-info";
      const name = document.createElement("div");
      name.className = "item-name";
      name.textContent = dish.name;
      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = dish.ingredients.length + " Zutat(en)";
      info.appendChild(name);
      info.appendChild(meta);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-btn";
      deleteBtn.setAttribute("aria-label", dish.name + " löschen");
      deleteBtn.textContent = "✕";
      deleteBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        if (confirm('Gericht "' + dish.name + '" wirklich löschen?')) {
          deleteDish(dish.id);
        }
      });

      row.appendChild(info);
      row.appendChild(deleteBtn);
      row.addEventListener("click", function (event) {
        if (event.target === deleteBtn) return;
        openDishDetail(dish.id);
      });
      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDishDetail(dish.id);
        }
      });

      els.dishList.appendChild(row);
    });
  }

  function openDishDetail(dishId) {
    const dish = findDishById(dishId);
    if (!dish) return;

    selectedDishId = dishId;
    els.dishDetailTitle.textContent = dish.name;
    els.dishDetailIngredients.innerHTML = "";

    if (dish.ingredients.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Keine Zutaten eingetragen";
      els.dishDetailIngredients.appendChild(li);
    } else {
      dish.ingredients.forEach(function (ingredient) {
        const li = document.createElement("li");
        li.textContent = ingredient;
        els.dishDetailIngredients.appendChild(li);
      });
    }

    els.dishDetailOverlay.classList.remove("hidden");
  }

  function closeDishDetailModal() {
    els.dishDetailOverlay.classList.add("hidden");
    selectedDishId = null;
  }

  function openDayPicker() {
    const dish = findDishById(selectedDishId);
    if (!dish) return;

    const weekStart = getWeekStart(weekOffset);
    const weekKey = weekPlanKey(weekStart);

    els.dayPickerHint.textContent = '"' + dish.name + '" – an welchem Tag?';
    els.dayPickerList.innerHTML = "";

    DAYS.forEach(function (day, index) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);

      const entry = getDayEntry(weekKey, day.key);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-picker-btn";

      const label = document.createElement("span");
      label.textContent = day.label;
      const dateLabel = document.createElement("span");
      dateLabel.className = "day-date";
      dateLabel.textContent = formatDate(date);

      const current = document.createElement("span");
      current.className = "day-picker-current";
      current.textContent = entry.dishName ? entry.dishName : "Frei";

      btn.appendChild(label);
      btn.appendChild(dateLabel);
      btn.appendChild(current);

      btn.addEventListener("click", function () {
        assignDishToDay(dish, weekKey, day.key, day.label);
      });

      els.dayPickerList.appendChild(btn);
    });

    els.dayPickerOverlay.classList.remove("hidden");
  }

  function closeDayPickerModal() {
    els.dayPickerOverlay.classList.add("hidden");
  }

  function assignDishToDay(dish, weekKey, dayKey, dayLabel) {
    if (!mealPlan[weekKey]) mealPlan[weekKey] = {};
    mealPlan[weekKey][dayKey] = {
      dishId: dish.id,
      dishName: dish.name,
    };
    persistAll();
    closeDayPickerModal();
    closeDishDetailModal();
    showToast(dish.name + " für " + dayLabel + " eingeplant");
    if (activeView === "mealplan") renderMealPlan();
  }

  function clearDayEntry(weekKey, dayKey) {
    if (!mealPlan[weekKey]) return;
    mealPlan[weekKey][dayKey] = { dishId: "", dishName: "" };
    persistAll();
    renderMealPlan();
    showToast("Tag geleert");
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

  function getDayEntry(weekKey, dayKey) {
    if (!mealPlan[weekKey]) mealPlan[weekKey] = {};
    mealPlan[weekKey][dayKey] = migrateMealPlanEntry(mealPlan[weekKey][dayKey]);
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

      const entry = getDayEntry(weekKey, day.key);
      const dishBox = document.createElement("div");
      dishBox.className = "day-dish";

      if (entry.dishName) {
        const dishName = document.createElement("div");
        dishName.className = "day-dish-name";
        dishName.textContent = entry.dishName;
        dishBox.appendChild(dishName);

        const dish = entry.dishId ? findDishById(entry.dishId) : null;
        if (dish && dish.ingredients.length > 0) {
          const ingredients = document.createElement("div");
          ingredients.className = "day-dish-ingredients";
          ingredients.textContent = dish.ingredients.join(", ");
          dishBox.appendChild(ingredients);
        }

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "btn btn-secondary btn-small";
        clearBtn.textContent = "Entfernen";
        clearBtn.addEventListener("click", function () {
          clearDayEntry(weekKey, day.key);
        });
        dishBox.appendChild(clearBtn);
      } else {
        const empty = document.createElement("div");
        empty.className = "day-dish-empty";
        empty.textContent = "Kein Gericht geplant";
        dishBox.appendChild(empty);
      }

      card.appendChild(dishBox);
      els.mealPlanEl.appendChild(card);
    });
  }

  function renderActiveView() {
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "foods") renderFoods();
    if (activeView === "dishes") renderDishes();
    if (activeView === "mealplan") renderMealPlan();
  }

  function openMenu() {
    els.sideMenu.classList.add("open");
    els.sideMenuOverlay.classList.remove("hidden");
    els.menuToggle.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    els.sideMenu.classList.remove("open");
    els.sideMenuOverlay.classList.add("hidden");
    els.menuToggle.setAttribute("aria-expanded", "false");
  }

  function switchView(viewName) {
    activeView = viewName;
    closeMenu();

    document.querySelectorAll(".view").forEach(function (view) {
      view.classList.remove("active");
    });
    document.getElementById("view-" + viewName).classList.add("active");

    document.querySelectorAll(".menu-btn").forEach(function (btn) {
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

  function handleAddDish(event) {
    event.preventDefault();

    if (!roomRef) {
      showToast("Bitte zuerst der Gruppe beitreten");
      return;
    }

    const name = els.newDishName.value;
    const ingredients = els.newDishIngredients.value;

    if (!normalizeName(name)) {
      showToast("Bitte einen Gerichtnamen eingeben");
      return;
    }

    const dish = addDish(name, ingredients);
    els.newDishName.value = "";
    els.newDishIngredients.value = "";
    renderDishes();
    showToast('Gericht "' + dish.name + '" gespeichert');
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
    els.menuToggle.addEventListener("click", function () {
      if (els.sideMenu.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    els.sideMenuOverlay.addEventListener("click", closeMenu);

    document.querySelectorAll(".menu-btn").forEach(function (btn) {
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

    els.addDishForm.addEventListener("submit", handleAddDish);

    els.foodSearch.addEventListener("input", renderFoods);
    els.dishSearch.addEventListener("input", renderDishes);

    document.getElementById("clear-checked").addEventListener("click", function () {
      shoppingList = shoppingList.filter(function (item) {
        return !item.checked;
      });
      persistAll();
      renderShoppingList();
      showToast("Erledigte Artikel entfernt");
    });

    document.getElementById("clear-all").addEventListener("click", function () {
      if (shoppingList.length === 0) return;
      if (confirm("Gesamte Einkaufsliste leeren?")) {
        shoppingList = [];
        persistAll();
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

    els.closeDishDetail.addEventListener("click", closeDishDetailModal);
    els.addDishToPlanBtn.addEventListener("click", openDayPicker);
    els.closeDayPicker.addEventListener("click", closeDayPickerModal);

    els.dishDetailOverlay.addEventListener("click", function (event) {
      if (event.target === els.dishDetailOverlay) closeDishDetailModal();
    });

    els.dayPickerOverlay.addEventListener("click", function (event) {
      if (event.target === els.dayPickerOverlay) closeDayPickerModal();
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
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  startApp();
})();
