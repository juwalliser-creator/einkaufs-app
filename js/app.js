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

  const DIET_LABELS = { meat: "Fleisch", vegetarian: "Vegetarisch" };
  const TEMP_LABELS = { warm: "Warm", cold: "Kalt" };

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
  let weeklyShopping = {};
  let mealPlan = {};
  let weekOffset = 0;

  let dishFilter = { diet: null, temp: null };

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
    shoppingWeekLabel: document.getElementById("shopping-week-label"),
    foodGroups: document.getElementById("food-groups"),
    foodsEmpty: document.getElementById("foods-empty"),
    foodSearch: document.getElementById("food-search"),
    addFoodForm: document.getElementById("add-food-form"),
    newFoodName: document.getElementById("new-food-name"),
    newFoodCategory: document.getElementById("new-food-category"),
    openAddDishBtn: document.getElementById("open-add-dish-btn"),
    dishAddOverlay: document.getElementById("dish-add-overlay"),
    closeDishAdd: document.getElementById("close-dish-add"),
    addDishForm: document.getElementById("add-dish-form"),
    newDishName: document.getElementById("new-dish-name"),
    newDishIngredients: document.getElementById("new-dish-ingredients"),
    dishSearch: document.getElementById("dish-search"),
    dishList: document.getElementById("dish-list"),
    dishesEmpty: document.getElementById("dishes-empty"),
    dishDetailOverlay: document.getElementById("dish-detail-overlay"),
    dishDetailTitle: document.getElementById("dish-detail-title"),
    dishDetailMeta: document.getElementById("dish-detail-meta"),
    dishDetailIngredients: document.getElementById("dish-detail-ingredients"),
    closeDishDetail: document.getElementById("close-dish-detail"),
    editDishBtn: document.getElementById("edit-dish-btn"),
    addDishToPlanBtn: document.getElementById("add-dish-to-plan-btn"),
    dishEditOverlay: document.getElementById("dish-edit-overlay"),
    editDishForm: document.getElementById("edit-dish-form"),
    editDishName: document.getElementById("edit-dish-name"),
    editDishIngredients: document.getElementById("edit-dish-ingredients"),
    closeDishEdit: document.getElementById("close-dish-edit"),
    cancelDishEdit: document.getElementById("cancel-dish-edit"),
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
    return text.split("\n").map(normalizeName).filter(Boolean);
  }

  function migrateDish(dish) {
    if (!dish || typeof dish !== "object") return null;
    return {
      id: dish.id || uid(),
      name: dish.name || "",
      ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : [],
      diet: dish.diet === "meat" ? "meat" : "vegetarian",
      temp: dish.temp === "cold" ? "cold" : "warm",
    };
  }

  function dishCategoryLabel(dish) {
    return DIET_LABELS[dish.diet] + " · " + TEMP_LABELS[dish.temp];
  }

  function getRadioValue(name) {
    const selected = document.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : null;
  }

  function setRadioValue(name, value) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.checked = input.value === value;
    });
  }

  function createDefaultFoods() {
    return DEFAULT_FOODS.map(function (item) {
      return { id: uid(), name: item.name, category: item.category };
    });
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
    return normalizeRoomCode(new URLSearchParams(window.location.search).get("gruppe") || "");
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
    for (let i = 0; i < 6; i += 1) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  function initFirebase() {
    if (!firebaseConfigured()) {
      showSetupOverlay(window.DEFAULT_GROUP_CODE || "FAMILIE");
      return false;
    }
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.firestore();
    return true;
  }

  function migrateMealPlanEntry(entry) {
    if (!entry || typeof entry !== "object") return { dishId: "", dishName: "" };
    if (entry.dishId !== undefined || entry.dishName !== undefined) {
      return { dishId: entry.dishId || "", dishName: entry.dishName || "" };
    }
    return { dishId: "", dishName: entry.lunch || entry.dinner || entry.breakfast || "" };
  }

  function applyRemoteData(data) {
    isRemoteUpdate = true;
    if (Array.isArray(data.foods)) foods = data.foods;
    if (Array.isArray(data.dishes)) {
      dishes = data.dishes.map(migrateDish).filter(Boolean);
    }
    if (data.weeklyShopping && typeof data.weeklyShopping === "object") {
      weeklyShopping = data.weeklyShopping;
    }
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
            weeklyShopping = {};
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
        weeklyShopping: weeklyShopping,
        mealPlan: mealPlan,
        weekOffset: weekOffset,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ).catch(function () {
      showToast("Konnte nicht speichern");
    }).finally(function () {
      setTimeout(function () {
        pendingWrites -= 1;
      }, 400);
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
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  function weekPlanKey(weekStart) {
    return weekStart.toISOString().slice(0, 10);
  }

  function getWeekLabelText() {
    const weekStart = getWeekStart(weekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekOffset === 0) return "Diese Woche";
    if (weekOffset === 1) return "Nächste Woche";
    if (weekOffset === -1) return "Letzte Woche";
    return formatDate(weekStart) + " – " + formatDate(weekEnd);
  }

  function changeWeekOffset(delta) {
    weekOffset += delta;
    persistAll();
    renderActiveView();
  }

  function getWeeklyList(weekKey) {
    if (!weeklyShopping[weekKey]) weeklyShopping[weekKey] = [];
    return weeklyShopping[weekKey];
  }

  function findFoodByName(name) {
    const n = normalizeName(name).toLowerCase();
    return foods.find(function (f) {
      return f.name.toLowerCase() === n;
    });
  }

  function findDishById(id) {
    return dishes.find(function (d) {
      return d.id === id;
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

  function addDish(name, ingredientsText, diet, temp) {
    const cleanName = normalizeName(name);
    if (!cleanName || !diet || !temp) return null;
    const dish = {
      id: uid(),
      name: cleanName,
      ingredients: parseIngredients(ingredientsText),
      diet: diet,
      temp: temp,
    };
    dishes.push(dish);
    dishes.sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    persistAll();
    return dish;
  }

  function updateDish(id, name, ingredientsText, diet, temp) {
    const cleanName = normalizeName(name);
    if (!cleanName || !diet || !temp) return null;
    const dish = findDishById(id);
    if (!dish) return null;
    dish.name = cleanName;
    dish.ingredients = parseIngredients(ingredientsText);
    dish.diet = diet;
    dish.temp = temp;
    dishes.sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    Object.keys(mealPlan).forEach(function (weekKey) {
      DAYS.forEach(function (day) {
        const entry = mealPlan[weekKey] && mealPlan[weekKey][day.key];
        if (entry && entry.dishId === id) entry.dishName = cleanName;
      });
    });
    Object.keys(weeklyShopping).forEach(function (weekKey) {
      getWeeklyList(weekKey).forEach(function (item) {
        if (item.source === "mealplan" && item.dishId === id) item.dishName = cleanName;
      });
    });
    persistAll();
    return dish;
  }

  function deleteDish(id) {
    dishes = dishes.filter(function (d) {
      return d.id !== id;
    });
    Object.keys(mealPlan).forEach(function (weekKey) {
      DAYS.forEach(function (day) {
        const entry = mealPlan[weekKey] && mealPlan[weekKey][day.key];
        if (entry && entry.dishId === id) {
          removeMealPlanIngredientsFromWeeklyList(weekKey, id, day.key);
          mealPlan[weekKey][day.key] = { dishId: "", dishName: "" };
        }
      });
    });
    persistAll();
    if (selectedDishId === id) closeDishDetailModal();
    renderDishes();
    if (activeView === "mealplan") renderMealPlan();
    if (activeView === "shopping") renderShoppingList();
    showToast("Gericht gelöscht");
  }

  function addFoodToWeeklyList(food) {
    const weekKey = weekPlanKey(getWeekStart(weekOffset));
    const list = getWeeklyList(weekKey);
    const exists = list.some(function (item) {
      return !item.checked && item.foodId === food.id;
    });
    if (exists) {
      showToast(food.name + " ist bereits auf der Liste");
      return false;
    }
    list.unshift({
      id: uid(),
      foodId: food.id,
      name: food.name,
      checked: false,
      addedAt: Date.now(),
      source: "manual",
    });
    persistAll();
    renderShoppingList();
    showToast(food.name + " zur Einkaufsliste hinzugefügt");
    return true;
  }

  function addIngredientToWeeklyList(weekKey, ingredientName, dishId, dishName, dayKey, dayLabel) {
    const clean = normalizeName(ingredientName);
    if (!clean || !dishId || !dayKey) return false;
    const list = getWeeklyList(weekKey);
    const exists = list.some(function (item) {
      return (
        !item.checked &&
        item.source === "mealplan" &&
        item.dishId === dishId &&
        item.dayKey === dayKey &&
        item.name.toLowerCase() === clean.toLowerCase()
      );
    });
    if (exists) return false;
    list.push({
      id: uid(),
      name: clean,
      checked: false,
      addedAt: Date.now(),
      source: "mealplan",
      dishId: dishId,
      dishName: dishName,
      dayKey: dayKey,
      dayLabel: dayLabel,
    });
    return true;
  }

  function removeMealPlanIngredientsFromWeeklyList(weekKey, dishId, dayKey) {
    if (!dishId || !dayKey) return;
    weeklyShopping[weekKey] = getWeeklyList(weekKey).filter(function (item) {
      if (item.source !== "mealplan") return true;
      if (!item.dishId || !item.dayKey) return true;
      return !(item.dishId === dishId && item.dayKey === dayKey);
    });
  }

  function syncDishIngredientsToWeeklyList(dish, weekKey, dayKey, dayLabel) {
    let added = 0;
    dish.ingredients.forEach(function (ingredient) {
      if (addIngredientToWeeklyList(weekKey, ingredient, dish.id, dish.name, dayKey, dayLabel)) {
        added += 1;
      }
    });
    return added;
  }

  function shoppingItemDisplayName(item) {
    if (item.source === "mealplan" && item.dishName && item.dayLabel) {
      return item.name + " (" + item.dishName + ", " + item.dayLabel + ")";
    }
    return item.name;
  }

  function sortShoppingItems(items) {
    return items.slice().sort(function (a, b) {
      const nameCmp = a.name.localeCompare(b.name, "de", { sensitivity: "base" });
      if (nameCmp !== 0) return nameCmp;
      const dishCmp = (a.dishName || "").localeCompare(b.dishName || "", "de", { sensitivity: "base" });
      if (dishCmp !== 0) return dishCmp;
      return (a.dayLabel || "").localeCompare(b.dayLabel || "", "de", { sensitivity: "base" });
    });
  }

  function renderShoppingItems(container, emptyEl, items, onToggle, onRemove) {
    container.innerHTML = "";
    if (items.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    items.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "item-row" + (item.checked ? " checked" : "");
      const checkboxWrap = document.createElement("label");
      checkboxWrap.className = "checkbox-wrap";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.checked;
      checkbox.addEventListener("change", function () {
        onToggle(item.id);
      });
      checkboxWrap.appendChild(checkbox);
      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = shoppingItemDisplayName(item);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "icon-btn";
      removeBtn.setAttribute("aria-label", shoppingItemDisplayName(item) + " entfernen");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () {
        onRemove(item.id);
      });
      li.appendChild(checkboxWrap);
      li.appendChild(name);
      li.appendChild(removeBtn);
      container.appendChild(li);
    });
  }

  function renderShoppingList() {
    const weekKey = weekPlanKey(getWeekStart(weekOffset));
    els.shoppingWeekLabel.textContent = getWeekLabelText();

    renderShoppingItems(
      els.shoppingList,
      els.shoppingEmpty,
      sortShoppingItems(getWeeklyList(weekKey)),
      function (id) {
        getWeeklyList(weekKey).forEach(function (item) {
          if (item.id === id) item.checked = !item.checked;
        });
        persistAll();
        renderShoppingList();
      },
      function (id) {
        weeklyShopping[weekKey] = getWeeklyList(weekKey).filter(function (item) {
          return item.id !== id;
        });
        persistAll();
        renderShoppingList();
      }
    );
  }

  function renderFoods() {
    const query = els.foodSearch.value.trim().toLowerCase();
    const filtered = foods.filter(function (food) {
      return food.name.toLowerCase().includes(query) || food.category.toLowerCase().includes(query);
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
        addBtn.textContent = "+";
        addBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          addFoodToWeeklyList(food);
        });
        row.appendChild(info);
        row.appendChild(addBtn);
        list.appendChild(row);
      });
      section.appendChild(list);
      els.foodGroups.appendChild(section);
    });
  }

  function dishMatchesFilter(dish) {
    if (dishFilter.diet && dish.diet !== dishFilter.diet) return false;
    if (dishFilter.temp && dish.temp !== dishFilter.temp) return false;
    return true;
  }

  function updateFilterButtons() {
    document.querySelectorAll(".filter-btn").forEach(function (btn) {
      const type = btn.dataset.filter;
      const value = btn.dataset.value;
      btn.classList.toggle("active", dishFilter[type] === value);
    });
  }

  function renderDishes() {
    updateFilterButtons();
    const query = els.dishSearch.value.trim().toLowerCase();
    const filtered = dishes.filter(function (dish) {
      if (!dishMatchesFilter(dish)) return false;
      const ing = dish.ingredients.join(" ").toLowerCase();
      return dish.name.toLowerCase().includes(query) || ing.includes(query);
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
      meta.textContent = dishCategoryLabel(dish) + " · " + dish.ingredients.length + " Zutat(en)";
      info.appendChild(name);
      info.appendChild(meta);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openDishEdit(dish.id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (confirm('Gericht "' + dish.name + '" wirklich löschen?')) deleteDish(dish.id);
      });

      row.appendChild(info);
      row.appendChild(editBtn);
      row.appendChild(deleteBtn);
      row.addEventListener("click", function (e) {
        if (e.target === deleteBtn || e.target === editBtn) return;
        openDishDetail(dish.id);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDishDetail(dish.id);
        }
      });
      els.dishList.appendChild(row);
    });
  }

  function openDishAddModal() {
    els.addDishForm.reset();
    els.dishAddOverlay.classList.remove("hidden");
  }

  function closeDishAddModal() {
    els.dishAddOverlay.classList.add("hidden");
    els.addDishForm.reset();
  }

  function openDishDetail(dishId) {
    const dish = findDishById(dishId);
    if (!dish) return;
    selectedDishId = dishId;
    els.dishDetailTitle.textContent = dish.name;
    els.dishDetailMeta.textContent = dishCategoryLabel(dish);
    els.dishDetailIngredients.innerHTML = "";
    if (dish.ingredients.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Keine Zutaten eingetragen";
      els.dishDetailIngredients.appendChild(li);
    } else {
      dish.ingredients.forEach(function (ing) {
        const li = document.createElement("li");
        li.textContent = ing;
        els.dishDetailIngredients.appendChild(li);
      });
    }
    els.dishDetailOverlay.classList.remove("hidden");
  }

  function closeDishDetailModal() {
    els.dishDetailOverlay.classList.add("hidden");
    selectedDishId = null;
  }

  function openDishEdit(dishId) {
    const dish = findDishById(dishId);
    if (!dish) return;
    selectedDishId = dishId;
    els.editDishName.value = dish.name;
    els.editDishIngredients.value = dish.ingredients.join("\n");
    setRadioValue("edit-dish-diet", dish.diet);
    setRadioValue("edit-dish-temp", dish.temp);
    els.dishDetailOverlay.classList.add("hidden");
    els.dishEditOverlay.classList.remove("hidden");
  }

  function closeDishEditModal() {
    els.dishEditOverlay.classList.add("hidden");
    els.editDishForm.reset();
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
      current.textContent = entry.dishName || "Frei";
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
    const previous = getDayEntry(weekKey, dayKey);
    if (previous.dishId) {
      removeMealPlanIngredientsFromWeeklyList(weekKey, previous.dishId, dayKey);
    }
    mealPlan[weekKey][dayKey] = { dishId: dish.id, dishName: dish.name };
    const added = syncDishIngredientsToWeeklyList(dish, weekKey, dayKey, dayLabel);
    persistAll();
    closeDayPickerModal();
    closeDishDetailModal();
    let msg = dish.name + " für " + dayLabel + " eingeplant";
    if (added > 0) msg += " – " + added + " Zutat(en) auf Einkaufsliste";
    showToast(msg);
    if (activeView === "mealplan") renderMealPlan();
    if (activeView === "shopping") renderShoppingList();
  }

  function clearDayEntry(weekKey, dayKey) {
    if (!mealPlan[weekKey]) return;
    const entry = getDayEntry(weekKey, dayKey);
    if (entry.dishId) {
      removeMealPlanIngredientsFromWeeklyList(weekKey, entry.dishId, dayKey);
    }
    mealPlan[weekKey][dayKey] = { dishId: "", dishName: "" };
    persistAll();
    renderMealPlan();
    if (activeView === "shopping") renderShoppingList();
    showToast("Tag geleert");
  }

  function getDayEntry(weekKey, dayKey) {
    if (!mealPlan[weekKey]) mealPlan[weekKey] = {};
    mealPlan[weekKey][dayKey] = migrateMealPlanEntry(mealPlan[weekKey][dayKey]);
    return mealPlan[weekKey][dayKey];
  }

  function renderMealPlan() {
    const weekStart = getWeekStart(weekOffset);
    els.weekLabel.textContent = getWeekLabelText();
    const weekKey = weekPlanKey(weekStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    els.mealPlanEl.innerHTML = "";

    DAYS.forEach(function (day, index) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const card = document.createElement("article");
      card.className = "day-card";
      if (date.getTime() === today.getTime()) card.classList.add("is-today");

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
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.remove("active");
    });
    document.getElementById("view-" + viewName).classList.add("active");
    document.querySelectorAll(".menu-btn").forEach(function (btn) {
      const active = btn.dataset.view === viewName;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    els.pageTitle.textContent = VIEW_META[viewName].title;
    renderActiveView();
  }

  function handleAddFood(event) {
    event.preventDefault();
    const name = els.newFoodName.value;
    const category = els.newFoodCategory.value;
    if (!normalizeName(name)) {
      showToast("Bitte einen Namen eingeben");
      return;
    }
    const food = addFoodToDatabase(name, category);
    els.newFoodName.value = "";
    renderFoods();
    showToast(food.name + " in Datenbank gespeichert");
  }

  function handleAddDish(event) {
    event.preventDefault();
    if (!roomRef) {
      showToast("Bitte zuerst der Gruppe beitreten");
      return;
    }
    const name = els.newDishName.value;
    const ingredients = els.newDishIngredients.value;
    const diet = getRadioValue("new-dish-diet");
    const temp = getRadioValue("new-dish-temp");
    if (!normalizeName(name)) {
      showToast("Bitte einen Gerichtnamen eingeben");
      return;
    }
    if (!diet || !temp) {
      showToast("Bitte Art und Temperatur wählen");
      return;
    }
    const dish = addDish(name, ingredients, diet, temp);
    closeDishAddModal();
    renderDishes();
    showToast('Gericht "' + dish.name + '" gespeichert');
  }

  function handleEditDish(event) {
    event.preventDefault();
    if (!roomRef || !selectedDishId) return;
    const name = els.editDishName.value;
    const ingredients = els.editDishIngredients.value;
    const diet = getRadioValue("edit-dish-diet");
    const temp = getRadioValue("edit-dish-temp");
    if (!normalizeName(name) || !diet || !temp) {
      showToast("Bitte alle Felder ausfüllen");
      return;
    }
    const dish = updateDish(selectedDishId, name, ingredients, diet, temp);
    if (!dish) return;
    closeDishEditModal();
    renderDishes();
    if (activeView === "mealplan") renderMealPlan();
    showToast('Gericht "' + dish.name + '" aktualisiert');
  }

  async function shareAppLink() {
    const url = getShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Einkaufs-App", text: "Tritt unserer gemeinsamen Einkaufsliste bei:", url: url });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link kopiert!");
    } catch {
      prompt("Link kopieren:", url);
    }
  }

  function bindEvents() {
    els.menuToggle.addEventListener("click", function () {
      if (els.sideMenu.classList.contains("open")) closeMenu();
      else openMenu();
    });
    els.sideMenuOverlay.addEventListener("click", closeMenu);
    document.querySelectorAll(".menu-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.dataset.view);
      });
    });

    document.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const type = btn.dataset.filter;
        const value = btn.dataset.value;
        dishFilter[type] = dishFilter[type] === value ? null : value;
        renderDishes();
      });
    });

    els.openAddDishBtn.addEventListener("click", openDishAddModal);
    els.closeDishAdd.addEventListener("click", closeDishAddModal);
    els.dishAddOverlay.addEventListener("click", function (e) {
      if (e.target === els.dishAddOverlay) closeDishAddModal();
    });
    els.addDishForm.addEventListener("submit", handleAddDish);

    els.addFoodForm.addEventListener("submit", handleAddFood);
    els.foodSearch.addEventListener("input", renderFoods);
    els.dishSearch.addEventListener("input", renderDishes);

    document.getElementById("clear-checked").addEventListener("click", function () {
      const weekKey = weekPlanKey(getWeekStart(weekOffset));
      weeklyShopping[weekKey] = getWeeklyList(weekKey).filter(function (i) {
        return i.checked;
      });
      persistAll();
      renderShoppingList();
      showToast("Erledigte entfernt");
    });
    document.getElementById("clear-all").addEventListener("click", function () {
      const weekKey = weekPlanKey(getWeekStart(weekOffset));
      if (!getWeeklyList(weekKey).length) return;
      if (confirm("Einkaufsliste für diese Woche leeren?")) {
        weeklyShopping[weekKey] = [];
        persistAll();
        renderShoppingList();
      }
    });

    document.getElementById("prev-week-shopping").addEventListener("click", function () {
      changeWeekOffset(-1);
    });
    document.getElementById("next-week-shopping").addEventListener("click", function () {
      changeWeekOffset(1);
    });
    document.getElementById("prev-week").addEventListener("click", function () {
      changeWeekOffset(-1);
    });
    document.getElementById("next-week").addEventListener("click", function () {
      changeWeekOffset(1);
    });

    els.closeDishDetail.addEventListener("click", closeDishDetailModal);
    els.editDishBtn.addEventListener("click", function () {
      if (selectedDishId) openDishEdit(selectedDishId);
    });
    els.addDishToPlanBtn.addEventListener("click", openDayPicker);
    els.closeDishEdit.addEventListener("click", closeDishEditModal);
    els.cancelDishEdit.addEventListener("click", closeDishEditModal);
    els.editDishForm.addEventListener("submit", handleEditDish);
    els.dishDetailOverlay.addEventListener("click", function (e) {
      if (e.target === els.dishDetailOverlay) closeDishDetailModal();
    });
    els.dishEditOverlay.addEventListener("click", function (e) {
      if (e.target === els.dishEditOverlay) closeDishEditModal();
    });
    els.closeDayPicker.addEventListener("click", closeDayPickerModal);
    els.dayPickerOverlay.addEventListener("click", function (e) {
      if (e.target === els.dayPickerOverlay) closeDayPickerModal();
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
    if (urlRoom) connectToRoom(urlRoom);
    else if (storedRoom) connectToRoom(storedRoom);
    else showSetupOverlay(defaultRoom);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (r) {
        r.update();
      }).catch(function () {});
    });
  }

  startApp();
})();
