// App State
const state = {
  shop: {
    type: "provision",
    name: "Dream Big Shop",
    location: "Your Location",
    phone: "024XXXXXXX",
    email: "",
    lowStockThreshold: 10,
    discount: {
      enabled: false,
      type: "percentage",
      value: 0,
      reason: "",
    },
  },
  staff: [],
  currentStaff: null,
  staffSessionTime: null,
  products: [],
  cart: [],
  transactions: [],
  stockHistory: [],
  selectedProducts: new Set(),
  selectedStaff: new Set(), // Track selected staff
  dailyHistory: [], // NEW: Stores daily summaries
  currentDate: new Date().toDateString(), // NEW: Tracks current date
  passcode: "1234", // Default passcode
  isAuthenticated: false,
  heldCarts: [],
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SHOP_CATEGORIES = {
  provision: [
    "Drinks",
    "Snacks",
    "Food",
    "Groceries",
    "Bread",
    "Dairy",
    "Beverages",
  ],
  pharmacy: [
    "Tablets",
    "Injections",
    "Capsules",
    "Tropicals",
    "Suspensions",
    "Drops",
    "Infusions",
    "Laboratory",
    "Others",
  ],
  electronics: [
    "Mobile Phones",
    "Laptops",
    "Accessories",
    "Chargers",
    "Cables",
    "Batteries",
  ],
  clothing: [
    "Men's Wear",
    "Women's Wear",
    "Children's Wear",
    "Shoes",
    "Accessories",
  ],
  hardware: [
    "Tools",
    "Paint",
    "Building Materials",
    "Fixtures",
    "Safety Gear",
    "Electrical",
  ],
  bakery: ["Bread", "Pastries", "Cakes", "Cookies", "Buns", "Doughnuts"],
  beauty: [
    "Skincare",
    "Makeup",
    "Hair Care",
    "Fragrances",
    "Body Care",
    "Nail Care",
  ],
  general: [
    "Drinks",
    "Snacks",
    "Food",
    "Toiletries",
    "Clothing",
    "Accessories",
  ],
};

const STAFF_ROLES_BY_SHOP_TYPE = {
  provision: [
    "Shop Attendant",
    "Cashier",
    "Stock Manager",
    "Sales Representative",
  ],
  pharmacy: [
    "Pharmacist",
    "Pharmacy Technician",
    "Pharmacy Assistant",
    "Nurse",
    "Head Nurse",
    "Nursing Assistant",
    "Manager",
  ],
  electronics: [
    "Sales Associate",
    "Technical Support",
    "Cashier",
    "Inventory Specialist",
  ],
  clothing: [
    "Sales Associate",
    "Fashion Consultant",
    "Cashier",
    "Stock Manager",
  ],
  hardware: [
    "Sales Associate",
    "Technical Assistant",
    "Cashier",
    "Warehouse Manager",
  ],
  bakery: ["Baker", "Sales Assistant", "Cashier", "Quality Inspector"],
  beauty: ["Beauty Consultant", "Sales Associate", "Cashier", "Stock Manager"],
  general: [
    "Shop Attendant",
    "Cashier",
    "Sales Representative",
    "Stock Manager",
  ],
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  state.cart = []; // Clear cart on each fresh page load
  // Clear staff session on page load — user must re-login
  state.currentStaff = null;
  state.staffSessionTime = null;
  saveState();
  loadSettings();
  updateShopCategories();
  renderStaffTable();
  renderInventory();
  renderPOS();
  updateDashboard();
  loadDefaultProducts();
  updateStaffUI();

  updateHeldCartsBadge();
  showSection("pos");
});

// State Management
function loadState() {
  const saved = localStorage.getItem("shopManagerState");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Deep-merge shop so new default properties (discount, etc.) are not lost
      if (parsed.shop) {
        parsed.shop = { ...state.shop, ...parsed.shop };
      }
      Object.assign(state, parsed);
    } catch (e) {
      console.error("[v0] Failed to load state:", e);
    }
  }
  // Normalize critical fields to prevent silent data loss from old or corrupted saves
  if (!Array.isArray(state.transactions)) state.transactions = [];
  if (!Array.isArray(state.dailyHistory)) state.dailyHistory = [];
  if (!Array.isArray(state.stockHistory)) state.stockHistory = [];
  if (!Array.isArray(state.heldCarts)) state.heldCarts = [];
  if (!state.currentDate || typeof state.currentDate !== "string") {
    state.currentDate = new Date().toDateString();
  }
}

function saveState() {
  try {
    localStorage.setItem("shopManagerState", JSON.stringify(state));
  } catch (e) {
    console.error("[v0] Failed to save state:", e);
    alert("Failed to save data to local storage. Please check your browser storage settings.");
  }
}

// UI Functions
let pendingSectionId = null;

function showSection(sectionId) {
  const protectedSections = [
    "dashboard",
    "inventory",
    "transactions",
    "staff",
    "settings",
    "saleshistory",
    "monthlyreport",
  ];

  if (protectedSections.includes(sectionId)) {
    pendingSectionId = sectionId;
    openModal("passcodeModal");
    document.getElementById("passcodeInput").value = "";
    document.getElementById("passcodeInput").focus();
    return;
  }

  if (sectionId === "pos" && !checkStaffSession()) {
    openStaffLogin();
    return;
  }

  document
    .querySelectorAll(".section")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) section.classList.add("active");

  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    if (item.textContent.toLowerCase().includes(sectionId)) {
      item.classList.add("active");
    }
  });

  const titles = {
    dashboard: "Dashboard", pos: "Point of Sale", inventory: "Stock Management",
    transactions: "Transaction History", staff: "Staff Management",
    settings: "Shop Settings", saleshistory: "Sales History",
    monthlyreport: "Monthly Report",
  };
  document.getElementById("pageTitle").textContent = titles[sectionId] || "ShopManager";
  if (sectionId === "pos") { touchStaffSession(); renderPOS(); updateCart(); }
  else if (sectionId === "inventory") renderInventory();
  else if (sectionId === "transactions") renderTransactions();
  else if (sectionId === "staff") renderStaffTable();
  else if (sectionId === "settings") loadSettings();
  else if (sectionId === "dashboard") updateDashboard();
  else if (sectionId === "saleshistory") renderSalesHistory();
  else if (sectionId === "monthlyreport") renderMonthlyReport();
}

