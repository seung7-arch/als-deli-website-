// ORDER MANAGEMENT LOGIC
let currentTotal = 0.0;
let orderLines = [];
let custItem = { name: "", price: 0 };

// PRICE BOOK
const PRICE_BOOK = {
  "the bleaker st (only)": 14.00,
  "the bleaker st w/fries": 16.00,
  "the reuben (only)": 14.00,
  "the reuben w/fries": 16.00,
  "bulgogi steak sandwich (only)": 14.00,
  "bulgogi steak sandwich w/fries": 16.00,
  "chicken sandwich (only)": 13.00,
  "chicken sandwich w/fries": 14.50,
  "chicken tenders (5) w/fries": 16.00,
  "chicken nuggets (10) w/fries": 14.00,
  "cheeseburger sub (only)": 16.00,
  "cheeseburger sub w/fries": 18.00,
  "cheeseburger (only)": 13.00,
  "cheeseburger w/fries": 14.50,
  "steak & cheese sub (only)": 14.00,
  "steak & cheese sub w/fries": 16.00,
  "whiting sub (only)": 14.00,
  "whiting sub w/fries": 16.00,
  "salmon burger sub (only)": 14.00,
  "salmon burger sub w/fries": 16.00,
  "tuna sub (only)": 14.00,
  "tuna sub w/fries": 16.00,
  "half smoke": 7.00,
  "cold cut sandwich (only)": 14.00,
  "cold cut sandwich w/fries": 16.00,
  "turkey sub (only)": 14.00,
  "turkey sub w/fries": 16.00,
  "pork chop sandwich w/fries": 15.00,
  "flounder platter": 17.00,
};

function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\(only\)\s*/g, " (only)")
    .replace(/with fries/g, "w/fries");
}

function normalizeBreakfastName(nameRaw) {
  const n = normName(nameRaw);
  const looksLikeBreakfastEgg = n.includes("& egg") && !n.includes("sub") && !n.includes("platter");
  const alreadySandwich = n.includes("sandwich") || n.includes("croissant") || n.includes("blt");
  if (looksLikeBreakfastEgg && !alreadySandwich) {
    return `${String(nameRaw).trim()} Sandwich`;
  }
  return String(nameRaw).trim();
}

// DOM ELEMENTS
const orderList = document.getElementById('order-list');
const emptyState = document.getElementById('empty-state');
const totalDisplay = document.getElementById('total-display');
const checkoutBtn = document.getElementById('checkout-btn');
const cartBadge = document.getElementById('cart-badge');
const viewCartBtn = document.getElementById('view-cart-btn');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');

// MOBILE CART TOGGLE
if (viewCartBtn) {
  viewCartBtn.addEventListener('click', () => {
    cartSidebar.classList.remove('translate-y-full');
  });
}

if (closeCartBtn) {
  closeCartBtn.addEventListener('click', () => {
    cartSidebar.classList.add('translate-y-full');
  });
}

// LOAD ORDER FROM LOCALSTORAGE ON PAGE LOAD
window.addEventListener('DOMContentLoaded', () => {
  const savedOrder = localStorage.getItem('alsDeliOrder');
  if (savedOrder) {
    try {
      const parsed = JSON.parse(savedOrder);
      orderLines = parsed.items || [];
      currentTotal = parsed.total || 0;
      renderOrderList();
    } catch (e) {
      console.error('Failed to load saved order:', e);
    }
  }
});

// SAVE ORDER TO LOCALSTORAGE
function saveOrderToStorage() {
  localStorage.setItem('alsDeliOrder', JSON.stringify({
    items: orderLines,
    total: currentTotal
  }));
}

// ADD ITEM TO CART
function addItemToReceipt(itemName, price, modifiers, quantity = 1) {
  itemName = normalizeBreakfastName(itemName);
  const key = normName(itemName);
  const forcedPrice = PRICE_BOOK[key];
  const numPrice = (typeof forcedPrice === "number") ? forcedPrice : parseFloat(price);
  
  if (isNaN(numPrice) || numPrice <= 0) return;
  
  const qty = quantity > 0 ? quantity : 1;
  const modsArray = Array.isArray(modifiers) ? modifiers : [];
  const modsString = modsArray.sort().join(",");

  const existingItem = orderLines.find(item =>
    item.name === itemName &&
    item.modifiers.sort().join(",") === modsString
  );

  if (existingItem) {
    existingItem.quantity += qty;
  } else {
    orderLines.push({
      name: itemName,
      price: numPrice,
      modifiers: modsArray,
      quantity: qty
    });
  }

  renderOrderList();
  saveOrderToStorage();
}

// REMOVE ITEM
function removeItemFromReceipt(index) {
  if (index > -1 && index < orderLines.length) {
    currentTotal -= (orderLines[index].price * orderLines[index].quantity);
    orderLines.splice(index, 1);
  }
  renderOrderList();
  saveOrderToStorage();
}

