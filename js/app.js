(function () {
  "use strict";

  const ROOM_STORAGE_KEY = "einkaufsapp_room";
  const PERSON_STORAGE_KEY = "einkaufsapp_person";

  const SPORT_EXERCISES = [
    { key: "pullups", label: "Klimmzüge", planId: "sport-plan-pullups", doneId: "sport-done-pullups" },
    { key: "pushups", label: "Liegestütze", planId: "sport-plan-pushups", doneId: "sport-done-pushups" },
    { key: "situps", label: "Sit-Ups", planId: "sport-plan-situps", doneId: "sport-done-situps" },
  ];

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

  const UNIT_KINDS = {
    weight: { label: "Gewicht", units: ["g", "kg"], defaultUnit: "g" },
    volume: { label: "Flüssigkeit", units: ["ml", "l"], defaultUnit: "ml" },
    piece: { label: "Stück", units: ["stk"], defaultUnit: "stk" },
    package: { label: "Packung", units: ["pack"], defaultUnit: "pack" },
    bottle: { label: "Flasche", units: ["fl"], defaultUnit: "fl" },
  };

  const FOODS_DB_RESET_KEY = "foodsDbUserResetV1";

  const FOOD_CATEGORY_ORDER = [
    "Obst & Gemüse",
    "Backwaren",
    "Milchprodukte",
    "Fleisch & Fisch",
    "Teigwaren",
    "Vorrat",
    "Konserven",
    "Tiefkühl",
    "Gewürze & Kräuter",
    "Getränke",
    "Alkohol",
    "Süßigkeiten & Snacks",
    "Pflege",
    "Haushalt",
    "Sonstiges",
  ];

  let pendingAddToListFoodId = null;
  let selectedFoodId = null;

  const VIEW_META = {
    home: { title: "Start" },
    sport: { title: "Sport" },
    shopping: { title: "Einkaufsliste" },
    foods: { title: "Lebensmittel" },
    dishes: { title: "Gerichte" },
  };

  let db = null;
  let roomCode = "";
  let roomRef = null;
  let unsubscribeRoom = null;
  let isRemoteUpdate = false;
  let isInitialized = false;
  let toastTimer = null;
  let pendingWrites = 0;
  let activeView = "home";
  let selectedDishId = null;
  let calendarMonthOffset = 0;
  let sportViewDate = null;
  let dayDetailDateKey = null;
  let pendingAssignDateKey = null;
  let sportModalContext = null;

  let foods = [];
  let dishes = [];
  let weeklyShopping = {};
  let mealPlan = {};
  let sportLog = {};
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
    calendarMonthLabel: document.getElementById("calendar-month-label"),
    calendarGrid: document.getElementById("calendar-grid"),
    sportPersonName: document.getElementById("sport-person-name"),
    sportDayLabel: document.getElementById("sport-day-label"),
    sportOpenPlan: document.getElementById("sport-open-plan"),
    sportOpenDone: document.getElementById("sport-open-done"),
    sportPlanOverlay: document.getElementById("sport-plan-overlay"),
    sportPlanTitle: document.getElementById("sport-plan-title"),
    sportPlanForm: document.getElementById("sport-plan-form"),
    closeSportPlan: document.getElementById("close-sport-plan"),
    sportDoneOverlay: document.getElementById("sport-done-overlay"),
    sportDoneTitle: document.getElementById("sport-done-title"),
    sportDoneHints: document.getElementById("sport-done-hints"),
    sportDoneForm: document.getElementById("sport-done-form"),
    closeSportDone: document.getElementById("close-sport-done"),
    sportOthers: document.getElementById("sport-others"),
    dayDetailOverlay: document.getElementById("day-detail-overlay"),
    dayDetailTitle: document.getElementById("day-detail-title"),
    dayDetailMeal: document.getElementById("day-detail-meal"),
    dayDetailSport: document.getElementById("day-detail-sport"),
    closeDayDetail: document.getElementById("close-day-detail"),
    dayDetailPickDish: document.getElementById("day-detail-pick-dish"),
    dayDetailRemoveDish: document.getElementById("day-detail-remove-dish"),
    dayDetailPlanSport: document.getElementById("day-detail-plan-sport"),
    dayDetailAllDone: document.getElementById("day-detail-all-done"),
    dishPickerOverlay: document.getElementById("dish-picker-overlay"),
    dishPickerHint: document.getElementById("dish-picker-hint"),
    dishPickerSearch: document.getElementById("dish-picker-search"),
    dishPickerList: document.getElementById("dish-picker-list"),
    closeDishPicker: document.getElementById("close-dish-picker"),
    shoppingList: document.getElementById("shopping-list"),
    shoppingEmpty: document.getElementById("shopping-empty"),
    shoppingWeekLabel: document.getElementById("shopping-week-label"),
    quickAddForm: document.getElementById("quick-add-form"),
    quickAddName: document.getElementById("quick-add-name"),
    foodGroups: document.getElementById("food-groups"),
    foodsEmpty: document.getElementById("foods-empty"),
    foodSearch: document.getElementById("food-search"),
    addFoodForm: document.getElementById("add-food-form"),
    newFoodName: document.getElementById("new-food-name"),
    newFoodCategory: document.getElementById("new-food-category"),
    newFoodUnitKind: document.getElementById("new-food-unit-kind"),
    foodEditOverlay: document.getElementById("food-edit-overlay"),
    editFoodForm: document.getElementById("edit-food-form"),
    editFoodName: document.getElementById("edit-food-name"),
    editFoodCategory: document.getElementById("edit-food-category"),
    editFoodUnitKind: document.getElementById("edit-food-unit-kind"),
    closeFoodEdit: document.getElementById("close-food-edit"),
    cancelFoodEdit: document.getElementById("cancel-food-edit"),
    openAddDishBtn: document.getElementById("open-add-dish-btn"),
    dishAddOverlay: document.getElementById("dish-add-overlay"),
    closeDishAdd: document.getElementById("close-dish-add"),
    addDishForm: document.getElementById("add-dish-form"),
    newDishName: document.getElementById("new-dish-name"),
    addDishIngredientsList: document.getElementById("add-dish-ingredients-list"),
    addDishIngredientRowBtn: document.getElementById("add-dish-ingredient-row"),
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
    editDishIngredientsList: document.getElementById("edit-dish-ingredients-list"),
    editDishIngredientRowBtn: document.getElementById("edit-dish-ingredient-row"),
    closeDishEdit: document.getElementById("close-dish-edit"),
    cancelDishEdit: document.getElementById("cancel-dish-edit"),
    addToListOverlay: document.getElementById("add-to-list-overlay"),
    addToListFoodLabel: document.getElementById("add-to-list-food-label"),
    addToListAmount: document.getElementById("add-to-list-amount"),
    addToListUnit: document.getElementById("add-to-list-unit"),
    closeAddToList: document.getElementById("close-add-to-list"),
    confirmAddToList: document.getElementById("confirm-add-to-list"),
    foodNameSuggestions: document.getElementById("food-name-suggestions"),
    dayPickerOverlay: document.getElementById("day-picker-overlay"),
    dayPickerHint: document.getElementById("day-picker-hint"),
    dayPickerList: document.getElementById("day-picker-list"),
    closeDayPicker: document.getElementById("close-day-picker"),
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

  function inferUnitKind(category, name) {
    const n = (name || "").toLowerCase();
    if (category === "Alkohol") return "bottle";
    if (
      n.includes("wein") || n.includes("bier") || n.includes("sekt") ||
      n.includes("prosecco") || n.includes("whisky") || n.includes("likör") ||
      n.includes("flasche")
    ) return "bottle";
    if (category === "Getränke") return "volume";
    if (n === "milch" || n === "olivenöl" || n === "saft" || n === "wasser" || n === "joghurt") return "volume";
    if (category === "Tiefkühl") return "package";
    if (
      n.includes("patty") || n.includes("patties") || n.includes("burger") ||
      n === "salat" || n.includes("salat")
    ) return "package";
    if (
      n === "eier" || n === "brot" || n === "brötchen" || n === "gurke" ||
      n === "avocado" || n === "zitrone"
    ) return "piece";
    if (category === "Backwaren") return "piece";
    if (category === "Pflege") {
      if (
        n.includes("shampoo") || n.includes("duschgel") || n.includes("spülung") ||
        n.includes("spulung") || n.includes("dusch") || n.includes("seife")
      ) return "bottle";
      return "piece";
    }
    if (category === "Haushalt") return "package";
    return "weight";
  }

  function unitDisplayLabel(unit, amount) {
    if (unit === "pack") return amount === 1 ? "Packung" : "Packungen";
    if (unit === "fl") return amount === 1 ? "Flasche" : "Flaschen";
    return unit;
  }

  function isValidUnitForKind(unitKind, unit) {
    return UNIT_KINDS[unitKind] && UNIT_KINDS[unitKind].units.indexOf(unit) !== -1;
  }

  function getDefaultUnit(unitKind) {
    return UNIT_KINDS[unitKind] ? UNIT_KINDS[unitKind].defaultUnit : "g";
  }

  function unitKindFromUnit(unit) {
    if (unit === "g" || unit === "kg") return "weight";
    if (unit === "ml" || unit === "l") return "volume";
    if (unit === "stk") return "piece";
    if (unit === "pack") return "package";
    if (unit === "fl") return "bottle";
    return null;
  }

  function toBaseAmount(amount, unit) {
    if (amount == null || !unit) return null;
    const value = Number(amount);
    if (!isFinite(value) || value <= 0) return null;
    if (unit === "kg") return value * 1000;
    if (unit === "g") return value;
    if (unit === "l") return value * 1000;
    if (unit === "ml") return value;
    if (unit === "stk" || unit === "pack" || unit === "fl") return value;
    return null;
  }

  function formatAmountFromBase(base, unitKind) {
    if (base == null) return null;
    if (unitKind === "weight") {
      if (base >= 1000) {
        const kg = base / 1000;
        return { amount: Math.round(kg * 100) / 100, unit: "kg" };
      }
      return { amount: Math.round(base), unit: "g" };
    }
    if (unitKind === "volume") {
      if (base >= 1000) {
        const liters = base / 1000;
        return { amount: Math.round(liters * 100) / 100, unit: "l" };
      }
      return { amount: Math.round(base), unit: "ml" };
    }
    if (unitKind === "package") {
      return { amount: Math.round(base * 100) / 100, unit: "pack" };
    }
    if (unitKind === "bottle") {
      return { amount: Math.round(base * 100) / 100, unit: "fl" };
    }
    return { amount: Math.round(base * 100) / 100, unit: "stk" };
  }

  function formatQuantity(amount, unit) {
    if (amount == null || !unit) return "";
    const display = amount % 1 === 0 ? String(amount) : String(Math.round(amount * 100) / 100);
    return display + " " + unitDisplayLabel(unit, amount);
  }

  function migrateFood(food) {
    if (!food || typeof food !== "object") return null;
    const category = food.category || "Sonstiges";
    return {
      id: food.id || uid(),
      name: food.name || "",
      category: category,
      unitKind: food.unitKind || inferUnitKind(category, food.name),
    };
  }

  function migrateIngredient(ingredient) {
    if (typeof ingredient === "string") {
      const name = normalizeName(ingredient);
      if (!name) return null;
      const food = findFoodByName(name);
      return {
        name: name,
        foodId: food ? food.id : null,
        amount: null,
        unit: null,
      };
    }
    if (!ingredient || typeof ingredient !== "object") return null;
    const name = normalizeName(ingredient.name || "");
    if (!name) return null;
    let unit = ingredient.unit || null;
    let amount = ingredient.amount != null ? Number(ingredient.amount) : null;
    if (amount != null && (!isFinite(amount) || amount <= 0)) amount = null;
    const food = ingredient.foodId ? foods.find(function (f) { return f.id === ingredient.foodId; }) : findFoodByName(name);
    const unitKind = food ? food.unitKind : unitKindFromUnit(unit);
    if (unit && unitKind && !isValidUnitForKind(unitKind, unit)) unit = null;
    return {
      name: name,
      foodId: food ? food.id : (ingredient.foodId || null),
      amount: amount,
      unit: unit,
    };
  }

  function migrateShoppingItem(item) {
    if (!item || typeof item !== "object") return null;
    let amount = item.amount != null ? Number(item.amount) : null;
    if (amount != null && (!isFinite(amount) || amount <= 0)) amount = null;
    let unit = item.unit || null;
    if (unit && !unitKindFromUnit(unit)) unit = null;
    return {
      id: item.id || uid(),
      name: item.name || "",
      checked: !!item.checked,
      addedAt: item.addedAt || Date.now(),
      source: item.source || "manual",
      foodId: item.foodId || null,
      amount: amount,
      unit: unit,
      dishId: item.dishId || null,
      dishName: item.dishName || null,
      dayKey: item.dayKey || null,
      dayLabel: item.dayLabel || null,
    };
  }

  function formatIngredientLabel(ingredient) {
    if (ingredient.amount != null && ingredient.unit) {
      return formatQuantity(ingredient.amount, ingredient.unit) + " " + ingredient.name;
    }
    return ingredient.name;
  }

  function ingredientSearchText(ingredient) {
    return formatIngredientLabel(ingredient).toLowerCase();
  }

  function migrateDish(dish) {
    if (!dish || typeof dish !== "object") return null;
    const rawIngredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
    return {
      id: dish.id || uid(),
      name: dish.name || "",
      ingredients: rawIngredients.map(migrateIngredient).filter(Boolean),
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
    return [];
  }

  function updateFoodNameSuggestions() {
    els.foodNameSuggestions.innerHTML = "";
    foods.forEach(function (food) {
      const option = document.createElement("option");
      option.value = food.name;
      els.foodNameSuggestions.appendChild(option);
    });
  }

  function populateUnitSelect(selectEl, unitKind, selectedUnit) {
    selectEl.innerHTML = "";
    const kind = UNIT_KINDS[unitKind] || UNIT_KINDS.weight;
    kind.units.forEach(function (unit) {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit === "pack" ? "Pack." : unit === "fl" ? "Flasche" : unit;
      selectEl.appendChild(option);
    });
    selectEl.value = selectedUnit && kind.units.indexOf(selectedUnit) !== -1
      ? selectedUnit
      : kind.defaultUnit;
  }

  function resolveUnitKindForName(name) {
    const food = findFoodByName(name);
    return food ? food.unitKind : "weight";
  }

  function createIngredientEditorRow(container, initial) {
    const row = document.createElement("div");
    row.className = "ingredient-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "ingredient-name";
    nameInput.placeholder = "Lebensmittel";
    nameInput.setAttribute("list", "food-name-suggestions");
    nameInput.autocomplete = "off";
    nameInput.value = initial && initial.name ? initial.name : "";

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.className = "ingredient-amount";
    amountInput.min = "0.01";
    amountInput.step = "any";
    amountInput.inputMode = "decimal";
    amountInput.placeholder = "Menge";
    if (initial && initial.amount != null) amountInput.value = String(initial.amount);

    const unitSelect = document.createElement("select");
    unitSelect.className = "ingredient-unit";
    unitSelect.setAttribute("aria-label", "Einheit");

    function syncUnits() {
      const unitKind = resolveUnitKindForName(nameInput.value);
      populateUnitSelect(unitSelect, unitKind, unitSelect.value);
    }

    nameInput.addEventListener("input", syncUnits);
    syncUnits();
    if (initial && initial.unit) unitSelect.value = initial.unit;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-btn ingredient-remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", "Zutat entfernen");
    removeBtn.addEventListener("click", function () {
      row.remove();
    });

    row.appendChild(nameInput);
    row.appendChild(amountInput);
    row.appendChild(unitSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function readIngredientsFromEditor(container) {
    const ingredients = [];
    container.querySelectorAll(".ingredient-row").forEach(function (row) {
      const name = normalizeName(row.querySelector(".ingredient-name").value);
      if (!name) return;
      const amountRaw = row.querySelector(".ingredient-amount").value.trim();
      const unit = row.querySelector(".ingredient-unit").value;
      const food = findFoodByName(name);
      let amount = amountRaw ? Number(amountRaw) : null;
      if (amount != null && (!isFinite(amount) || amount <= 0)) amount = null;
      const unitKind = food ? food.unitKind : unitKindFromUnit(unit);
      if (amount != null && unitKind && !isValidUnitForKind(unitKind, unit)) return;
      ingredients.push({
        name: name,
        foodId: food ? food.id : null,
        amount: amount,
        unit: amount != null ? unit : null,
      });
    });
    return ingredients;
  }

  function resetIngredientEditor(container) {
    container.innerHTML = "";
    createIngredientEditorRow(container, null);
  }

  function fillIngredientEditor(container, ingredients) {
    container.innerHTML = "";
    if (!ingredients || ingredients.length === 0) {
      createIngredientEditorRow(container, null);
      return;
    }
    ingredients.forEach(function (ingredient) {
      createIngredientEditorRow(container, ingredient);
    });
  }

  function ingredientsHaveAmounts(container) {
    let hasNamedRow = false;
    let valid = true;
    container.querySelectorAll(".ingredient-row").forEach(function (row) {
      const name = normalizeName(row.querySelector(".ingredient-name").value);
      const amountRaw = row.querySelector(".ingredient-amount").value.trim();
      if (!name) return;
      hasNamedRow = true;
      if (!amountRaw || Number(amountRaw) <= 0) valid = false;
    });
    return hasNamedRow && valid;
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
    if (Array.isArray(data.dishes)) {
      dishes = data.dishes.map(migrateDish).filter(Boolean);
    }
    if (data.weeklyShopping && typeof data.weeklyShopping === "object") {
      weeklyShopping = {};
      Object.keys(data.weeklyShopping).forEach(function (weekKey) {
        weeklyShopping[weekKey] = (data.weeklyShopping[weekKey] || [])
          .map(migrateShoppingItem)
          .filter(Boolean);
      });
    }
    if (data.mealPlan && typeof data.mealPlan === "object") mealPlan = data.mealPlan;
    if (typeof data.weekOffset === "number") weekOffset = data.weekOffset;
    if (data.sportLog && typeof data.sportLog === "object") sportLog = data.sportLog;

    const foodsResetDone = !!data[FOODS_DB_RESET_KEY];
    if (foodsResetDone && Array.isArray(data.foods)) {
      foods = data.foods.map(migrateFood).filter(Boolean);
    } else {
      foods = [];
    }

    isRemoteUpdate = false;
    isInitialized = true;
    updateFoodNameSuggestions();
    renderActiveView();

    if (!foodsResetDone) {
      persistFoodsReset();
      showToast("Lebensmittel-Datenbank geleert – du kannst neu anlegen");
    }
  }

  function persistFoodsReset() {
    if (!roomRef) return;
    pendingWrites += 1;
    roomRef.set(
      {
        foods: [],
        [FOODS_DB_RESET_KEY]: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ).catch(function () {
      showToast("Konnte Lebensmittel-Datenbank nicht leeren");
    }).finally(function () {
      setTimeout(function () {
        pendingWrites -= 1;
      }, 400);
    });
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
            sportLog = {};
            weekOffset = 0;
            isInitialized = true;
            updateFoodNameSuggestions();
            pendingWrites += 1;
            roomRef.set({
              foods: [],
              dishes: [],
              weeklyShopping: {},
              mealPlan: {},
              sportLog: {},
              weekOffset: 0,
              [FOODS_DB_RESET_KEY]: true,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }).catch(function () {
              showToast("Konnte Gruppe nicht anlegen");
            }).finally(function () {
              setTimeout(function () {
                pendingWrites -= 1;
              }, 400);
            });
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
        sportLog: sportLog,
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
    return dateKeyFromDate(weekStart);
  }

  function dateKeyFromDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function parseDateKey(key) {
    const parts = key.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getDayKeyFromDate(date) {
    const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return keys[date.getDay()];
  }

  function getWeekStartForDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return d;
  }

  function getMealForDate(date) {
    const weekStart = getWeekStartForDate(date);
    const weekKey = weekPlanKey(weekStart);
    const dayKey = getDayKeyFromDate(date);
    if (!mealPlan[weekKey] || !mealPlan[weekKey][dayKey]) return null;
    const entry = migrateMealPlanEntry(mealPlan[weekKey][dayKey]);
    if (!entry.dishName) return null;
    return entry;
  }

  function formatLongDate(date) {
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function getCalendarMonthStart(offset) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getPersonName() {
    try {
      return normalizeName(localStorage.getItem(PERSON_STORAGE_KEY) || "");
    } catch {
      return "";
    }
  }

  function savePersonName(name) {
    const clean = normalizeName(name);
    try {
      if (clean) localStorage.setItem(PERSON_STORAGE_KEY, clean);
      else localStorage.removeItem(PERSON_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return clean;
  }

  function parseSportNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    if (isNaN(n) || n < 0) return null;
    return Math.floor(n);
  }

  function emptySportValues() {
    return { pullups: null, pushups: null, situps: null };
  }

  function emptySportEntry() {
    return { plan: emptySportValues(), done: emptySportValues() };
  }

  function migrateSportEntry(entry) {
    if (!entry || typeof entry !== "object") return emptySportEntry();
    const plan = entry.plan || {};
    const done = entry.done || {};
    const result = emptySportEntry();
    SPORT_EXERCISES.forEach(function (ex) {
      result.plan[ex.key] = parseSportNumber(plan[ex.key]);
      result.done[ex.key] = parseSportNumber(done[ex.key]);
    });
    return result;
  }

  function sportEntryHasData(entry) {
    const e = migrateSportEntry(entry);
    return SPORT_EXERCISES.some(function (ex) {
      return e.plan[ex.key] != null || e.done[ex.key] != null;
    });
  }

  function getPersonSportEntry(key, personName) {
    if (!personName || !sportLog[key] || !sportLog[key][personName]) {
      return emptySportEntry();
    }
    return migrateSportEntry(sportLog[key][personName]);
  }

  function getKnownSportPersons() {
    const names = {};
    Object.keys(sportLog).forEach(function (key) {
      Object.keys(sportLog[key] || {}).forEach(function (name) {
        if (sportEntryHasData(sportLog[key][name])) names[name] = true;
      });
    });
    const mine = getPersonName();
    if (mine) names[mine] = true;
    return Object.keys(names).sort(function (a, b) {
      return a.localeCompare(b, "de");
    });
  }

  function sportSummaryText(entry) {
    const e = migrateSportEntry(entry);
    let planSum = 0;
    let doneSum = 0;
    let hasPlan = false;
    let hasDone = false;
    SPORT_EXERCISES.forEach(function (ex) {
      if (e.plan[ex.key] != null) {
        planSum += e.plan[ex.key];
        hasPlan = true;
      }
      if (e.done[ex.key] != null) {
        doneSum += e.done[ex.key];
        hasDone = true;
      }
    });
    if (!hasPlan && !hasDone) return "";
    if (hasPlan && hasDone) return doneSum + "/" + planSum;
    if (hasDone) return String(doneSum);
    return "🎯" + planSum;
  }

  function sportStatusClass(entry) {
    const e = migrateSportEntry(entry);
    let allMet = true;
    let anyDone = false;
    let anyPlan = false;
    SPORT_EXERCISES.forEach(function (ex) {
      if (e.plan[ex.key] != null) anyPlan = true;
      if (e.done[ex.key] != null) anyDone = true;
      if (e.plan[ex.key] != null && (e.done[ex.key] == null || e.done[ex.key] < e.plan[ex.key])) {
        allMet = false;
      }
    });
    if (!anyPlan && !anyDone) return "";
    if (anyDone && anyPlan && allMet) return "sport-ok";
    if (anyDone) return "sport-partial";
    return "sport-planned";
  }

  function readSportPlanForm() {
    const plan = emptySportValues();
    SPORT_EXERCISES.forEach(function (ex) {
      const el = document.getElementById(ex.planId);
      plan[ex.key] = parseSportNumber(el ? el.value : "");
    });
    return plan;
  }

  function readSportDoneForm() {
    const done = emptySportValues();
    SPORT_EXERCISES.forEach(function (ex) {
      const el = document.getElementById(ex.doneId);
      done[ex.key] = parseSportNumber(el ? el.value : "");
    });
    return done;
  }

  function fillSportPlanForm(entry) {
    const e = migrateSportEntry(entry);
    SPORT_EXERCISES.forEach(function (ex) {
      const el = document.getElementById(ex.planId);
      if (el) el.value = e.plan[ex.key] != null ? String(e.plan[ex.key]) : "";
    });
  }

  function fillSportDoneForm(entry) {
    const e = migrateSportEntry(entry);
    SPORT_EXERCISES.forEach(function (ex) {
      const el = document.getElementById(ex.doneId);
      if (el) el.value = e.done[ex.key] != null ? String(e.done[ex.key]) : "";
    });
  }

  function sportPlanHasValues(plan) {
    return SPORT_EXERCISES.some(function (ex) {
      return plan[ex.key] != null;
    });
  }

  function sportDoneHasValues(done) {
    return SPORT_EXERCISES.some(function (ex) {
      return done[ex.key] != null;
    });
  }

  function mergeSportEntry(key, personName, planUpdate, doneUpdate) {
    const entry = getPersonSportEntry(key, personName);
    if (planUpdate) {
      SPORT_EXERCISES.forEach(function (ex) {
        entry.plan[ex.key] = planUpdate[ex.key];
      });
    }
    if (doneUpdate) {
      SPORT_EXERCISES.forEach(function (ex) {
        entry.done[ex.key] = doneUpdate[ex.key];
      });
    }
    return entry;
  }

  function closeSportPlanModal(restoreDayDetail) {
    els.sportPlanOverlay.classList.add("hidden");
    els.sportPlanForm.reset();
    if (restoreDayDetail !== false && dayDetailDateKey) {
      openDayDetailModal(parseDateKey(dayDetailDateKey));
    }
    sportModalContext = null;
  }

  function closeSportDoneModal(restoreDayDetail) {
    els.sportDoneOverlay.classList.add("hidden");
    els.sportDoneForm.reset();
    els.sportDoneHints.textContent = "";
    if (restoreDayDetail !== false && dayDetailDateKey) {
      openDayDetailModal(parseDateKey(dayDetailDateKey));
    }
    sportModalContext = null;
  }

  function openSportPlanModal(date, personName) {
    const name = normalizeName(personName || getPersonName());
    if (!name) {
      showToast("Bitte zuerst deinen Namen eintragen");
      return;
    }
    const key = dateKeyFromDate(date);
    sportModalContext = {
      mode: "plan",
      dateKey: key,
      personName: name,
      hadDayDetail: !!dayDetailDateKey,
    };
    hideDayDetailOverlay();
    els.sportPlanTitle.textContent = "Ziele – " + formatLongDate(date);
    fillSportPlanForm(getPersonSportEntry(key, name));
    els.sportPlanOverlay.classList.remove("hidden");
    document.getElementById("sport-plan-pullups").focus();
  }

  function openSportDoneModal(date, personName) {
    const name = normalizeName(personName || getPersonName());
    if (!name) {
      showToast("Bitte zuerst deinen Namen eintragen");
      return;
    }
    const key = dateKeyFromDate(date);
    const entry = getPersonSportEntry(key, name);
    sportModalContext = {
      mode: "done",
      dateKey: key,
      personName: name,
      hadDayDetail: !!dayDetailDateKey,
    };
    hideDayDetailOverlay();
    els.sportDoneTitle.textContent = "Erledigt – " + formatLongDate(date);
    const hints = [];
    SPORT_EXERCISES.forEach(function (ex) {
      if (entry.plan[ex.key] != null) {
        hints.push(ex.label + ": Ziel " + entry.plan[ex.key]);
      }
    });
    els.sportDoneHints.textContent = hints.length
      ? "Deine Ziele: " + hints.join(" · ")
      : "Noch keine Ziele gesetzt – du kannst trotzdem eintragen, was du geschafft hast.";
    fillSportDoneForm(entry);
    els.sportDoneOverlay.classList.remove("hidden");
    document.getElementById("sport-done-pullups").focus();
  }

  function handleSportPlanSubmit(event) {
    event.preventDefault();
    const ctx = sportModalContext;
    if (!ctx || ctx.mode !== "plan") return;
    const plan = readSportPlanForm();
    if (!sportPlanHasValues(plan)) {
      showToast("Bitte mindestens ein Ziel eintragen");
      return;
    }
    const entry = mergeSportEntry(ctx.dateKey, ctx.personName, plan, null);
    if (savePersonSportEntry(ctx.dateKey, ctx.personName, entry)) {
      const hadDayDetail = ctx.hadDayDetail;
      closeSportPlanModal(false);
      showToast("Ziele gespeichert");
      if (hadDayDetail && dayDetailDateKey) {
        openDayDetailModal(parseDateKey(dayDetailDateKey));
      }
      if (activeView === "sport") renderSportView();
      if (activeView === "home") renderHomeCalendar();
    }
  }

  function handleSportDoneSubmit(event) {
    event.preventDefault();
    const ctx = sportModalContext;
    if (!ctx || ctx.mode !== "done") return;
    const done = readSportDoneForm();
    if (!sportDoneHasValues(done)) {
      showToast("Bitte mindestens einen erledigten Wert eintragen");
      return;
    }
    const entry = mergeSportEntry(ctx.dateKey, ctx.personName, null, done);
    if (savePersonSportEntry(ctx.dateKey, ctx.personName, entry)) {
      const hadDayDetail = ctx.hadDayDetail;
      closeSportDoneModal(false);
      showToast("Erledigt gespeichert");
      if (hadDayDetail && dayDetailDateKey) {
        openDayDetailModal(parseDateKey(dayDetailDateKey));
      }
      if (activeView === "sport") renderSportView();
      if (activeView === "home") renderHomeCalendar();
    }
  }

  function isCurrentSportPerson(name) {
    const mine = getPersonName();
    if (!mine || !name) return false;
    return mine.toLowerCase() === name.toLowerCase();
  }

  function markSportAllDone(date, personName) {
    const name = normalizeName(personName);
    const key = dateKeyFromDate(date);
    const entry = getPersonSportEntry(key, name);
    const done = emptySportValues();
    SPORT_EXERCISES.forEach(function (ex) {
      done[ex.key] = entry.plan[ex.key];
    });
    const merged = mergeSportEntry(key, name, null, done);
    return savePersonSportEntry(key, name, merged);
  }

  function handleSportQuickComplete(date, personName) {
    const name = normalizeName(personName || getPersonName());
    if (!name) {
      showToast("Bitte zuerst deinen Namen eintragen");
      return;
    }
    const key = dateKeyFromDate(date);
    const entry = getPersonSportEntry(key, name);
    if (!sportPlanHasValues(entry.plan)) {
      showToast("Zuerst Ziele für diesen Tag setzen");
      return;
    }
    if (!confirm("Alles geschafft? Deine Ziele werden als erledigt übernommen.")) return;
    if (markSportAllDone(date, name)) {
      showToast("Alles erledigt eingetragen");
      if (activeView === "home") renderHomeCalendar();
      if (dayDetailDateKey === key) openDayDetailModal(date);
      if (activeView === "sport") renderSportView();
    }
  }

  function savePersonSportEntry(key, personName, entry) {
    const cleanName = normalizeName(personName);
    if (!cleanName) {
      showToast("Bitte zuerst deinen Namen eintragen");
      return false;
    }
    const migrated = migrateSportEntry(entry);
    if (!sportLog[key]) sportLog[key] = {};
    if (sportEntryHasData(migrated)) {
      sportLog[key][cleanName] = migrated;
    } else if (sportLog[key][cleanName]) {
      delete sportLog[key][cleanName];
      if (Object.keys(sportLog[key]).length === 0) delete sportLog[key];
    }
    persistAll();
    return true;
  }

  function ensureSportViewDate() {
    if (!sportViewDate) {
      sportViewDate = new Date();
      sportViewDate.setHours(0, 0, 0, 0);
    }
    return sportViewDate;
  }

  function setSportViewDate(date) {
    sportViewDate = new Date(date);
    sportViewDate.setHours(0, 0, 0, 0);
  }

  function changeSportViewDay(delta) {
    const d = ensureSportViewDate();
    d.setDate(d.getDate() + delta);
    setSportViewDate(d);
    renderSportView();
  }

  function renderSportOthers(key, currentPerson) {
    els.sportOthers.innerHTML = "";
    const persons = getKnownSportPersons().filter(function (name) {
      return name.toLowerCase() !== (currentPerson || "").toLowerCase();
    });
    if (persons.length === 0) return;

    const heading = document.createElement("h3");
    heading.className = "section-label";
    heading.textContent = "Andere in der WG";
    els.sportOthers.appendChild(heading);

    persons.forEach(function (name) {
      const entry = getPersonSportEntry(key, name);
      if (!sportEntryHasData(entry)) return;

      const card = document.createElement("div");
      card.className = "card sport-other-card";
      const title = document.createElement("div");
      title.className = "sport-other-name";
      title.textContent = name;
      card.appendChild(title);

      const list = document.createElement("ul");
      list.className = "sport-other-list";
      SPORT_EXERCISES.forEach(function (ex) {
        const plan = entry.plan[ex.key];
        const done = entry.done[ex.key];
        if (plan == null && done == null) return;
        const li = document.createElement("li");
        let text = ex.label + ": ";
        if (plan != null && done != null) text += done + " / " + plan;
        else if (done != null) text += done + " erledigt";
        else text += "Ziel " + plan;
        li.textContent = text;
        list.appendChild(li);
      });
      card.appendChild(list);
      els.sportOthers.appendChild(card);
    });
  }

  function renderSportView() {
    const personName = savePersonName(els.sportPersonName.value) || getPersonName();
    if (els.sportPersonName.value !== personName) els.sportPersonName.value = personName;

    const date = ensureSportViewDate();
    const key = dateKeyFromDate(date);
    els.sportDayLabel.textContent = formatLongDate(date);

    const entry = getPersonSportEntry(key, personName);
    const hasPlan = sportPlanHasValues(entry.plan);
    const hasDone = sportDoneHasValues(entry.done);
    els.sportOpenDone.disabled = !personName;
    els.sportOpenPlan.disabled = !personName;
    if (!personName) {
      els.sportOpenPlan.title = "Bitte zuerst deinen Namen eintragen";
      els.sportOpenDone.title = "Bitte zuerst deinen Namen eintragen";
    } else {
      els.sportOpenPlan.title = "";
      els.sportOpenDone.title = hasPlan ? "" : "Ziele optional – du kannst auch direkt Erledigt eintragen";
    }

    renderSportOthers(key, personName);
  }

  function openSportForDate(date) {
    setSportViewDate(date);
    switchView("sport");
  }

  function openDayDetailModal(date) {
    const key = dateKeyFromDate(date);
    dayDetailDateKey = key;
    els.dayDetailTitle.textContent = formatLongDate(date);

    const meal = getMealForDate(date);
    els.dayDetailMeal.textContent = meal ? meal.dishName : "Kein Gericht geplant";
    els.dayDetailPickDish.textContent = meal ? "Gericht ändern" : "Gericht wählen";
    els.dayDetailRemoveDish.classList.toggle("hidden", !meal);

    const mine = getPersonName();
    const myEntry = mine ? getPersonSportEntry(key, mine) : emptySportEntry();
    const showAllDone = mine && sportPlanHasValues(myEntry.plan);
    els.dayDetailAllDone.classList.toggle("hidden", !showAllDone);

    els.dayDetailSport.innerHTML = "";
    const persons = getKnownSportPersons();
    let hasSport = false;
    persons.forEach(function (name) {
      const entry = getPersonSportEntry(key, name);
      if (!sportEntryHasData(entry)) return;
      hasSport = true;
      const block = document.createElement("div");
      block.className = "day-detail-person " + sportStatusClass(entry);
      if (isCurrentSportPerson(name)) {
        block.classList.add("day-detail-person-clickable");
        block.setAttribute("role", "button");
        block.setAttribute("tabindex", "0");
        block.setAttribute("aria-label", name + " – Erledigt eintragen");
      }
      const nameEl = document.createElement("div");
      nameEl.className = "day-detail-person-name";
      nameEl.textContent = name;
      if (isCurrentSportPerson(name)) {
        const hint = document.createElement("span");
        hint.className = "day-detail-tap-hint";
        hint.textContent = "Tippen für manuell";
        nameEl.appendChild(hint);
      }
      block.appendChild(nameEl);
      const list = document.createElement("ul");
      list.className = "sport-other-list";
      SPORT_EXERCISES.forEach(function (ex) {
        const plan = entry.plan[ex.key];
        const done = entry.done[ex.key];
        if (plan == null && done == null) return;
        const li = document.createElement("li");
        let text = ex.label + ": ";
        if (plan != null && done != null) text += done + " / " + plan;
        else if (done != null) text += done + " erledigt";
        else text += "Ziel " + plan;
        li.textContent = text;
        list.appendChild(li);
      });
      block.appendChild(list);
      if (isCurrentSportPerson(name)) {
        const openDone = function () {
          openSportDoneModal(parseDateKey(key), name);
        };
        block.addEventListener("click", openDone);
        block.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDone();
          }
        });
      }
      els.dayDetailSport.appendChild(block);
    });
    if (!hasSport) {
      const empty = document.createElement("p");
      empty.className = "field-hint";
      empty.textContent = "Noch keine Ziele – unten auf „Sport planen“ tippen";
      els.dayDetailSport.appendChild(empty);
    }

    els.dayDetailOverlay.classList.remove("hidden");
  }

  function closeDayDetailModal() {
    els.dayDetailOverlay.classList.add("hidden");
    dayDetailDateKey = null;
  }

  function hideDayDetailOverlay() {
    els.dayDetailOverlay.classList.add("hidden");
  }

  function assignDishToDay(dish, weekKey, dayKey, dayLabel, options) {
    const opts = options || {};
    if (!mealPlan[weekKey]) mealPlan[weekKey] = {};
    const previous = getDayEntry(weekKey, dayKey);
    if (previous.dishId) {
      removeMealPlanIngredientsFromWeeklyList(weekKey, previous.dishId, dayKey);
    }
    mealPlan[weekKey][dayKey] = { dishId: dish.id, dishName: dish.name };
    const added = syncDishIngredientsToWeeklyList(dish, weekKey, dayKey, dayLabel);
    persistAll();
    if (opts.closeDayPicker !== false) closeDayPickerModal();
    if (opts.closeDishDetail !== false) closeDishDetailModal();
    let msg = dish.name + " für " + dayLabel + " eingeplant";
    if (added > 0) msg += " – " + added + " Zutat(en) auf Einkaufsliste";
    showToast(msg);
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "home") renderHomeCalendar();
    return added;
  }

  function assignDishToDate(date, dish) {
    const weekStart = getWeekStartForDate(date);
    const weekKey = weekPlanKey(weekStart);
    const dayKey = getDayKeyFromDate(date);
    const dayLabel = date.toLocaleDateString("de-DE", { weekday: "long" });
    assignDishToDay(dish, weekKey, dayKey, dayLabel, {
      closeDayPicker: true,
      closeDishDetail: !dayDetailDateKey,
    });
    if (dayDetailDateKey === dateKeyFromDate(date)) {
      openDayDetailModal(date);
    }
  }

  function clearDayEntryForDate(date) {
    const weekStart = getWeekStartForDate(date);
    const weekKey = weekPlanKey(weekStart);
    const dayKey = getDayKeyFromDate(date);
    clearDayEntry(weekKey, dayKey);
    if (dayDetailDateKey === dateKeyFromDate(date)) {
      openDayDetailModal(date);
    }
  }

  function openDishPickerForDate(date) {
    pendingAssignDateKey = dateKeyFromDate(date);
    hideDayDetailOverlay();
    els.dishPickerHint.textContent =
      "Gericht für " + formatLongDate(date);
    els.dishPickerSearch.value = "";
    renderDishPickerList("");
    els.dishPickerOverlay.classList.remove("hidden");
    els.dishPickerSearch.focus();
  }

  function closeDishPickerModal(restoreDayDetail) {
    const savedDayKey = dayDetailDateKey;
    pendingAssignDateKey = null;
    els.dishPickerOverlay.classList.add("hidden");
    els.dishPickerSearch.value = "";
    if (restoreDayDetail !== false && savedDayKey) {
      openDayDetailModal(parseDateKey(savedDayKey));
    }
  }

  function renderDishPickerList(query) {
    const q = query.trim().toLowerCase();
    const filtered = dishes.filter(function (dish) {
      if (!q) return true;
      return dish.name.toLowerCase().includes(q);
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });

    els.dishPickerList.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "field-hint";
      empty.textContent = dishes.length === 0
        ? "Noch keine Gerichte – lege welche unter Gerichte an"
        : "Keine Treffer";
      els.dishPickerList.appendChild(empty);
      return;
    }

    filtered.forEach(function (dish) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dish-picker-btn";
      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = dish.name;
      const meta = document.createElement("span");
      meta.className = "item-meta";
      meta.textContent = dishCategoryLabel(dish);
      btn.appendChild(name);
      btn.appendChild(meta);
      btn.addEventListener("click", function () {
        if (!pendingAssignDateKey) return;
        const date = parseDateKey(pendingAssignDateKey);
        const d = findDishById(dish.id);
        if (!d) return;
        closeDishPickerModal(false);
        assignDishToDate(date, d);
      });
      els.dishPickerList.appendChild(btn);
    });
  }

  function getDaysInCalendarMonth() {
    const monthStart = getCalendarMonthStart(calendarMonthOffset);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const days = [];
    const last = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= last; d += 1) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }
    return days;
  }

  function renderHomeCalendar() {
    const monthStart = getCalendarMonthStart(calendarMonthOffset);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    els.calendarMonthLabel.textContent = monthStart.toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric",
    });

    const firstOfMonth = new Date(year, month, 1);
    let padStart = firstOfMonth.getDay();
    padStart = padStart === 0 ? 6 : padStart - 1;

    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - padStart);

    const todayKey = dateKeyFromDate(new Date());
    els.calendarGrid.innerHTML = "";

    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const key = dateKeyFromDate(cellDate);
      const inMonth = cellDate.getMonth() === month;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-cell";
      btn.setAttribute("role", "gridcell");
      if (!inMonth) btn.classList.add("outside-month");
      if (key === todayKey) btn.classList.add("is-today");

      const dayNum = document.createElement("span");
      dayNum.className = "calendar-day-num";
      dayNum.textContent = String(cellDate.getDate());
      btn.appendChild(dayNum);

      const meal = getMealForDate(cellDate);
      if (meal && meal.dishName) {
        const mealEl = document.createElement("span");
        mealEl.className = "calendar-meal";
        mealEl.textContent = meal.dishName;
        btn.appendChild(mealEl);
      }

      const sportWrap = document.createElement("div");
      sportWrap.className = "calendar-sport-lines";
      getKnownSportPersons().forEach(function (name) {
        const entry = getPersonSportEntry(key, name);
        const summary = sportSummaryText(entry);
        if (!summary) return;
        const line = document.createElement("span");
        line.className = "calendar-sport-line " + sportStatusClass(entry);
        line.textContent = name + " " + summary;
        if (isCurrentSportPerson(name) && sportPlanHasValues(entry.plan)) {
          line.classList.add("calendar-sport-line-clickable");
          line.setAttribute("role", "button");
          line.setAttribute("tabindex", "0");
          line.setAttribute("title", "Alles geschafft markieren");
          line.addEventListener("click", function (e) {
            e.stopPropagation();
            handleSportQuickComplete(cellDate, name);
          });
          line.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              handleSportQuickComplete(cellDate, name);
            }
          });
        }
        sportWrap.appendChild(line);
      });
      if (sportWrap.childNodes.length > 0) btn.appendChild(sportWrap);

      btn.addEventListener("click", function () {
        openDayDetailModal(cellDate);
      });
      els.calendarGrid.appendChild(btn);
    }
  }

  function changeCalendarMonth(delta) {
    calendarMonthOffset += delta;
    renderHomeCalendar();
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

  function addFoodToDatabase(name, category, unitKind) {
    const cleanName = normalizeName(name);
    if (!cleanName) return null;
    const existing = findFoodByName(cleanName);
    if (existing) return existing;
    const kind = UNIT_KINDS[unitKind] ? unitKind : inferUnitKind(category, cleanName);
    const food = { id: uid(), name: cleanName, category: category || "Sonstiges", unitKind: kind };
    foods.push(food);
    foods.sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    updateFoodNameSuggestions();
    persistAll();
    return food;
  }

  function deleteFood(id) {
    const food = foods.find(function (f) {
      return f.id === id;
    });
    if (!food) return;
    foods = foods.filter(function (f) {
      return f.id !== id;
    });
    dishes.forEach(function (dish) {
      dish.ingredients.forEach(function (ing) {
        if (ing.foodId === id) ing.foodId = null;
      });
    });
    Object.keys(weeklyShopping).forEach(function (weekKey) {
      weeklyShopping[weekKey] = getWeeklyList(weekKey).filter(function (item) {
        return item.foodId !== id;
      });
    });
    updateFoodNameSuggestions();
    persistAll();
    renderFoods();
    if (activeView === "shopping") renderShoppingList();
    showToast('"' + food.name + '" aus Datenbank entfernt');
  }

  function updateFood(id, name, category, unitKind) {
    const cleanName = normalizeName(name);
    if (!cleanName) return null;
    const food = foods.find(function (f) {
      return f.id === id;
    });
    if (!food) return null;
    const duplicate = foods.find(function (f) {
      return f.id !== id && f.name.toLowerCase() === cleanName.toLowerCase();
    });
    if (duplicate) {
      showToast('"' + cleanName + '" existiert bereits');
      return null;
    }
    const oldName = food.name;
    const kind = UNIT_KINDS[unitKind] ? unitKind : inferUnitKind(category, cleanName);
    food.name = cleanName;
    food.category = category || "Sonstiges";
    food.unitKind = kind;
    Object.keys(weeklyShopping).forEach(function (weekKey) {
      getWeeklyList(weekKey).forEach(function (item) {
        if (item.foodId === id) {
          item.name = cleanName;
        } else if (!item.foodId && item.name.toLowerCase() === oldName.toLowerCase()) {
          item.name = cleanName;
          item.foodId = id;
        }
      });
    });
    dishes.forEach(function (dish) {
      dish.ingredients.forEach(function (ing) {
        if (ing.foodId === id) return;
        if (ing.name && ing.name.toLowerCase() === oldName.toLowerCase()) {
          ing.name = cleanName;
          ing.foodId = id;
        }
      });
    });
    foods.sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    updateFoodNameSuggestions();
    persistAll();
    return food;
  }

  function openFoodEdit(foodId) {
    const food = foods.find(function (f) {
      return f.id === foodId;
    });
    if (!food) return;
    selectedFoodId = foodId;
    els.editFoodName.value = food.name;
    els.editFoodCategory.value = food.category;
    els.editFoodUnitKind.value = food.unitKind || "weight";
    els.foodEditOverlay.classList.remove("hidden");
    els.editFoodName.focus();
  }

  function closeFoodEditModal() {
    els.foodEditOverlay.classList.add("hidden");
    els.editFoodForm.reset();
    selectedFoodId = null;
  }

  function addDish(name, ingredients, diet, temp) {
    const cleanName = normalizeName(name);
    if (!cleanName || !diet || !temp) return null;
    const dish = {
      id: uid(),
      name: cleanName,
      ingredients: ingredients.map(migrateIngredient).filter(Boolean),
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

  function resyncDishOnShoppingLists(dishId) {
    Object.keys(mealPlan).forEach(function (weekKey) {
      DAYS.forEach(function (day) {
        const entry = mealPlan[weekKey] && mealPlan[weekKey][day.key];
        if (entry && entry.dishId === dishId) {
          removeMealPlanIngredientsFromWeeklyList(weekKey, dishId, day.key);
          const dish = findDishById(dishId);
          if (dish) syncDishIngredientsToWeeklyList(dish, weekKey, day.key, day.label);
        }
      });
    });
  }

  function updateDish(id, name, ingredients, diet, temp) {
    const cleanName = normalizeName(name);
    if (!cleanName || !diet || !temp) return null;
    const dish = findDishById(id);
    if (!dish) return null;
    dish.name = cleanName;
    dish.ingredients = ingredients.map(migrateIngredient).filter(Boolean);
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
    resyncDishOnShoppingLists(id);
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
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "home") renderHomeCalendar();
    showToast("Gericht gelöscht");
  }

  function addFoodToWeeklyList(food, amount, unit) {
    const weekKey = weekPlanKey(getWeekStart(weekOffset));
    const list = getWeeklyList(weekKey);
    const unitKind = food.unitKind || "weight";
    if (!isValidUnitForKind(unitKind, unit)) {
      unit = getDefaultUnit(unitKind);
    }
    const baseAmount = toBaseAmount(amount, unit);
    if (baseAmount == null) {
      showToast("Bitte eine gültige Menge eingeben");
      return false;
    }
    list.push({
      id: uid(),
      foodId: food.id,
      name: food.name,
      amount: amount,
      unit: unit,
      checked: false,
      addedAt: Date.now(),
      source: "manual",
    });
    persistAll();
    renderShoppingList();
    showToast(formatQuantity(amount, unit) + " " + food.name + " zur Einkaufsliste hinzugefügt");
    return true;
  }

  function openAddToListModal(food) {
    pendingAddToListFoodId = food.id;
    els.addToListFoodLabel.textContent = food.name;
    els.addToListAmount.value = (
      food.unitKind === "piece" || food.unitKind === "package" || food.unitKind === "bottle"
    ) ? "1" : "";
    populateUnitSelect(els.addToListUnit, food.unitKind, getDefaultUnit(food.unitKind));
    els.addToListOverlay.classList.remove("hidden");
    els.addToListAmount.focus();
  }

  function closeAddToListModal() {
    pendingAddToListFoodId = null;
    els.addToListOverlay.classList.add("hidden");
    els.addToListAmount.value = "";
  }

  function confirmAddToList() {
    if (!pendingAddToListFoodId) return;
    const food = foods.find(function (f) { return f.id === pendingAddToListFoodId; });
    if (!food) return;
    const amount = Number(els.addToListAmount.value);
    const unit = els.addToListUnit.value;
    if (addFoodToWeeklyList(food, amount, unit)) closeAddToListModal();
  }

  function addIngredientToWeeklyList(weekKey, ingredient, dishId, dishName, dayKey, dayLabel) {
    const migrated = migrateIngredient(ingredient);
    if (!migrated || !dishId || !dayKey) return false;
    const list = getWeeklyList(weekKey);
    const exists = list.some(function (item) {
      return (
        !item.checked &&
        item.source === "mealplan" &&
        item.dishId === dishId &&
        item.dayKey === dayKey &&
        item.name.toLowerCase() === migrated.name.toLowerCase()
      );
    });
    if (exists) return false;
    list.push({
      id: uid(),
      name: migrated.name,
      foodId: migrated.foodId,
      amount: migrated.amount,
      unit: migrated.unit,
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

  function shoppingGroupKey(item) {
    const kind = item.unit ? unitKindFromUnit(item.unit) : "unknown";
    return item.name.toLowerCase() + "|" + kind;
  }

  function aggregateShoppingItems(items) {
    const groups = {};
    items.forEach(function (item) {
      const key = shoppingGroupKey(item);
      if (!groups[key]) {
        groups[key] = {
          key: key,
          name: item.name,
          unitKind: item.unit ? unitKindFromUnit(item.unit) : null,
          baseTotal: 0,
          hasAmount: false,
          checked: true,
          itemIds: [],
          sources: [],
        };
      }
      const group = groups[key];
      group.itemIds.push(item.id);
      if (!item.checked) group.checked = false;
      const base = toBaseAmount(item.amount, item.unit);
      if (base != null && group.unitKind) {
        group.baseTotal += base;
        group.hasAmount = true;
      }
      if (item.source === "mealplan" && item.dishName && item.dayLabel) {
        const sourceLabel = item.dishName + ", " + item.dayLabel;
        if (item.amount != null && item.unit) {
          group.sources.push(formatQuantity(item.amount, item.unit) + " für " + sourceLabel);
        } else {
          group.sources.push("für " + sourceLabel);
        }
      }
    });
    return Object.keys(groups).map(function (key) {
      return groups[key];
    });
  }

  function shoppingGroupDisplayName(group) {
    if (group.hasAmount && group.unitKind) {
      const formatted = formatAmountFromBase(group.baseTotal, group.unitKind);
      return formatQuantity(formatted.amount, formatted.unit) + " " + group.name;
    }
    return group.name;
  }

  function sortShoppingGroups(groups) {
    return groups.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
    });
  }

  function getCategorySortIndex(category) {
    const idx = FOOD_CATEGORY_ORDER.indexOf(category);
    return idx === -1 ? FOOD_CATEGORY_ORDER.length : idx;
  }

  function getItemCategory(item) {
    if (item.foodId) {
      const food = foods.find(function (f) {
        return f.id === item.foodId;
      });
      if (food) return food.category;
    }
    const byName = findFoodByName(item.name);
    if (byName) return byName.category;
    return "Sonstiges";
  }

  function appendShoppingGroupRow(list, group, weekKey) {
    const li = document.createElement("li");
    li.className = "item-row" + (group.checked ? " checked" : "");
    const checkboxWrap = document.createElement("label");
    checkboxWrap.className = "checkbox-wrap";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = group.checked;
    checkbox.addEventListener("change", function () {
      const items = getWeeklyList(weekKey);
      items.forEach(function (item) {
        if (group.itemIds.indexOf(item.id) !== -1) item.checked = !group.checked;
      });
      persistAll();
      renderShoppingList();
    });
    checkboxWrap.appendChild(checkbox);

    const textWrap = document.createElement("div");
    textWrap.className = "item-text";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = shoppingGroupDisplayName(group);
    textWrap.appendChild(name);
    if (group.sources.length > 0) {
      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = group.sources.join(" · ");
      textWrap.appendChild(meta);
    }

    const displayName = shoppingGroupDisplayName(group);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-btn";
    removeBtn.setAttribute("aria-label", displayName + " entfernen");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", function () {
      weeklyShopping[weekKey] = getWeeklyList(weekKey).filter(function (item) {
        return group.itemIds.indexOf(item.id) === -1;
      });
      persistAll();
      renderShoppingList();
    });

    li.appendChild(checkboxWrap);
    li.appendChild(textWrap);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }

  function renderShoppingItems(container, emptyEl, items, weekKey) {
    container.innerHTML = "";
    const groups = aggregateShoppingItems(items);
    if (groups.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    const byCategory = {};
    groups.forEach(function (group) {
      const firstItem = items.find(function (item) {
        return group.itemIds.indexOf(item.id) !== -1;
      });
      const category = firstItem ? getItemCategory(firstItem) : "Sonstiges";
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(group);
    });

    const categories = Object.keys(byCategory).sort(function (a, b) {
      return getCategorySortIndex(a) - getCategorySortIndex(b);
    });

    categories.forEach(function (category) {
      const section = document.createElement("section");
      section.className = "shopping-category-group";
      const heading = document.createElement("h3");
      heading.textContent = category;
      section.appendChild(heading);
      const list = document.createElement("ul");
      list.className = "item-list";
      sortShoppingGroups(byCategory[category]).forEach(function (group) {
        appendShoppingGroupRow(list, group, weekKey);
      });
      section.appendChild(list);
      container.appendChild(section);
    });
  }

  function renderShoppingList() {
    const weekKey = weekPlanKey(getWeekStart(weekOffset));
    els.shoppingWeekLabel.textContent = getWeekLabelText();
    renderShoppingItems(
      els.shoppingList,
      els.shoppingEmpty,
      getWeeklyList(weekKey),
      weekKey
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
        const meta = document.createElement("div");
        meta.className = "item-meta";
        const kind = UNIT_KINDS[food.unitKind] || UNIT_KINDS.weight;
        const unitHint = food.unitKind === "package"
          ? "Packung"
          : food.unitKind === "bottle"
            ? "Flasche"
            : kind.units.join(" / ");
        meta.textContent = kind.label + " (" + unitHint + ")";
        info.appendChild(name);
        info.appendChild(meta);
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn-add";
        addBtn.textContent = "+";
        addBtn.setAttribute("aria-label", food.name + " auf Einkaufsliste");
        addBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openAddToListModal(food);
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "icon-btn";
        editBtn.textContent = "✎";
        editBtn.setAttribute("aria-label", food.name + " bearbeiten");
        editBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openFoodEdit(food.id);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "icon-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.setAttribute("aria-label", food.name + " löschen");
        deleteBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (confirm('Lebensmittel "' + food.name + '" wirklich löschen?')) deleteFood(food.id);
        });

        row.appendChild(info);
        row.appendChild(addBtn);
        row.appendChild(editBtn);
        row.appendChild(deleteBtn);
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
      const ing = dish.ingredients.map(ingredientSearchText).join(" ");
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
    resetIngredientEditor(els.addDishIngredientsList);
    els.dishAddOverlay.classList.remove("hidden");
  }

  function closeDishAddModal() {
    els.dishAddOverlay.classList.add("hidden");
    els.addDishForm.reset();
    els.addDishIngredientsList.innerHTML = "";
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
        li.textContent = formatIngredientLabel(ing);
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
    fillIngredientEditor(els.editDishIngredientsList, dish.ingredients);
    setRadioValue("edit-dish-diet", dish.diet);
    setRadioValue("edit-dish-temp", dish.temp);
    els.dishDetailOverlay.classList.add("hidden");
    els.dishEditOverlay.classList.remove("hidden");
  }

  function closeDishEditModal() {
    els.dishEditOverlay.classList.add("hidden");
    els.editDishForm.reset();
    els.editDishIngredientsList.innerHTML = "";
    selectedDishId = null;
  }

  function openDayPicker() {
    const dish = findDishById(selectedDishId);
    if (!dish) return;
    els.dayPickerHint.textContent = '"' + dish.name + '" – welcher Tag im Kalender?';
    els.dayPickerList.innerHTML = "";

    getDaysInCalendarMonth().forEach(function (date) {
      const weekStart = getWeekStartForDate(date);
      const weekKey = weekPlanKey(weekStart);
      const dayKey = getDayKeyFromDate(date);
      const entry = getDayEntry(weekKey, dayKey);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-picker-btn";
      const label = document.createElement("span");
      label.textContent = date.toLocaleDateString("de-DE", { weekday: "long" });
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
        assignDishToDate(date, dish);
      });
      els.dayPickerList.appendChild(btn);
    });
    els.dayPickerOverlay.classList.remove("hidden");
  }

  function closeDayPickerModal() {
    els.dayPickerOverlay.classList.add("hidden");
  }

  function clearDayEntry(weekKey, dayKey) {
    if (!mealPlan[weekKey]) return;
    const entry = getDayEntry(weekKey, dayKey);
    if (entry.dishId) {
      removeMealPlanIngredientsFromWeeklyList(weekKey, entry.dishId, dayKey);
    }
    mealPlan[weekKey][dayKey] = { dishId: "", dishName: "" };
    persistAll();
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "home") renderHomeCalendar();
    showToast("Gericht entfernt");
  }

  function getDayEntry(weekKey, dayKey) {
    if (!mealPlan[weekKey]) mealPlan[weekKey] = {};
    mealPlan[weekKey][dayKey] = migrateMealPlanEntry(mealPlan[weekKey][dayKey]);
    return mealPlan[weekKey][dayKey];
  }

  function renderActiveView() {
    if (activeView === "home") renderHomeCalendar();
    if (activeView === "sport") renderSportView();
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "foods") renderFoods();
    if (activeView === "dishes") renderDishes();
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
    const unitKind = els.newFoodUnitKind.value;
    if (!normalizeName(name)) {
      showToast("Bitte einen Namen eingeben");
      return;
    }
    const food = addFoodToDatabase(name, category, unitKind);
    els.newFoodName.value = "";
    renderFoods();
    showToast(food.name + " in Datenbank gespeichert");
  }

  function handleEditFood(event) {
    event.preventDefault();
    if (!selectedFoodId) return;
    const name = els.editFoodName.value;
    const category = els.editFoodCategory.value;
    const unitKind = els.editFoodUnitKind.value;
    if (!normalizeName(name)) {
      showToast("Bitte einen Namen eingeben");
      return;
    }
    const food = updateFood(selectedFoodId, name, category, unitKind);
    if (!food) return;
    closeFoodEditModal();
    renderFoods();
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "home") renderHomeCalendar();
    showToast('"' + food.name + '" aktualisiert');
  }

  function handleQuickAdd(event) {
    event.preventDefault();
    const query = normalizeName(els.quickAddName.value);
    if (!query) {
      showToast("Bitte ein Lebensmittel eingeben");
      return;
    }
    let food = findFoodByName(query);
    if (!food) {
      const lower = query.toLowerCase();
      food = foods.find(function (f) {
        return f.name.toLowerCase() === lower;
      });
    }
    if (!food) {
      showToast('"' + query + '" nicht gefunden – bitte unter Lebensmittel anlegen');
      return;
    }
    els.quickAddName.value = "";
    openAddToListModal(food);
  }

  function handleAddDish(event) {
    event.preventDefault();
    if (!roomRef) {
      showToast("Bitte zuerst der Gruppe beitreten");
      return;
    }
    const name = els.newDishName.value;
    const ingredients = readIngredientsFromEditor(els.addDishIngredientsList);
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
    if (ingredients.length === 0) {
      showToast("Bitte mindestens eine Zutat hinzufügen");
      return;
    }
    if (!ingredientsHaveAmounts(els.addDishIngredientsList)) {
      showToast("Bitte für jede Zutat eine Menge angeben");
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
    const ingredients = readIngredientsFromEditor(els.editDishIngredientsList);
    const diet = getRadioValue("edit-dish-diet");
    const temp = getRadioValue("edit-dish-temp");
    if (!normalizeName(name) || !diet || !temp) {
      showToast("Bitte alle Felder ausfüllen");
      return;
    }
    if (ingredients.length === 0) {
      showToast("Bitte mindestens eine Zutat behalten");
      return;
    }
    if (!ingredientsHaveAmounts(els.editDishIngredientsList)) {
      showToast("Bitte für jede Zutat eine Menge angeben");
      return;
    }
    const dish = updateDish(selectedDishId, name, ingredients, diet, temp);
    if (!dish) return;
    closeDishEditModal();
    renderDishes();
    if (activeView === "shopping") renderShoppingList();
    if (activeView === "home") renderHomeCalendar();
    showToast('Gericht "' + dish.name + '" aktualisiert');
  }

  async function shareAppLink() {
    const url = getShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: "WG Planung", text: "Tritt unserer WG-Planung bei:", url: url });
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
    els.addDishIngredientRowBtn.addEventListener("click", function () {
      createIngredientEditorRow(els.addDishIngredientsList, null);
    });
    els.editDishIngredientRowBtn.addEventListener("click", function () {
      createIngredientEditorRow(els.editDishIngredientsList, null);
    });
    els.dishAddOverlay.addEventListener("click", function (e) {
      if (e.target === els.dishAddOverlay) closeDishAddModal();
    });
    els.addDishForm.addEventListener("submit", handleAddDish);

    els.closeAddToList.addEventListener("click", closeAddToListModal);
    els.confirmAddToList.addEventListener("click", confirmAddToList);
    els.addToListOverlay.addEventListener("click", function (e) {
      if (e.target === els.addToListOverlay) closeAddToListModal();
    });
    els.addToListAmount.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmAddToList();
      }
    });

    els.addFoodForm.addEventListener("submit", handleAddFood);
    els.editFoodForm.addEventListener("submit", handleEditFood);
    els.closeFoodEdit.addEventListener("click", closeFoodEditModal);
    els.cancelFoodEdit.addEventListener("click", closeFoodEditModal);
    els.foodEditOverlay.addEventListener("click", function (e) {
      if (e.target === els.foodEditOverlay) closeFoodEditModal();
    });
    els.quickAddForm.addEventListener("submit", handleQuickAdd);
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

    document.getElementById("prev-month").addEventListener("click", function () {
      changeCalendarMonth(-1);
    });
    document.getElementById("next-month").addEventListener("click", function () {
      changeCalendarMonth(1);
    });

    document.getElementById("prev-sport-day").addEventListener("click", function () {
      changeSportViewDay(-1);
    });
    document.getElementById("next-sport-day").addEventListener("click", function () {
      changeSportViewDay(1);
    });

    els.sportOpenPlan.addEventListener("click", function () {
      const personName = savePersonName(els.sportPersonName.value);
      if (!personName) {
        showToast("Bitte deinen Namen eintragen");
        els.sportPersonName.focus();
        return;
      }
      openSportPlanModal(ensureSportViewDate(), personName);
    });
    els.sportOpenDone.addEventListener("click", function () {
      const personName = savePersonName(els.sportPersonName.value);
      if (!personName) {
        showToast("Bitte deinen Namen eintragen");
        els.sportPersonName.focus();
        return;
      }
      openSportDoneModal(ensureSportViewDate(), personName);
    });
    els.sportPlanForm.addEventListener("submit", handleSportPlanSubmit);
    els.sportDoneForm.addEventListener("submit", handleSportDoneSubmit);
    els.closeSportPlan.addEventListener("click", closeSportPlanModal);
    els.closeSportDone.addEventListener("click", closeSportDoneModal);
    els.sportPlanOverlay.addEventListener("click", function (e) {
      if (e.target === els.sportPlanOverlay) closeSportPlanModal();
    });
    els.sportDoneOverlay.addEventListener("click", function (e) {
      if (e.target === els.sportDoneOverlay) closeSportDoneModal();
    });
    els.sportPersonName.addEventListener("change", function () {
      savePersonName(els.sportPersonName.value);
      renderSportView();
    });
    els.sportPersonName.addEventListener("blur", function () {
      savePersonName(els.sportPersonName.value);
    });

    els.closeDayDetail.addEventListener("click", closeDayDetailModal);
    els.dayDetailOverlay.addEventListener("click", function (e) {
      if (e.target === els.dayDetailOverlay) closeDayDetailModal();
    });
    els.dayDetailPlanSport.addEventListener("click", function () {
      if (!dayDetailDateKey) return;
      openSportPlanModal(parseDateKey(dayDetailDateKey));
    });
    els.dayDetailAllDone.addEventListener("click", function () {
      if (!dayDetailDateKey) return;
      handleSportQuickComplete(parseDateKey(dayDetailDateKey));
    });
    els.dayDetailPickDish.addEventListener("click", function () {
      if (!dayDetailDateKey) return;
      openDishPickerForDate(parseDateKey(dayDetailDateKey));
    });
    els.dayDetailRemoveDish.addEventListener("click", function () {
      if (!dayDetailDateKey) return;
      if (confirm("Gericht an diesem Tag entfernen?")) {
        clearDayEntryForDate(parseDateKey(dayDetailDateKey));
      }
    });

    els.closeDishPicker.addEventListener("click", closeDishPickerModal);
    els.dishPickerOverlay.addEventListener("click", function (e) {
      if (e.target === els.dishPickerOverlay) closeDishPickerModal();
    });
    els.dishPickerSearch.addEventListener("input", function () {
      renderDishPickerList(els.dishPickerSearch.value);
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
    els.sportPersonName.value = getPersonName();
    setSportViewDate(new Date());
    switchView("home");
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