function completeSale() {
  if (state.cart.length === 0) {
    alert("Cart is empty!");
    return;
  }
  if (!checkStaffSession()) {
    alert("Session expired. Please login again.");
    openStaffLogin();
    return;
  }
  touchStaffSession();
  // Defensive: ensure transactions is a valid array
  if (!Array.isArray(state.transactions)) {
    state.transactions = [];
  }

  // For cash: validate customer payment amount is entered and sufficient
  if (currentPaymentMethod === "cash") {
    const cashGiven = Number.parseFloat(
      document.getElementById("customerPaymentAmount").value
    );
    if (!cashGiven || cashGiven <= 0) {
      alert("Please enter the amount given by the customer.");
      document.getElementById("customerPaymentAmount").focus();
      return;
    }
    // Calculate total first to validate
    const sub = state.cart.reduce((s, item) => s + Number.parseFloat(item.price || 0) * item.quantity, 0);
    let discAmt = 0;
    const sd = state.shop.discount;
    if (sd && sd.enabled && sd.value > 0) {
      discAmt = sd.type === "percentage" ? sub * (sd.value / 100) : Number.parseFloat(sd.value || 0);
    }
    const estimatedTotal = sub - discAmt;
    if (cashGiven < estimatedTotal) {
      alert(`Insufficient payment. Total is GHS ${estimatedTotal.toFixed(2)}, but customer gave GHS ${cashGiven.toFixed(2)}.`);
      document.getElementById("customerPaymentAmount").focus();
      return;
    }
  }

  let paymentMethod = currentPaymentMethod || "cash";

  // Build complete payment method string for display
  if (currentPaymentMethod === "mobile_money" && currentMobileMoneyProvider) {
    paymentMethod = `mobile_money_${currentMobileMoneyProvider}`;
  } else if (currentPaymentMethod === "bank" && currentBank) {
    paymentMethod = `bank_${currentBank}`;
  }

  const subtotal = state.cart.reduce(
    (sum, item) => sum + Number.parseFloat(item.price || 0) * item.quantity,
    0
  );

  let discountAmount = 0;
  let discountType = "percentage";
  let discountVal = 0;
  let discountReason = "";

  const shopDiscount = state.shop.discount;

  if (shopDiscount && shopDiscount.enabled && shopDiscount.value > 0) {
    discountType = shopDiscount.type;
    discountVal = shopDiscount.value;
    discountReason = shopDiscount.reason || "";
    if (shopDiscount.type === "percentage") {
      discountAmount = subtotal * (shopDiscount.value / 100);
    } else {
      discountAmount = Number.parseFloat(shopDiscount.value || 0);
    }
  }

  const total = subtotal - discountAmount;

  const customerPayment =
    currentPaymentMethod === "cash"
      ? Number.parseFloat(
          document.getElementById("customerPaymentAmount").value
        ) || 0
      : 0;
  const change = customerPayment > 0 ? customerPayment - total : 0;

  const transaction = {
    id: Date.now(),
    date: new Date().toISOString(),
    attendant: state.currentStaff,
    paymentMethod,
    items: state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
    })),
    subtotal,
    discount: {
      type: discountType,
      value: discountVal,
      reason: discountReason,
      amount: discountAmount,
    },
    total,
    customerPayment,
    change,
  };

  state.transactions.push(transaction);

  // Update stock
  state.cart.forEach((item) => {
    const product = state.products.find((p) => p.id === item.id);
    if (product) {
      const oldStock = product.quantity;
      product.quantity -= item.quantity;
      if (product.quantity < 0) product.quantity = 0;

      // Use the new recordStockChange function here
      recordStockChange(
        product.id,
        product.name,
        "Sold",
        item.quantity,
        oldStock,
        product.quantity,
        `Transaction ID: ${transaction.id}`
      );
    }
  });

  saveState();
  generateReceipt(transaction);
  state.cart = [];
  document.getElementById("customerPaymentAmount").value = "";
  document.getElementById("changeDisplay").style.display = "none";
  updateCart();
  renderPOS();
  updateDashboard();

  // Diagnostic: confirm transaction was saved
  const statusEl = document.getElementById("saleStatus");
  if (statusEl) {
    const count = state.transactions.length;
    const saved = localStorage.getItem("shopManagerState");
    const parsed = saved ? JSON.parse(saved) : null;
    const savedCount = parsed?.transactions?.length || 0;
    const lastTx = count > 0 ? state.transactions[count - 1] : null;
    const lastId = lastTx ? lastTx.id : "none";
    const ok = count > 0 && savedCount >= count;
    statusEl.textContent = ok
      ? `✓ ${count} tx(s) | last: ${lastId}`
      : `✗ mem:${count} storage:${savedCount}`;
    statusEl.style.color = ok ? "var(--success)" : "var(--danger)";
    // Auto-clear after 6 seconds
    if (window._saleStatusTimer) clearTimeout(window._saleStatusTimer);
    window._saleStatusTimer = setTimeout(() => { statusEl.textContent = ""; }, 6000);
  }
}

function generateReceipt(transaction) {
  if (!transaction || !transaction.items) {
    console.error("[v0] Invalid transaction");
    return;
  }

  const date = new Date(transaction.date);
  let receipt = `${"=".repeat(35)}\n`;
  receipt += `${(state.shop.name || "MY SHOP").toUpperCase()}\n`;
  receipt += `${state.shop.location || "Ghana"}\n`;
  receipt += `📞 ${state.shop.phone || "024XXXXXXX"}\n`;
  receipt += `${"=".repeat(35)}\n`;
  receipt += `Receipt #: ${transaction.id}\n`;
  receipt += `Date: ${date.toLocaleDateString("en-GH")}\n`;
  receipt += `Time: ${date.toLocaleTimeString()}\n`;
  receipt += `Attendant: ${transaction.attendant || "N/A"}\n`;
  receipt += `${"=".repeat(35)}\n`;
  receipt += `ITEMS:\n`;
  receipt += `${"-".repeat(35)}\n`;

  transaction.items.forEach((item) => {
    const name = (item.name || "Product").padEnd(15);
    const qty = item.quantity || 1;
    const price = Number.parseFloat(item.price || 0);
    const total = (qty * price).toFixed(2);
    receipt += `${name} x${qty}\n`;
    receipt += `  GHS${price.toFixed(2)} × ${qty} = GHS${total}\n`;
  });

  receipt += `${"=".repeat(35)}\n`;
  receipt += `Subtotal............GHS${(transaction.subtotal || 0).toFixed(
    2
  )}\n`;

  if (transaction.discount && transaction.discount.amount > 0) {
    const discountText =
      transaction.discount.type === "percentage"
        ? `${transaction.discount.value}%`
        : "Fixed";
    receipt += `Discount (${discountText}).....-GHS${(
      transaction.discount.amount || 0
    ).toFixed(2)}\n`;
    if (transaction.discount.reason) {
      receipt += `  (${transaction.discount.reason})\n`;
    }
  }

  receipt += `${"=".repeat(35)}\n`;
  receipt += `TOTAL...............GHS${(transaction.total || 0).toFixed(2)}\n`;
  receipt += `Payment Method.....${(
    transaction.paymentMethod || "cash"
  ).toUpperCase()}\n`;

  if (transaction.customerPayment > 0) {
    receipt += `Customer Paid.......GHS${transaction.customerPayment.toFixed(
      2
    )}\n`;
    receipt += `Change Given........GHS${Math.max(
      0,
      transaction.change || 0
    ).toFixed(2)}\n`;
  }

  receipt += `${"=".repeat(35)}\n`;
  receipt += `Thank you for your purchase!\n`;
  receipt += `${new Date().toLocaleDateString("en-GH")}\n`;

  document.getElementById("receiptContent").textContent = receipt;
  openModal("receiptModal");
}

// Inventory
function renderInventory() {
  const table = document.getElementById("inventoryTable");

  if (state.products.length === 0) {
    table.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 20px;">No products yet. Add one to get started!</td></tr>';
    return;
  }

  table.innerHTML = state.products
    .map(
      (p) => `
    <tr>
      <td><input type="checkbox" class="item-checkbox" value="${p.id}" onchange="updateMultiDeleteBtn()" /></td>
      <td><strong>${p.name || "Unknown"}</strong></td>
      <td>${p.category || "N/A"}</td>
      <td>GHS${(p.price || 0).toFixed(2)}</td>
      <td><strong>${p.quantity}</strong></td>
      <td>
        ${
          p.quantity < (p.minStock || state.shop.lowStockThreshold || 10)
            ? '<span style="color: var(--danger);">⚠️ Low Stock</span>'
            : '<span style="color: var(--success);">✓ OK</span>'
        }
      </td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editProduct(${
          p.id
        })">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${
          p.id
        })">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function filterInventory() {
  const search = document.getElementById("inventorySearch").value.toLowerCase();
  document.querySelectorAll("#inventoryTable tr").forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(search) ? "" : "none";
  });
}

function deleteProduct(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (confirm(`Delete "${product?.name}"? This cannot be undone.`)) {
    const oldStock = product.quantity;
    state.products = state.products.filter((p) => p.id !== productId);

    // Use the new recordStockChange function here
    recordStockChange(
      productId,
      product.name,
      "Removed",
      oldStock,
      oldStock,
      0,
      "Product deleted from inventory."
    );

    saveState();
    renderInventory();
    renderPOS();
  }
}

function openAddProductModal() {
  openModal("addProductModal");
}

function addProduct(e) {
  e.preventDefault();

  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("productCategory").value;
  const price = Number.parseFloat(
    document.getElementById("productPrice").value
  );
  const quantity = Number.parseInt(
    document.getElementById("productStock").value
  );
  const minStock = Number.parseInt(
    document.getElementById("productMinStock").value
  );
  const maxStock = document.getElementById("productMaxStock").value
    ? Number.parseInt(document.getElementById("productMaxStock").value)
    : null;

  if (!name || !price || !quantity) {
    alert("Please fill in all fields");
    return;
  }

  const product = {
    id: Date.now(),
    name,
    category,
    price,
    quantity,
    minStock,
    maxStock, // Can be null if not provided
  };

  state.products.push(product);

  // Use the new recordStockChange function here
  recordStockChange(
    product.id,
    product.name,
    "Added",
    quantity,
    0,
    quantity,
    `Initial stock added.`
  );

  saveState();
  document.getElementById("addProductModal").querySelector("form").reset();
  closeModal("addProductModal");
  renderInventory();
  renderPOS();
  updateDashboard();
  alert(`✓ Product added: ${name}`);
}

// Staff
function renderStaffTable() {
  const table = document.getElementById("staffTable");

  if (state.staff.length === 0) {
    table.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 20px;">No staff added yet</td></tr>';
    return;
  }

  table.innerHTML = state.staff
    .map(
      (s) => `
    <tr>
      <td><input type="checkbox" class="staff-checkbox" value="${s.id}" onchange="updateMultiDeleteStaffBtn()" /></td>
      <td><strong>${s.name || "Unknown"}</strong></td>
      <td>${s.role || "N/A"}</td>
      <td>${s.phone || "N/A"}</td>
      <td>${new Date(s.joinDate).toLocaleDateString() || "N/A"}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editStaff(${
          s.id
        })" style="margin-right:4px">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteStaff(${
          s.id
        })">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");

}