// RENDER ORDER LIST
function renderOrderList() {
  orderList.innerHTML = "";
  currentTotal = 0;

  if (orderLines.length === 0) {
    emptyState.classList.remove('hidden');
    checkoutBtn.disabled = true;
    cartBadge.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    checkoutBtn.disabled = false;
    cartBadge.classList.remove('hidden');
    cartBadge.textContent = orderLines.length;
  }

  orderLines.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    currentTotal += lineTotal;

    const li = document.createElement("li");
    li.className = "flex justify-between items-start border border-gray-100 bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow";
    li.style.cursor = "pointer";
    li.onclick = () => {
      if (confirm(`Remove ${item.name} from cart?`)) {
        removeItemFromReceipt(index);
      }
    };

    const modsHtml = item.modifiers.length > 0
      ? `<div class="text-xs text-gray-500 mt-1">+ ${item.modifiers.join(", ")}</div>`
      : "";

    const qtyBadge = item.quantity > 1
      ? `<span class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full mr-2">x${item.quantity}</span>`
      : "";

    li.innerHTML = `
      <div class="pointer-events-none flex-1">
        <div class="flex items-center">
          ${qtyBadge}
          <div class="font-bold text-gray-800 leading-tight">${item.name}</div>
        </div>
        ${modsHtml}
      </div>
      <div class="flex flex-col items-end gap-1 ml-4">
        <div class="font-bold text-gray-900">$${lineTotal.toFixed(2)}</div>
        <div class="text-red-400 text-[10px] font-bold uppercase tracking-wider">Tap to Remove</div>
      </div>
    `;
    orderList.appendChild(li);
  });

  totalDisplay.textContent = "$" + currentTotal.toFixed(2);
}

// CLEAR ORDER
function clearOrder() {
  if (orderLines.length === 0) return;
  
  if (confirm('Clear your entire order?')) {
    orderLines = [];
    currentTotal = 0.0;
    renderOrderList();
    localStorage.removeItem('alsDeliOrder');
  }
}

// GO TO CHECKOUT
function goToCheckout() {
  if (orderLines.length === 0) return;
  
  // Save order to localStorage before navigating
  saveOrderToStorage();
  
  // Navigate to checkout page
  window.location.href = 'checkout.html';
}

// CUSTOMIZER LOGIC
function getCategory(nameRaw) {
  const n = (nameRaw || "").toLowerCase();
  const isComboWithFries = /w\/fries|with fries/.test(n);
  const isSub = /\bsub\b/.test(n);

  const isBreakfastSandwich =
    !n.includes("platter") &&
    (
      n.includes("croissant") ||
      n.includes("blt") ||
      (n.includes("& egg") && n.includes("sandwich") && !isSub) ||
      (n.includes("& egg") && !isSub && !n.includes("cheese sub"))
    );

  const isAllDayBreakfast =
    /pancakes|waffles|french toast|omelette/.test(n) ||
    /bacon & egg platter|sausage & egg platter|ham & egg platter|scrapple & egg platter|turkey bacon platter|turkey sausage platter|beef bacon platter/.test(n);

  const isWings = n.includes("wings") || n.includes("wing zings");
  const isWingPlatter = isWings && n.includes("platter") && isComboWithFries;

  const isSeafoodDinner =
    n.includes("dinner") || n.includes("basket") ||
    (n.includes("platter") && !isAllDayBreakfast && !isWingPlatter) ||
    n.includes("whiting") || n.includes("croaker") || n.includes("tilapia") || n.includes("flounder") ||
    n.includes("shrimp") || n.includes("scallop") || n.includes("seafood") || n.includes("crab") ||
    n.includes("bulgogi & rice") ||
    n.includes("chicken tenders") || n.includes("chicken nuggets");

  const isSidesDrinks =
    n.includes("french fries") || n.includes("home fries") || n.includes("grits") || n.includes("seasonal fruit") ||
    n.includes("soda") || n.includes("coffee") || n.includes("tea/lemonade") || n.includes("juice") ||
    n.includes("gatorade") || n.includes("monster") || n.includes("water") || n === "extra sauce";

  const isSubsAndSandwiches =
    !isBreakfastSandwich && !isAllDayBreakfast && !isWings && !isSeafoodDinner && !isSidesDrinks;

  const noExtraMeatLunch = /chicken tenders|chicken nuggets|salmon burger/.test(n);

  return {
    n, isSub, isComboWithFries, isBreakfastSandwich, isAllDayBreakfast,
    isWings, isWingPlatter, isSeafoodDinner, isSidesDrinks, isSubsAndSandwiches,
    noExtraMeatLunch, isCroissant: n.includes("croissant")
  };
}