const STAFF_TIMEOUT = 5 * 60 * 1000; // 5 min inactivity

function checkStaffSession() {
  if (!state.currentStaff || !state.staffSessionTime) { clearStaffSession(); return false; }
  const sessionDay = new Date(state.staffSessionTime).toDateString();
  if (sessionDay !== new Date().toDateString()) { clearStaffSession(); return false; }
  if (Date.now() - state.staffSessionTime > STAFF_TIMEOUT) { clearStaffSession(); return false; }
  return true;
}

function clearStaffSession() {
  state.currentStaff = null;
  state.staffSessionTime = null;
  saveState();
  updateStaffUI();
}

function touchStaffSession() {
  if (state.currentStaff) {
    state.staffSessionTime = Date.now();
    saveState();
  }
}

function updateStaffUI() {
  const isLoggedIn = !!state.currentStaff;
  document.getElementById("userBtn").style.display = isLoggedIn ? "none" : "";
  document.getElementById("logoutBtn").style.display = isLoggedIn ? "" : "none";
  document.getElementById("staffName").textContent = state.currentStaff || "Select Staff";
}

function loginStaff() {
  const select = document.getElementById("staffLoginSelect");
  const passcode = document.getElementById("staffLoginPasscode").value.trim();
  if (!select.value) { alert("Select your name from the dropdown"); return; }
  if (!passcode) { alert("Enter your passcode"); return; }

  const staff = state.staff.find(s => s.id === parseInt(select.value));
  if (!staff) { alert("Staff member not found"); return; }
  if (staff.passcode !== passcode) { alert("Incorrect passcode"); return; }

  state.currentStaff = staff.name;
  state.staffSessionTime = Date.now();
  saveState();
  updateStaffUI();
  document.getElementById("staffLoginPasscode").value = "";
  select.value = "";
  document.getElementById("staffLoginPasscodeGroup").style.display = "none";
  closeModal("staffLoginModal");
  renderPOS();
  updateCart();
}

function onStaffSelectChange() {
  const select = document.getElementById("staffLoginSelect");
  const group = document.getElementById("staffLoginPasscodeGroup");
  if (select.value) {
    group.style.display = "block";
    document.getElementById("staffLoginPasscode").focus();
  } else {
    group.style.display = "none";
    document.getElementById("staffLoginPasscode").value = "";
  }
}

function loginAsManager() {
  const passcode = document.getElementById("staffLoginPasscode2").value.trim();
  if (!passcode) { alert("Enter the manager passcode"); return; }
  if (passcode !== state.passcode) { alert("Incorrect manager passcode"); return; }

  state.currentStaff = "Manager";
  state.staffSessionTime = Date.now();
  saveState();
  updateStaffUI();
  document.getElementById("staffLoginPasscode2").value = "";
  closeModal("staffLoginModal");
  renderPOS();
  updateCart();
}

function logoutStaff() {
  state.currentStaff = null;
  state.staffSessionTime = null;
  saveState();
  updateStaffUI();
  renderPOS();
  updateCart();
}

function openStaffLogin() {
  renderStaffLoginList();
  document.getElementById("staffLoginPasscode").value = "";
  document.getElementById("staffLoginPasscode2").value = "";
  document.getElementById("staffLoginPasscodeGroup").style.display = "none";
  openModal("staffLoginModal");
}

function openAddStaffModal() {
  openModal("addStaffModal");
}

function addStaff(e) {
  e.preventDefault();

  const name = document.getElementById("staffFullName").value.trim();
  const role = document.getElementById("staffRole").value;
  const phone = document.getElementById("staffPhone").value.trim();
  const passcode = document.getElementById("staffPasscode").value.trim();

  if (!name || !role || !phone || !passcode) {
    alert("Please fill in all fields");
    return;
  }

  if (passcode.length < 4) {
    alert("Passcode must be at least 4 characters");
    return;
  }

  const staff = {
    id: Date.now(),
    name,
    role,
    phone,
    passcode,
    joinDate: new Date().toISOString(),
  };

  state.staff.push(staff);
  saveState();
  document.getElementById("addStaffModal").querySelector("form").reset();
  closeModal("addStaffModal");
  renderStaffTable();
  alert(`✓ Staff member added: ${name}`);
}

function editStaff(staffId) {
  const staff = state.staff.find(s => s.id === staffId);
  if (!staff) return;
  document.getElementById("editStaffId").value = staff.id;
  document.getElementById("editStaffFullName").value = staff.name;
  document.getElementById("editStaffRole").value = staff.role;
  document.getElementById("editStaffPhone").value = staff.phone;
  document.getElementById("editStaffPasscode").value = "";
  openModal("editStaffModal");
}

function saveStaffEdit(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById("editStaffId").value);
  const name = document.getElementById("editStaffFullName").value.trim();
  const role = document.getElementById("editStaffRole").value;
  const phone = document.getElementById("editStaffPhone").value.trim();
  const passcode = document.getElementById("editStaffPasscode").value.trim();

  const staff = state.staff.find(s => s.id === id);
  if (!staff) return;

  staff.name = name;
  staff.role = role;
  staff.phone = phone;
  if (passcode) {
    if (passcode.length < 4) { alert("Passcode must be at least 4 characters"); return; }
    staff.passcode = passcode;
  }

  saveState();
  closeModal("editStaffModal");
  renderStaffTable();
  alert(`✓ Staff member updated: ${name}`);
}

function deleteStaff(staffId) {
  const staff = state.staff.find((s) => s.id === staffId);
  if (confirm(`Remove ${staff?.name}?`)) {
    state.staff = state.staff.filter((s) => s.id !== staffId);
    if (state.currentStaff === staff?.name) {
      state.currentStaff = null;
      state.staffSessionTime = null;
      saveState();
      updateStaffUI();
    } else {
      saveState();
    }
    renderStaffTable();
  }
}

// Transactions
function renderTransactions() {
  const table = document.getElementById("transactionsTable");

  // Collect all transactions (archived daily history first, then today's)
  const allTransactions = [];
  state.dailyHistory.forEach(day => {
    if (day.transactions) {
      day.transactions.forEach(t => allTransactions.push(t));
    }
  });
  state.transactions.forEach(t => allTransactions.push(t));

  // Apply filters
  const dateFilter = document.getElementById("transactionDate")?.value;
  const paymentFilter = document.getElementById("transactionFilter")?.value;
  let filtered = allTransactions;
  if (dateFilter) {
    filtered = filtered.filter(t => {
      try { return new Date(t.date).toISOString().slice(0, 10) === dateFilter; } catch(e) { return false; }
    });
  }
  if (paymentFilter) {
    filtered = filtered.filter(t => (t.paymentMethod || "cash").includes(paymentFilter));
  }

  if (filtered.length === 0) {
    table.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 20px;">No transactions match the selected filters</td></tr>';
    return;
  }

  try {
    table.innerHTML = filtered
      .slice()
      .reverse()
      .map(
        (t) => {
          const dateStr = (() => { try { return new Date(t.date).toLocaleString("en-GH"); } catch(e) { return "Invalid date"; } })();
          const receiptHtml = JSON.stringify(t).replace(/'/g, "&apos;");
          return `
    <tr>
      <td>${dateStr}</td>
      <td>${t.id}</td>
      <td>${t.attendant || "N/A"}</td>
      <td>${(t.paymentMethod || "cash").toUpperCase()}</td>
      <td>GHS${(t.total || 0).toFixed(2)}</td>
      <td>${(t.items || []).length}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick='generateReceipt(${receiptHtml})'>View</button>
      </td>
    </tr>
  `;
        }
      )
      .join("");
  } catch (e) {
    table.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger)">Error rendering transactions: ' + e.message + '</td></tr>';
  }

}

function viewDayReport(dayData) {
  if (!dayData || !dayData.transactions) {
    alert("No transaction data available");
    return;
  }
  const reportHTML = `
    <div style="padding: 20px; background: var(--bg-primary); border-radius: 12px; margin-top: 20px; border: 2px solid var(--primary);">
      <h3 style="margin-top: 0;">📊 Sales Report - ${dayData.date}</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border-left: 4px solid var(--primary);">
          <div style="font-size: 12px; color: var(--text-secondary);">Total Sales</div>
          <div style="font-size: 20px; font-weight: 700; color: var(--primary);">GHS${(dayData.totalSales || 0).toFixed(2)}</div>
        </div>
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border-left: 4px solid var(--success);">
          <div style="font-size: 12px; color: var(--text-secondary);">Transactions</div>
          <div style="font-size: 20px; font-weight: 700; color: var(--success);">${dayData.totalTransactions}</div>
        </div>
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border-left: 4px solid var(--warning);">
          <div style="font-size: 12px; color: var(--text-secondary);">Items Sold</div>
          <div style="font-size: 20px; font-weight: 700; color: var(--warning);">${dayData.totalItems}</div>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Attendant</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(dayData.transactions || []).map(t => `
              <tr>
                <td>${new Date(t.date).toLocaleTimeString()}</td>
                <td>${t.attendant || "N/A"}</td>
                <td>${t.items?.length || 0}</td>
                <td>${(t.paymentMethod || "cash").replace(/_/g, " ")}</td>
                <td>GHS${(t.total || 0).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <button class="btn btn-outline" onclick="document.getElementById('dayReport').innerHTML=''" style="margin-top: 12px;">Close Report</button>
    </div>
  `;
  const reportDiv = document.getElementById("dayReport");
  if (reportDiv) {
    reportDiv.innerHTML = reportHTML;
    reportDiv.scrollIntoView({ behavior: "smooth" });
  }
}

// POS
function filterProducts() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  document.querySelectorAll(".product-card").forEach((card) => {
    const name = card.textContent.toLowerCase();
    card.style.display = name.includes(search) ? "" : "none";
  });
}

function renderPOS() {
  const grid = document.getElementById("productsGrid");
  const filter = document.getElementById("posCategoryFilter");
  if (!grid || !filter) return;

  // Populate category filter
  const categories = [...new Set(state.products.map((p) => p.category).filter(Boolean))];
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentVal) opt.selected = true;
    filter.appendChild(opt);
  });

  const selectedCategory = filter.value;

  let products = state.products;
  if (selectedCategory !== "all") {
    products = products.filter((p) => p.category === selectedCategory);
  }

  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state">No products found</div>';
    return;
  }

  grid.innerHTML = products
    .map(
      (p) => {
        const isLow = p.quantity < (p.minStock || state.shop.lowStockThreshold || 10);
        return `
    <div class="product-card${isLow ? " low-stock" : ""}" onclick="addToCart(${p.id})">
      <div class="product-name">${p.name}</div>
      <div class="product-price">GHS ${(p.price || 0).toFixed(2)}</div>
      <div class="product-stock">Stock: ${p.quantity}</div>
    </div>
  `;
      }
    )
    .join("");
}

function addToCart(productId) {
  touchStaffSession();
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  if (product.quantity <= 0) {
    alert("Product is out of stock");
    return;
  }

  const existing = state.cart.find((item) => item.id === productId);
  if (existing) {
    if (existing.quantity >= product.quantity) {
      alert("Not enough stock available");
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }

  saveState();
  updateCart();
}

function removeFromCart(index) {
  touchStaffSession();
  if (index >= 0 && index < state.cart.length) {
    state.cart.splice(index, 1);
    saveState();
    updateCart();
  }
}

function updateCart() {
  const container = document.getElementById("cartItems");
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = '<div class="empty-state">Cart is empty</div>';
    updateCartTotals();
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item, index) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">GHS ${(item.price * item.quantity).toFixed(2)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="btn btn-sm btn-outline" onclick="removeFromCart(${index})">✕</button>
      </div>
    </div>
  `
    )
    .join("");

  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = state.cart.reduce(
    (sum, item) => sum + Number.parseFloat(item.price || 0) * item.quantity,
    0
  );

  let discountAmount = 0;
  const shopDiscount = state.shop.discount;
  if (shopDiscount && shopDiscount.enabled && shopDiscount.value > 0) {
    if (shopDiscount.type === "percentage") {
      discountAmount = subtotal * (shopDiscount.value / 100);
    } else {
      discountAmount = Number.parseFloat(shopDiscount.value || 0);
    }
  }

  const total = subtotal - discountAmount;

  document.getElementById("subtotal").textContent = `GHS ${subtotal.toFixed(2)}`;
  document.getElementById("discountAmount").textContent = `GHS ${discountAmount.toFixed(2)}`;
  document.getElementById("cartTotal").textContent = `GHS ${total.toFixed(2)}`;

  calculateChange();
}

function clearCart() {
  touchStaffSession();
  state.cart = [];
  updateCart();
}

// Hold Cart Feature
function holdCart() {
  touchStaffSession();
  if (state.cart.length === 0) {
    alert("Cart is empty — nothing to hold.");
    return;
  }

  const held = {
    id: Date.now(),
    items: JSON.parse(JSON.stringify(state.cart)),
    date: new Date().toLocaleString(),
  };

  state.heldCarts.push(held);
  state.cart = [];
  saveState();
  updateCart();
  updateHeldCartsBadge();
  alert("✓ Cart held successfully!");
}

function updateHeldCartsBadge() {
  const badge = document.getElementById("heldCartsBadge");
  if (badge) {
    badge.textContent = state.heldCarts.length;
  }
}

function openHeldCartsModal() {
  renderHeldCarts();
  openModal("heldCartsModal");
}

function renderHeldCarts() {
  const list = document.getElementById("heldCartsList");
  if (!list) return;

  if (state.heldCarts.length === 0) {
    list.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary)">No held carts.</p>';
    return;
  }

  list.innerHTML = state.heldCarts
    .map(
      (cart, index) => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong>Cart #${index + 1}</strong>
        <small style="color:var(--text-secondary)">${cart.date}</small>
      </div>
      <div style="font-size:13px;margin-bottom:8px;color:var(--text-secondary)">
        ${cart.items.length} item(s) — GHS ${cart.items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0).toFixed(2)}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-primary" onclick="restoreHeldCart(${index})">Restore</button>
        <button class="btn btn-sm btn-danger" onclick="deleteHeldCart(${index})">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

function restoreHeldCart(index) {
  if (index >= 0 && index < state.heldCarts.length) {
    state.cart = JSON.parse(JSON.stringify(state.heldCarts[index].items));
    state.heldCarts.splice(index, 1);
    saveState();
    updateCart();
    updateHeldCartsBadge();
    closeModal("heldCartsModal");
    alert("✓ Cart restored!");
  }
}

function deleteHeldCart(index) {
  if (index >= 0 && index < state.heldCarts.length) {
    if (confirm("Delete this held cart?")) {
      state.heldCarts.splice(index, 1);
      saveState();
      renderHeldCarts();
      updateHeldCartsBadge();
    }
  }
}

// Dashboard
function updateDashboard() {
  const totalSales = state.transactions.reduce((sum, t) => sum + (t.total || 0), 0);
  const todayTx = state.transactions.length;
  const lowStock = state.products.filter((p) => p.quantity < (p.minStock || state.shop.lowStockThreshold || 10)).length;
  const totalProducts = state.products.length;

  const salesEl = document.getElementById("todaySales");
  const txEl = document.getElementById("transCount");
  const lowEl = document.getElementById("lowStockCount");
  const prodEl = document.getElementById("productCount");

  if (salesEl) salesEl.textContent = `GHS ${totalSales.toFixed(2)}`;
  if (txEl) txEl.textContent = todayTx;
  if (lowEl) lowEl.textContent = lowStock;
  if (prodEl) prodEl.textContent = totalProducts;

  // Recent transactions
  const recentEl = document.getElementById("recentTransactions");
  if (recentEl) {
    if (state.transactions.length === 0) {
      recentEl.innerHTML = '<tr><td colspan="5" class="empty-state">No transactions yet</td></tr>';
    } else {
      const recent = state.transactions.slice().reverse().slice(0, 10);
      recentEl.innerHTML = recent.map(t => `
        <tr>
          <td>${new Date(t.date).toLocaleTimeString()}</td>
          <td>${t.attendant || "N/A"}</td>
          <td>GHS${(t.total || 0).toFixed(2)}</td>
          <td>${(t.paymentMethod || "cash").toUpperCase()}</td>
          <td>${(t.items || []).length}</td>
        </tr>
      `).join("");
    }
  }
}