function openCustomizer(name, price) {
  custItem = { name, price: parseFloat(price) || 0 };

  document.getElementById("cust-item-name").textContent = custItem.name;
  document.getElementById("cust-item-price").textContent = `$${custItem.price.toFixed(2)}`;

  document.querySelectorAll("#customizer-overlay .chip").forEach(b => b.classList.remove("selected"));
  document.getElementById("cust-notes").value = "";

  const cat = getCategory(name);
  const isReuben = cat.n.includes("reuben");
  const isChickenTendersOrNuggets = cat.n.includes("chicken tenders") || cat.n.includes("chicken nuggets");
  const isWhitingSub = cat.n.includes("whiting sub");
  
  const isSeafoodPlatter = 
    cat.n.includes("whiting platter") || 
    cat.n.includes("tilapia platter") || 
    cat.n.includes("flounder platter") || 
    cat.n.includes("croaker platter") ||
    cat.n.includes("shrimp platter") ||
    cat.n.includes("shrimp basket") ||
    cat.n.includes("scallop platter") ||
    cat.n.includes("combo seafood platter") ||
    cat.n.includes("crab stick");

  toggleSec("sec-breakfast-toppings", cat.isBreakfastSandwich);
  toggleSec("sec-sub-toppings", (cat.isSubsAndSandwiches || isWhitingSub) && !isReuben && !isChickenTendersOrNuggets);
  toggleSec("sec-reuben-note", isReuben);
  toggleSec("sec-seafood-bread", isSeafoodPlatter);

  const showMeatChoice = cat.isAllDayBreakfast && needsPlatterMeatChoice(name);
  toggleSec("sec-meat-choice-platters", showMeatChoice);

  toggleSec("sec-bread", cat.isBreakfastSandwich && !cat.isCroissant);
  toggleSec("sec-toasted", cat.isBreakfastSandwich);
  toggleSec("sec-eggs-sandwich", cat.isBreakfastSandwich);
  toggleSec("sec-bread-upsell", cat.isAllDayBreakfast);
  toggleSec("sec-extra-meat-breakfast", cat.isBreakfastSandwich || cat.isAllDayBreakfast);
  toggleSec("sec-extra-meat-lunch", cat.isSubsAndSandwiches && !cat.noExtraMeatLunch && !isChickenTendersOrNuggets && !isWhitingSub);

  const isFrySide = cat.n.includes("french fries") || cat.n.includes("home fries");
  const showSauces =
    (cat.isSubsAndSandwiches && cat.isComboWithFries && !isChickenTendersOrNuggets) ||
    (isWhitingSub && cat.isComboWithFries) ||
    cat.isWingPlatter ||
    (cat.isWings && !cat.isSidesDrinks) ||
    (cat.isSeafoodDinner && !isChickenTendersOrNuggets) ||
    isSeafoodPlatter ||
    isFrySide ||
    cat.isAllDayBreakfast;

  toggleSec("sec-sauces", showSauces);

  document.getElementById("customizer-overlay").classList.remove("hidden");
}

function needsPlatterMeatChoice(nameRaw) {
  const n = (nameRaw || "").toLowerCase();
  return (
    n.includes("pancakes breakfast") ||
    n.includes("waffles breakfast") ||
    n === "french toast" ||
    n.includes("western omelette")
  );
}

function closeCustomizer() {
  document.getElementById("customizer-overlay").classList.add("hidden");
}

function toggleSec(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function selectStandardSub() {
  const toppings = document.querySelectorAll('[data-group="toppingMulti"]');
  toppings.forEach(btn => btn.classList.add("selected"));
}

function selectStandardBreakfast() {
  const toppings = document.querySelectorAll('[data-group="bfToppingMulti"]');
  toppings.forEach(btn => btn.classList.add("selected"));
}

// CHIP SELECTION
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;

  const overlay = document.getElementById("customizer-overlay");
  if (overlay.classList.contains("hidden")) return;

  const group = btn.getAttribute("data-group");
  const isMulti = btn.getAttribute("data-multi") === "1";
  const billable = btn.getAttribute("data-billable") === "1";

  if (group === "meatChoice") {
    document.querySelectorAll(`.chip[data-group="meatChoice"]`).forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    return;
  }

  if (billable && !group) {
    btn.classList.toggle("selected");
    return;
  }

  if (!group) return;

  if (!isMulti) {
    document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  } else {
    btn.classList.toggle("selected");
  }
});

// ADD CUSTOMIZED ITEM
function addCustomizedItem() {
  const meatSec = document.getElementById("sec-meat-choice-platters");
  const meatRequired = meatSec && !meatSec.classList.contains("hidden");

  if (meatRequired) {
    const chosen = document.querySelector(`#customizer-overlay .chip.selected[data-group="meatChoice"]`);
    if (!chosen) {
      alert("Please choose a meat (Bacon, Sausage, or an upgrade).");
      return;
    }
  }

  const modifiers = [];

  document.querySelectorAll("#customizer-overlay .chip.selected[data-billable='1']").forEach(b => {
    const line = (b.getAttribute("data-line") || "").trim();
    const price = parseFloat(b.getAttribute("data-price") || "0");
    if (line && price > 0) addItemToReceipt(line, price, [], 1);
  });

  document.querySelectorAll("#customizer-overlay .chip.selected:not([data-billable='1'])").forEach(b => {
    const val = (b.getAttribute("data-val") || "").trim();
    if (val) modifiers.push(val);
  });

  const note = document.getElementById("cust-notes").value.trim();
  if (note) modifiers.push(`Note: ${note}`);

  addItemToReceipt(custItem.name, custItem.price, modifiers, 1);

  closeCustomizer();
  
  // Show cart on mobile after adding item
  if (window.innerWidth < 1024) {
    cartSidebar.classList.remove('translate-y-full');
  }
}