// Settings
function updateDiscountValueLabel() {
  const type = document.getElementById("discountType").value;
  const label = document.getElementById("discountValueLabel");
  if (label) {
    label.textContent = type === "percentage" ? "Discount Percentage (%)" : "Discount Amount (GHS)";
  }
}

function updateShopNameDisplay() {
  const name = state.shop.name || "Dream Big";
  const nameEl = document.getElementById("shopNameDisplay");
  if (nameEl) nameEl.textContent = name;
  const sideEl = document.getElementById("sidebarShopName");
  if (sideEl) sideEl.textContent = name;
  document.title = name + " - ShopManager";
}

function loadSettings() {
  document.getElementById("shopType").value = state.shop.type || "provision";
  updateShopCategories();
  document.getElementById("shopName").value = state.shop.name || "";
  document.getElementById("shopLocation").value = state.shop.location || "";
  document.getElementById("shopPhone").value = state.shop.phone || "";
  document.getElementById("shopEmail").value = state.shop.email || "";
  document.getElementById("lowStockThreshold").value =
    state.shop.lowStockThreshold || 10;
  // NEW: Load max stock threshold if it exists
  const maxStockEl = document.getElementById("maxStockThreshold");
  if (maxStockEl) {
    maxStockEl.value = state.shop.maxStockThreshold || 50;
  }
  // Load discount settings
  const disc = state.shop.discount || { enabled: false, type: "percentage", value: 0, reason: "" };
  document.getElementById("discountEnabled").checked = disc.enabled;
  document.getElementById("discountType").value = disc.type;
  document.getElementById("discountValue").value = disc.value;
  document.getElementById("discountReason").value = disc.reason;
  updateDiscountValueLabel();
  updateShopNameDisplay();
}

function saveSettings() {
  state.shop.type = document.getElementById("shopType").value || "provision";
  state.shop.name = document.getElementById("shopName").value.trim();
  state.shop.location = document.getElementById("shopLocation").value.trim();
  state.shop.phone = document.getElementById("shopPhone").value.trim();
  state.shop.email = document.getElementById("shopEmail").value.trim();
  state.shop.lowStockThreshold =
    Number.parseInt(document.getElementById("lowStockThreshold").value) || 10;
  // NEW: Save max stock threshold (element may not exist)
  const maxStockEl = document.getElementById("maxStockThreshold");
  if (maxStockEl) {
    state.shop.maxStockThreshold = Number.parseInt(maxStockEl.value) || 50;
  }
  // Save discount settings
  state.shop.discount = {
    enabled: document.getElementById("discountEnabled").checked,
    type: document.getElementById("discountType").value,
    value: Number.parseFloat(document.getElementById("discountValue").value) || 0,
    reason: document.getElementById("discountReason").value.trim(),
  };

  if (!state.shop.name) {
    alert("Please enter shop name");
    return;
  }

  saveState();
  updateShopNameDisplay();
  alert("✓ Settings saved successfully!");
}

function openChangePasscodeModal() {
  openModal("changePasscodeModal");
  document.getElementById("newPasscodeInput").value = "";
  document.getElementById("confirmPasscodeInput").value = "";
}

// Modals
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
  }
}

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });
});

// Default Products
function loadDefaultProducts() {
  if (state.products.length === 0) {
    const defaults = [
      {
        id: 1,
        name: "Coca Cola 500ml",
        category: "Drinks",
        price: 2.5,
        quantity: 20,
        minStock: 5,
      },
      {
        id: 2,
        name: "Fanta Orange 500ml",
        category: "Drinks",
        price: 2.0,
        quantity: 15,
        minStock: 5,
      },
      {
        id: 3,
        name: "Pure Water (Bag)",
        category: "Drinks",
        price: 0.5,
        quantity: 50,
        minStock: 20,
      },
      {
        id: 4,
        name: "Sliced Bread",
        category: "Food",
        price: 1.0,
        quantity: 30,
        minStock: 10,
      },
      {
        id: 5,
        name: "Digestive Biscuits",
        category: "Snacks",
        price: 1.5,
        quantity: 25,
        minStock: 10,
      },
      {
        id: 6,
        name: "Indomie Noodles",
        category: "Food",
        price: 0.5,
        quantity: 40,
        minStock: 15,
      },
      {
        id: 7,
        name: "Groundnuts (Bag)",
        category: "Snacks",
        price: 1.0,
        quantity: 18,
        minStock: 5,
      },
      {
        id: 8,
        name: "Milk (Powdered)",
        category: "Drinks",
        price: 3.0,
        quantity: 10,
        minStock: 3,
      },
    ];

    state.products = defaults;
    saveState();
    renderInventory();
    renderPOS();
  }
}

// Utilities
function printReceipt() {
  const receiptContent = document.getElementById("receiptContent").textContent;
  const printWindow = window.open("", "", "width=600,height=800");
  if (printWindow) {
    printWindow.document.write(
      "<pre style='font-family: monospace; padding: 20px; font-size: 11px;'>" +
        receiptContent.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
        "</pre>"
    );
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  }
}

function downloadReceipt() {
  const receiptContent = document.getElementById("receiptContent").textContent;
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(receiptContent)
  );
  element.setAttribute("download", "receipt_" + Date.now() + ".txt");
  element.style.visibility = "hidden";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function updateShopCategories() {
  const shopType = document.getElementById("shopType").value;
  const categorySelect = document.getElementById("productCategory");
  const editCategorySelect = document.getElementById("editProductCategory");

  categorySelect.innerHTML = '<option value="">Select category</option>';
  if (editCategorySelect) editCategorySelect.innerHTML = '<option value="">Select category</option>';

  if (shopType && SHOP_CATEGORIES[shopType]) {
    SHOP_CATEGORIES[shopType].forEach((category) => {
      const option1 = document.createElement("option");
      option1.value = category;
      option1.textContent = category;
      categorySelect.appendChild(option1);

      if (editCategorySelect) {
        const option2 = document.createElement("option");
        option2.value = category;
        option2.textContent = category;
        editCategorySelect.appendChild(option2);
      }
    });
  }

  updateStaffRolesByShopType(shopType);
}

function updateStaffRolesByShopType(shopType) {
  const roleSelect = document.getElementById("staffRole");
  if (!roleSelect) return;

  const roles =
    STAFF_ROLES_BY_SHOP_TYPE[shopType] || STAFF_ROLES_BY_SHOP_TYPE.general;

  // Store current selection if any
  const currentRole = roleSelect.value;

  // Clear and rebuild options
  roleSelect.innerHTML = '<option value="">Select role</option>';
  roles.forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role;
    roleSelect.appendChild(option);
  });

  // Restore previous selection if it exists in new list
  if (currentRole && roles.includes(currentRole)) {
    roleSelect.value = currentRole;
  }
}

// Removed: toggleProductSelection, toggleSelectAll, updateMultiDeleteButton, deleteSelectedItems

// Removed: toggleStaffSelection, toggleSelectAllStaff, updateMultiDeleteStaffButton, deleteSelectedStaff

// Added function to support payment method display and customer payment input
let currentPaymentMethod = "cash";
let currentMobileMoneyProvider = "";
let currentBank = "";

function updatePaymentMethod() {
  currentPaymentMethod = document.getElementById("paymentMethodSelect").value;
  const mobileMoneyProviderGroup = document.getElementById(
    "mobileMoneyProviderGroup"
  );
  const bankTransferGroup = document.getElementById("bankTransferGroup");
  const customerPaymentGroup = document.getElementById("customerPaymentGroup");
  const changeDisplay = document.getElementById("changeDisplay");

  // Reset all visibility
  mobileMoneyProviderGroup.style.display = "none";
  bankTransferGroup.style.display = "none";

  // Show appropriate sub-dropdown based on main selection
  if (currentPaymentMethod === "mobile_money") {
    mobileMoneyProviderGroup.style.display = "block";
    currentMobileMoneyProvider = document.getElementById(
      "mobileMoneyProvider"
    ).value;
  } else if (currentPaymentMethod === "bank") {
    bankTransferGroup.style.display = "block";
    currentBank = document.getElementById("bankSelect").value;
  }

  // Show payment input only for cash payments
  if (currentPaymentMethod === "cash") {
    customerPaymentGroup.style.display = "block";
    calculateChange();
  } else {
    customerPaymentGroup.style.display = "none";
    document.getElementById("customerPaymentAmount").value = "";
    changeDisplay.style.display = "none";
  }
}

function calculateChange() {
  const paymentMethod = currentPaymentMethod || "cash";

  // Only show change calculation for cash payments
  if (paymentMethod !== "cash") {
    document.getElementById("changeDisplay").style.display = "none";
    return;
  }

  const cartTotalText = document.getElementById("cartTotal").textContent;
  const totalAmount =
    Number.parseFloat(cartTotalText.replace(/[^0-9.]/g, "")) || 0;
  const customerPaymentInput = document.getElementById("customerPaymentAmount");
  const customerPayment = Number.parseFloat(customerPaymentInput.value) || 0;

  const changeDisplay = document.getElementById("changeDisplay");
  const changeAmountEl = document.getElementById("changeAmount");

  // Only show change display if customer has entered a payment amount
  if (customerPayment > 0) {
    const change = customerPayment - totalAmount;

    changeDisplay.style.display = "block";

    if (change >= 0) {
      // Sufficient payment - show change in green
      changeAmountEl.textContent = `GHS ${change.toFixed(2)}`;
      changeAmountEl.style.color = "var(--success)";
      changeDisplay.style.borderLeftColor = "var(--success)";
      changeDisplay.style.background = "rgba(16, 185, 129, 0.1)";
    } else {
      // Insufficient payment - show shortage in red
      changeAmountEl.textContent = `GHS ${Math.abs(change).toFixed(2)} (Short)`;
      changeAmountEl.style.color = "var(--danger)";
      changeDisplay.style.borderLeftColor = "var(--danger)";
      changeDisplay.style.background = "rgba(220, 38, 38, 0.1)";
    }
  } else {
    // No payment entered yet - hide change display
    changeDisplay.style.display = "none";
  }
}

function saveDailyTransactions() {
  if (state.transactions.length === 0) return;

  const totalSales = state.transactions.reduce(
    (sum, t) => sum + (t.total || 0),
    0
  );
  const totalItems = state.transactions.reduce(
    (sum, t) => sum + (t.items?.length || 0),
    0
  );

  const dailySummary = {
    id: Date.now(),
    date: state.currentDate,
    totalTransactions: state.transactions.length,
    totalSales: totalSales,
    totalItems: totalItems,
    transactions: [...state.transactions],
  };

  state.dailyHistory.push(dailySummary);
  console.log("[v0] Saved daily transactions:", dailySummary);
}

// Passcode Management
function verifyPasscode() {
  const enteredPasscode = document.getElementById("passcodeInput").value;

  if (enteredPasscode === state.passcode) {
    state.isAuthenticated = true;
    saveState();
    closeModal("passcodeModal");

    // Show the pending section after authentication
    if (pendingSectionId) {
      const section = pendingSectionId;
      pendingSectionId = null;

      document
        .querySelectorAll(".section")
        .forEach((el) => el.classList.remove("active"));
      document
        .querySelectorAll(".nav-item")
        .forEach((el) => el.classList.remove("active"));

      const sectionEl = document.getElementById(section);
      if (sectionEl) sectionEl.classList.add("active");

      const navItems = document.querySelectorAll(".nav-item");
      navItems.forEach((item) => {
        if (
          item.textContent
            .toLowerCase()
            .includes(section)
        ) {
          item.classList.add("active");
        }
      });

      const titles = {
        dashboard: "Dashboard",
        pos: "Point of Sale",
        inventory: "Stock Management",
        transactions: "Transaction History",
        staff: "Staff Management",
        settings: "Shop Settings",
        saleshistory: "Sales History",
        monthlyreport: "Monthly Report",
      };

      document.getElementById("pageTitle").textContent =
        titles[section] || "ShopManager";

      if (section === "pos") {
        renderPOS();
        updateCart();
      } else if (section === "inventory") {
        renderInventory();
      } else if (section === "transactions") {
        renderTransactions();
      } else if (section === "staff") {
        renderStaffTable();
      } else if (section === "settings") {
        loadSettings();
      } else if (section === "dashboard") {
        updateDashboard();
      } else if (section === "saleshistory") {
        renderSalesHistory();
      } else if (section === "monthlyreport") {
        renderMonthlyReport();
      }
    }
  } else {
    alert("Incorrect passcode! Please try again.");
    document.getElementById("passcodeInput").value = "";
    document.getElementById("passcodeInput").focus();
  }
}

function handlePasscodeKeypress(e) {
  if (e.key === "Enter") {
    verifyPasscode();
  }
}

// Low Stock Filter
function filterLowStock() {
  const showLowStockOnly = document.getElementById("lowStockFilter").checked;
  document.querySelectorAll("#inventoryTable tr").forEach((row) => {
    if (showLowStockOnly) {
      const statusCell = row.querySelector("td:nth-child(6)");
      const isLowStock =
        statusCell && statusCell.textContent.includes("Low Stock");
      row.style.display = isLowStock ? "" : "none";
    } else {
      row.style.display = "";
    }
  });
}

// Sales History
function renderSalesHistory() {
  const table = document.getElementById("salesHistoryTable");

  if (state.dailyHistory.length === 0) {
    table.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 20px;">No sales history yet</td></tr>';
    return;
  }

  table.innerHTML = state.dailyHistory
    .slice()
    .reverse()
    .map(
      (day) => `
    <tr>
      <td><strong>${day.date}</strong></td>
      <td style="color: var(--primary); font-weight: 600;">GHS${(
        day.totalSales || 0
      ).toFixed(2)}</td>
      <td>${day.totalTransactions}</td>
      <td>${day.totalItems}</td>
      <td>GHS${((day.totalSales || 0) / (day.totalTransactions || 1)).toFixed(
        2
      )}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewDayReport(${JSON.stringify(
          day
        ).replace(/"/g, "&quot;")})">View Details</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function exportStockAsFormattedTable() {
  if (state.products.length === 0) {
    alert("No products to export");
    return;
  }

  const headers = [
    "Product Name",
    "Category",
    "Price (GHS)",
    "Current Stock",
    "Min Stock",
  ];

  const data = state.products.map((p) => [
    p.name,
    p.category,
    p.price.toFixed(2),
    p.quantity,
    p.minStock || "N/A",
  ]);

  downloadFormattedTable(
    headers,
    data,
    `stock_report_${new Date().toISOString().split("T")[0]}.csv`
  );
  alert("✓ Stock report exported as formatted table!");
}

function exportLowStockAsFormattedTable() {
  const lowStockItems = state.products.filter((p) => p.quantity < (p.minStock || state.shop.lowStockThreshold || 10));

  if (lowStockItems.length === 0) {
    alert("No low stock items to export");
    return;
  }

  const headers = ["Product Name", "Quantity Remaining"];

  const data = lowStockItems.map((p) => [p.name, p.quantity]);

  downloadFormattedTable(
    headers,
    data,
    `low_stock_report_${new Date().toISOString().split("T")[0]}.csv`
  );
  alert("✓ Low stock report exported as formatted table!");
}

function downloadFormattedTable(headers, rows, filename) {
  let csv = "";

  // Add title
  csv += "SHOP MANAGER - STOCK REPORT\n";
  csv += `Generated: ${new Date().toLocaleString()}\n`;
  csv += `Shop: ${state.shop.name}\n\n`;

  // Add headers
  csv += headers.map((h) => `"${h}"`).join(",") + "\n";

  // Add rows
  rows.forEach((row) => {
    csv +=
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",") + "\n";
  });

  // Add summary
  csv += "\n\nSUMMARY:\n";
  csv += `"Total Products","${rows.length}"\n`;
  csv += `"Export Date","${new Date().toLocaleString()}"\n`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function recordStockChange(
  productId,
  productName,
  action,
  quantityChanged,
  previousQty,
  newQty,
  notes = ""
) {
  state.stockHistory.push({
    id: Date.now(),
    productId,
    productName,
    action, // "Added", "Sold", "Adjusted", "Removed"
    quantityChanged,
    previousQuantity: previousQty,
    newQuantity: newQty,
    timestamp: new Date().toLocaleString(),
    notes,
  });
  saveState();
}

function resetToDefault() {
  const msg =
    "⚠️  RESET WARNING\n\nThis will permanently delete ALL data:\n" +
    `• ${state.products.length} product(s)\n` +
    `• ${state.staff.length} staff member(s)\n` +
    `• ${state.transactions.length} transaction(s)\n` +
    `• ${state.dailyHistory.length} day(s) of history\n` +
    `• ${state.heldCarts.length} held cart(s)\n\n` +
    "The system will be restored to factory defaults.\nThis cannot be undone!";

  if (!confirm(msg)) return;
  if (!confirm("ARE YOU SURE? Type OK to confirm.")) return;

  localStorage.removeItem("shopManagerState");

  // Reassign state to defaults
  Object.assign(state, {
    shop: {
      type: "provision",
      name: "Dream Big Shop",
      location: "Your Location",
      phone: "024XXXXXXX",
      email: "",

      lowStockThreshold: 10,
      discount: { enabled: false, type: "percentage", value: 0, reason: "" },
    },
    staff: [],
    currentStaff: null,
    staffSessionTime: null,
    products: [],
    cart: [],
    transactions: [],
    stockHistory: [],
    selectedProducts: new Set(),
    selectedStaff: new Set(),
    dailyHistory: [],
    currentDate: new Date().toDateString(),
    passcode: "1234",
    isAuthenticated: false,
    heldCarts: [],
  });

  loadDefaultProducts();
  loadSettings();
  updateShopCategories();
  renderStaffTable();
  renderInventory();
  renderPOS();
  updateDashboard();
  updateHeldCartsBadge();
  renderSalesHistory();
  showSection("pos");
  document.getElementById("saleStatus").textContent = "";
  alert("System reset to default successfully!");
}

function exportDataToJSON() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify({ version: "1.0", ...state }, null, 2)], {
      type: "application/json",
    })
  );
  link.download = "shopmanager-backup.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  alert("✓ Data exported successfully!");
}

function importDataFromJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      if (importedData.version !== "1.0") {
        alert("Warning: This backup was created from a different version.");
      }

      const confirmImport = confirm(
        "This will overwrite all current data with the backup. Continue?\n\nCurrent data:\n" +
          `• Products: ${state.products.length}\n` +
          `• Staff: ${state.staff.length}\n` +
          `• Transactions: ${state.transactions.length}\n\n` +
          `Backup contains:\n` +
          `• Products: ${importedData.products?.length || 0}\n` +
          `• Staff: ${importedData.staff?.length || 0}\n` +
          `• Transactions: ${importedData.transactions?.length || 0}`
      );

      if (confirmImport) {
        const importedShop = importedData.shop || {};
        state.shop = { ...state.shop, ...importedShop };
        state.staff = importedData.staff || [];
        state.products = importedData.products || [];
        state.stockHistory = importedData.stockHistory || [];
        state.passcode = importedData.passcode || "1234";

        // Archive imported transactions into dailyHistory by date
        const importedTx = importedData.transactions || [];
        const dailyMap = {};
        importedTx.forEach(t => {
          const d = new Date(t.date).toDateString();
          if (!dailyMap[d]) dailyMap[d] = [];
          dailyMap[d].push(t);
        });
        state.dailyHistory = (importedData.dailyHistory || []).slice();
        Object.entries(dailyMap).forEach(([date, txs]) => {
          const existing = state.dailyHistory.find(day => day.date === date);
          if (existing) {
            existing.totalTransactions += txs.length;
            existing.totalSales += txs.reduce((s, t) => s + (t.total || 0), 0);
            existing.totalItems += txs.reduce((s, t) => s + (t.items?.length || 0), 0);
            existing.transactions.push(...txs);
          } else {
            state.dailyHistory.push({
              id: Date.now() + Math.random(),
              date,
              totalTransactions: txs.length,
              totalSales: txs.reduce((s, t) => s + (t.total || 0), 0),
              totalItems: txs.reduce((s, t) => s + (t.items?.length || 0), 0),
              transactions: txs,
            });
          }
        });
        // Clear main transactions array so today's sales start fresh
        state.transactions = [];
        state.currentDate = new Date().toDateString();
        if (state.currentStaff && !state.staff.some(s => s.name === state.currentStaff)) {
          state.currentStaff = null;
          document.getElementById("staffName").textContent = "Select Staff";
        }

        saveState();
        loadSettings();
        updateShopNameDisplay();
        updateShopCategories();
        renderStaffTable();
        renderInventory();
        renderPOS();
        updateDashboard();
        updateHeldCartsBadge();
        renderSalesHistory();
        showSection("pos");
        document.getElementById("saleStatus").textContent = "";
        alert("✓ Data imported successfully! All sections updated.");
      }
    } catch (error) {
      alert("Error importing file: " + error.message);
    }
  };
  reader.readAsText(file);
}

function exportSalesHistory() {
  // Collect all transactions (today + archived daily history)
  const allTransactions = [...state.transactions];
  state.dailyHistory.forEach(day => {
    if (day.transactions) {
      day.transactions.forEach(t => allTransactions.push(t));
    }
  });

  if (allTransactions.length === 0) {
    alert("No sales records to export");
    return;
  }

  const headers = [
    "Date",
    "Transaction ID",
    "Attendant",
    "Payment Method",
    "Total (GHS)",
    "Items Count",
  ];

  const data = allTransactions.map((t) => [
    new Date(t.date).toLocaleString("en-GH"),
    t.id,
    t.attendant || "N/A",
    (t.paymentMethod || "cash").toUpperCase(),
    (t.total || 0).toFixed(2),
    (t.items || []).length,
  ]);

  downloadFormattedTable(
    headers,
    data,
    `sales_history_${new Date().toISOString().split("T")[0]}.csv`
  );
  alert("✓ Sales history exported successfully!");
}

// Monthly Quantity Report
function renderMonthlyReport() {
  const container = document.getElementById("monthlyReportContent");

  // Build month selector
  const now = new Date();

  let html = `
    <div style="margin-bottom:20px;display:flex;gap:12px;align-items:end;flex-wrap:wrap">
      <div class="form-group" style="margin:0;min-width:160px">
        <label>Month</label>
        <select id="reportMonth" onchange="generateMonthlyReport()">
          ${MONTH_NAMES.map((m, i) => `<option value="${i}" ${i === now.getMonth() ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" style="margin:0;min-width:120px">
        <label>Year</label>
        <select id="reportYear" onchange="generateMonthlyReport()">
          ${[now.getFullYear(), now.getFullYear() - 1].map(y => `<option value="${y}" ${y === now.getFullYear() ? "selected" : ""}>${y}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-primary" onclick="generateMonthlyReport()" style="margin-bottom:0">Generate Report</button>
      <button class="btn btn-outline" onclick="exportMonthlyReport()" style="margin-bottom:0">📥 Export</button>
    </div>
    <div id="monthlyReportResult"></div>
  `;

  container.innerHTML = html;
  generateMonthlyReport();
}

function generateMonthlyReport() {
  const month = parseInt(document.getElementById("reportMonth").value);
  const year = parseInt(document.getElementById("reportYear").value);
  const resultDiv = document.getElementById("monthlyReportResult");

  // Collect all transactions across dailyHistory + current transactions
  const allTransactions = [...state.transactions];
  state.dailyHistory.forEach(day => {
    if (day.transactions) {
      day.transactions.forEach(t => allTransactions.push(t));
    }
  });

  // Filter by selected month/year
  const filtered = allTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  if (filtered.length === 0) {
    resultDiv.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary)">No transactions found for ${MONTH_NAMES[month]} ${year}.</div>`;
    return;
  }

  // Aggregate per product
  const productMap = {};
  filtered.forEach(t => {
    (t.items || []).forEach(item => {
      const key = item.id || item.name;
      if (!productMap[key]) {
        productMap[key] = { name: item.name || "Unknown", category: item.category || "N/A", qty: 0, revenue: 0 };
      }
      productMap[key].qty += item.quantity || 0;
      productMap[key].revenue += (item.price || 0) * (item.quantity || 0);
    });
  });

  const products = Object.values(productMap).sort((a, b) => b.qty - a.qty);
  const totalItems = products.reduce((s, p) => s + p.qty, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const monthName = MONTH_NAMES[month];

  let tableRows = products.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.category}</td>
      <td style="font-weight:600;color:var(--primary)">${p.qty}</td>
      <td>GHS ${p.revenue.toFixed(2)}</td>
    </tr>
  `).join("");

  resultDiv.innerHTML = `
    <div style="background:var(--bg-secondary);padding:16px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--primary);display:flex;gap:24px;flex-wrap:wrap">
      <div><span style="color:var(--text-secondary);font-size:12px">Report Period</span><div style="font-weight:700">${monthName} ${year}</div></div>
      <div><span style="color:var(--text-secondary);font-size:12px">Total Items Sold</span><div style="font-weight:700;color:var(--primary)">${totalItems}</div></div>
      <div><span style="color:var(--text-secondary);font-size:12px">Total Revenue</span><div style="font-weight:700;color:var(--success)">GHS ${totalRevenue.toFixed(2)}</div></div>
      <div><span style="color:var(--text-secondary);font-size:12px">Transactions</span><div style="font-weight:700">${filtered.length}</div></div>
    </div>
    <div class="table-container">
      <table>
        <thead><tr><th>Product</th><th>Category</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;

  // Store for export
  window._lastMonthlyReport = { month, year, monthName, products, totalItems, totalRevenue, transactions: filtered.length };
}

function exportMonthlyReport() {
  const data = window._lastMonthlyReport;
  if (!data || !data.products || data.products.length === 0) {
    alert("Please generate a report first.");
    return;
  }
  const headers = ["Product Name", "Category", "Quantity Sold", "Revenue (GHS)"];
  const rows = data.products.map(p => [p.name, p.category, p.qty, p.revenue.toFixed(2)]);
  let csv = `MONTHLY SALES REPORT - ${data.monthName} ${data.year}\n`;
  csv += `Generated: ${new Date().toLocaleString()}\n`;
  csv += `Shop: ${state.shop.name}\n\n`;
  csv += headers.map(h => `"${h}"`).join(",") + "\n";
  rows.forEach(r => { csv += r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",") + "\n"; });
  csv += `\nSUMMARY:\n"Total Items Sold","${data.totalItems}"\n"Total Revenue","GHS ${data.totalRevenue.toFixed(2)}"\n"Transactions","${data.transactions}"\n`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `monthly_report_${data.monthName}_${data.year}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  alert("✓ Monthly report exported!");
}

// Multi-Select Helpers
let selectedItems = new Set();
let selectedStaff = new Set();

function toggleSelectAll() {
  const checked = document.getElementById("selectAllCheckbox").checked;
  document.querySelectorAll(".item-checkbox").forEach(cb => { cb.checked = checked; });
  updateMultiDeleteBtn();
}

function updateMultiDeleteBtn() {
  selectedItems = new Set();
  document.querySelectorAll(".item-checkbox:checked").forEach(cb => selectedItems.add(cb.value));
  const btn = document.getElementById("multiDeleteBtn");
  if (btn) btn.style.display = selectedItems.size > 0 ? "inline-flex" : "none";
}

function deleteSelectedItems() {
  if (selectedItems.size === 0) return;
  if (!confirm(`Delete ${selectedItems.size} selected product(s)?`)) return;
  selectedItems.forEach(id => {
    const idx = state.products.findIndex(p => p.id == id);
    if (idx !== -1) state.products.splice(idx, 1);
  });
  selectedItems.clear();
  saveState();
  renderInventory();
  document.getElementById("multiDeleteBtn").style.display = "none";
  document.getElementById("selectAllCheckbox").checked = false;
}

function toggleSelectAllStaff() {
  const checked = document.getElementById("selectAllStaffCheckbox").checked;
  document.querySelectorAll(".staff-checkbox").forEach(cb => { cb.checked = checked; });
  updateMultiDeleteStaffBtn();
}

function updateMultiDeleteStaffBtn() {
  selectedStaff = new Set();
  document.querySelectorAll(".staff-checkbox:checked").forEach(cb => selectedStaff.add(cb.value));
  const btn = document.getElementById("multiDeleteStaffBtn");
  if (btn) btn.style.display = selectedStaff.size > 0 ? "inline-flex" : "none";
}

function deleteSelectedStaff() {
  if (selectedStaff.size === 0) return;
  if (!confirm(`Delete ${selectedStaff.size} selected staff member(s)?`)) return;
  selectedStaff.forEach(id => {
    const idx = state.staff.findIndex(s => s.id == id);
    if (idx !== -1) state.staff.splice(idx, 1);
  });
  selectedStaff.clear();
  saveState();
  renderStaffTable();
  document.getElementById("multiDeleteStaffBtn").style.display = "none";
  document.getElementById("selectAllStaffCheckbox").checked = false;
}

// Edit Product
function editProduct(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  document.getElementById("editProductId").value = product.id;
  document.getElementById("editProductName").value = product.name;
  document.getElementById("editProductCategory").value = product.category;
  document.getElementById("editProductPrice").value = product.price;
  document.getElementById("editProductCurrentStock").value = product.quantity;
  document.getElementById("editProductMinStock").value = product.minStock;
  document.getElementById("editProductMaxStock").value = product.maxStock || "";
  document.getElementById("editProductAddStock").value = "";
  document.getElementById("editProductSubtractStock").value = "";
  openModal("editProductModal");
}

function saveEditedProduct(e) {
  e.preventDefault();
  const id = document.getElementById("editProductId").value;
  const product = state.products.find(p => p.id == id);
  if (!product) return;

  const oldQty = product.quantity;
  product.name = document.getElementById("editProductName").value;
  product.category = document.getElementById("editProductCategory").value;
  product.price = parseFloat(document.getElementById("editProductPrice").value) || 0;

  const addQty = parseInt(document.getElementById("editProductAddStock").value) || 0;
  const subQty = parseInt(document.getElementById("editProductSubtractStock").value) || 0;
  product.quantity = oldQty + addQty - subQty;
  if (product.quantity < 0) product.quantity = 0;

  product.minStock = parseInt(document.getElementById("editProductMinStock").value) || 0;
  const maxVal = document.getElementById("editProductMaxStock").value;
  product.maxStock = maxVal ? parseInt(maxVal) : undefined;

  saveState();
  renderInventory();
  closeModal("editProductModal");
}

// POS Category Filter
function filterPOSByCategory() {
  renderPOS();
}

// Passcode update alias
function saveNewPasscode() {
  const currentPasscode = document.getElementById("currentPasscode").value;
  const newPasscode = document.getElementById("newPasscodeInput").value;
  const confirmPasscode = document.getElementById("confirmPasscodeInput").value;

  if (currentPasscode !== state.passcode) {
    alert("Current passcode is incorrect!");
    return;
  }

  if (newPasscode.length < 4) {
    alert("New passcode must be at least 4 characters!");
    return;
  }

  if (newPasscode !== confirmPasscode) {
    alert("Passcodes do not match!");
    return;
  }

  state.passcode = newPasscode;
  saveState();
  closeModal("changePasscodeModal");
  alert("✓ Passcode updated successfully!");
}

// Cloud Config Functions
function openCloudConfigModal() {
  const savedConfig = localStorage.getItem("supabaseConfig");
  if (savedConfig) {
    const config = JSON.parse(savedConfig);
    document.getElementById("supabaseUrl").value = config.url || "";
    document.getElementById("supabaseKey").value = config.key || "";
  } else {
    document.getElementById("supabaseUrl").value = "";
    document.getElementById("supabaseKey").value = "";
  }
  openModal("cloudConfigModal");
}

function saveCloudConfiguration() {
  const url = document.getElementById("supabaseUrl").value.trim();
  const key = document.getElementById("supabaseKey").value.trim();

  if (!url || !key) {
    alert("Please enter both URL and API key");
    return;
  }

  localStorage.setItem("supabaseConfig", JSON.stringify({ url, key }));
  closeModal("cloudConfigModal");

  if (window.cloudSync) {
    window.cloudSync.initSupabase();
  }

  alert("✓ Cloud configuration saved!");
}

function manualSync() {
  if (!window.cloudSync || !window.cloudSync.supabaseClient?.ready) {
    alert("Cloud sync is not configured. Click Configure to set up.");
    return;
  }

  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.textContent = "Syncing...";

  window.cloudSync.syncLocalChangesFirst().then(() => {
    const status = window.cloudSync.getStatus();
    if (statusEl) {
      statusEl.textContent = `Last sync: ${status.lastSync ? new Date(status.lastSync).toLocaleString() : "Just now"} | Online: ${status.online}`;
    }
  }).catch(err => {
    if (statusEl) statusEl.textContent = "Sync failed: " + err.message;
  });
}

// Alias for restoreToDefaults
function restoreToDefaults() {
  resetToDefault();
}

// Moved staff selection functions here as they are still used.
function renderStaffLoginList() {
  const select = document.getElementById("staffLoginSelect");
  if (!select) return;
  if (state.staff.length === 0) {
    select.innerHTML = '<option value="">No staff available</option>';
    return;
  }
  select.innerHTML = '<option value="">— Select Staff —</option>' +
    state.staff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join("");
}
