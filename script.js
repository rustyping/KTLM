const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>KTLM</text></svg>";

let storeConfig = {};
let allProducts = [];
let allCustomers = [];
let allSubcategories = [];
let cart = [];
let selectedCategory = "ALL";
let activeSubProduct = null;
let selectedSubOptions = {};

let posSettings = {
  showImages: true,
  printMode: 'rawbt',
  paperSize: '58mm',
  headerName: 'KTLM Kitchen',
  address: '',
  waPhone: ''
};

function initSettings() {
  const saved = localStorage.getItem('ktlm_pos_settings');
  if (saved) {
    try {
      posSettings = Object.assign(posSettings, JSON.parse(saved));
    } catch(e){}
  }
  document.documentElement.style.setProperty('--paper-width', posSettings.paperSize);
}

function fixImageUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') return DEFAULT_PLACEHOLDER;
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  return url;
}

async function loadData() {
  initSettings();
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    storeConfig = data.store || {};
    allProducts = data.products || [];
    allCustomers = data.customers || [];
    allSubcategories = data.subkategori || [];

    renderCategories();
    renderProducts(allProducts);
    renderCustomers();
  } catch (err) {
    alert("Gagal memuat data dari server.");
  }
}

function renderCustomers() {
  const custSelect = document.getElementById("customerSelect");
  if (allCustomers.length > 0) {
    custSelect.innerHTML = allCustomers.map(c => `<option value="${c.nama}">${c.nama}</option>`).join('');
  } else {
    custSelect.innerHTML = `<option value="Umum">Umum / Walk-in</option>`;
  }
}

function renderCategories() {
  const categories = ["ALL", ...new Set(allProducts.map(p => p.kategori).filter(Boolean))];
  const catBar = document.getElementById("categoryBar");
  catBar.innerHTML = categories.map(cat => 
    `<button class="cat-btn ${cat==='ALL'?'active':''}" onclick="filterCategory('${cat}', this)">${cat}</button>`
  ).join('');
}

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (products.length === 0) {
    grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: #6c757d; padding: 20px;">Menu tidak ditemukan</p>';
    return;
  }
  
  grid.innerHTML = products.map(p => {
    const totalQtyInCart = cart
      .filter(c => c.product.id === p.id)
      .reduce((sum, i) => sum + i.qty, 0);

    const subCategories = getSubCategoriesForProduct(p);
    const hasSub = subCategories.length > 0;
    const imgUrl = fixImageUrl(p.gambar);
    const isSelected = totalQtyInCart > 0;

    if (posSettings.showImages) {
      return `
        <div class="product-card ${isSelected ? 'has-selected' : ''}" onclick="handleProductClick('${p.id}', event)">
          <div class="product-img-wrapper">
            <img src="${imgUrl}" alt="${p.nama}" class="product-img" onerror="this.src='${DEFAULT_PLACEHOLDER}'" loading="lazy">
            ${hasSub ? `<span class="variant-tag">+ Variasi/Paket</span>` : ''}
          </div>
          
          <div class="product-details">
            <div class="product-info-text">
              <div class="product-title">${p.nama}</div>
              <div class="product-price">Rp${p.harga.toLocaleString('id-ID')}</div>
            </div>

            ${isSelected ? `
              <div class="qty-badge-inline" onclick="event.stopPropagation()">
                <input type="number" min="0" class="qty-input-inline" 
                       value="${totalQtyInCart}" 
                       onchange="onQtyDirectChange('${p.id}', this.value)"
                       onfocus="this.select()">
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="product-card compact ${isSelected ? 'has-selected' : ''}" onclick="handleProductClick('${p.id}', event)">
          <div class="compact-details">
            <div class="product-title">${p.nama}</div>
            <div class="product-price">Rp${p.harga.toLocaleString('id-ID')}</div>
            ${hasSub ? `<span class="variant-tag-inline">+ Variasi/Paket</span>` : ''}
          </div>
          
          ${isSelected ? `
            <div class="qty-badge-inline" onclick="event.stopPropagation()">
              <input type="number" min="0" class="qty-input-inline" 
                     value="${totalQtyInCart}" 
                     onchange="onQtyDirectChange('${p.id}', this.value)"
                     onfocus="this.select()">
            </div>
          ` : ''}
        </div>
      `;
    }
  }).join('');
}

function getSubCategoriesForProduct(product) {
  if (!allSubcategories || allSubcategories.length === 0) return [];
  return allSubcategories.filter(s => 
    (s.id_produk && s.id_produk.toString().toLowerCase() === product.id.toString().toLowerCase()) ||
    (s.produk && s.produk.toString().toLowerCase() === product.nama.toString().toLowerCase())
  );
}

function handleProductClick(id, event) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    addToCart(product, 1, "");
  }
}

function onQtyDirectChange(productId, val) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const newQty = parseInt(val) || 0;
  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    updateDirectQty(productId, newQty);
  }
}

/* Modal Subkategori & Mix-Match Counter */
function openSubCategoryModal(product, subCategories) {
  activeSubProduct = product;
  selectedSubOptions = {};

  document.getElementById("subModalTitle").innerText = product.nama;
  const modalBody = document.getElementById("subModalBody");

  let html = '';
  subCategories.forEach((group, index) => {
    const groupName = group.nama_kategori || group.kategori_opsi || `Pilihan ${index + 1}`;
    let rawOptions = group.opsi || group.pilihan || "";
    let optionsList = Array.isArray(rawOptions) ? rawOptions : rawOptions.split(',').map(o => o.trim()).filter(Boolean);

    const groupLower = groupName.toLowerCase();
    
    // Deteksi Otomatis Jika Grup adalah Pilihan Paket Varian Isi (Mix & Match)
    const isCounterGroup = groupLower.includes('isi') || groupLower.includes('varian') || 
                           groupLower.includes('paket') || groupLower.includes('pilih') || 
                           group.tipe === 'counter';

    if (optionsList.length > 0) {
      if (isCounterGroup) {
        selectedSubOptions[groupName] = {};
        optionsList.forEach(opt => { selectedSubOptions[groupName][opt] = 0; });

        html += `
          <div class="option-group">
            <div class="option-label">
              <span>${groupName.toUpperCase()}</span>
              <span style="font-size: 11px; color: #2e7d32; font-weight: 800;" id="totalCounterTag_${index}">Total: 0 Item</span>
            </div>
            <div>
              ${optionsList.map(opt => `
                <div class="counter-item-row">
                  <span class="counter-item-name">${opt}</span>
                  <div class="counter-control">
                    <button type="button" class="btn-counter-mini" onclick="adjustSubCounter('${groupName}', '${opt}', -1, ${index})">-</button>
                    <span class="counter-val" id="cnt_${index}_${opt.replace(/\s+/g, '_')}">0</span>
                    <button type="button" class="btn-counter-mini" onclick="adjustSubCounter('${groupName}', '${opt}', 1, ${index})">+</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        // Pilihan Single
        selectedSubOptions[groupName] = optionsList[0];

        html += `
          <div class="option-group">
            <div class="option-label">
              <span>${groupName.toUpperCase()}</span>
              <span style="font-size: 10px; font-weight: normal; color: #6c757d;">(Pilih 1)</span>
            </div>
            <div class="chips-container">
              ${optionsList.map((opt, optIndex) => `
                <button type="button" class="chip-option ${optIndex === 0 ? 'selected' : ''}" 
                        onclick="selectSingleSubOption('${groupName}', '${opt}', this)">
                  ${opt}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
  });

  html += `
    <div class="form-group" style="margin-top:15px;">
      <label>JUMLAH PAKET / PORSI</label>
      <input type="number" id="subQtyInput" class="form-input" value="1" min="1" style="font-size:18px; font-weight:bold; text-align:center;">
    </div>
  `;

  modalBody.innerHTML = html;
  document.getElementById("subCategoryModal").style.display = "flex";
}

function adjustSubCounter(groupName, optionValue, delta, groupIdx) {
  if (!selectedSubOptions[groupName]) selectedSubOptions[groupName] = {};
  
  let currentVal = selectedSubOptions[groupName][optionValue] || 0;
  let newVal = Math.max(0, currentVal + delta);
  selectedSubOptions[groupName][optionValue] = newVal;

  const elementId = `cnt_${groupIdx}_${optionValue.replace(/\s+/g, '_')}`;
  const el = document.getElementById(elementId);
  if (el) el.innerText = newVal;

  const totalItems = Object.values(selectedSubOptions[groupName]).reduce((a, b) => a + b, 0);
  const tagEl = document.getElementById(`totalCounterTag_${groupIdx}`);
  if (tagEl) tagEl.innerText = `Total: ${totalItems} Item`;
}

function selectSingleSubOption(groupName, optionValue, btn) {
  selectedSubOptions[groupName] = optionValue;
  const parent = btn.parentElement;
  parent.querySelectorAll('.chip-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function closeSubModal() {
  document.getElementById("subCategoryModal").style.display = "none";
  activeSubProduct = null;
}

function confirmSubCategorySelection() {
  if (!activeSubProduct) return;
  const qty = parseInt(document.getElementById("subQtyInput").value) || 1;
  
  let formattedSelections = [];

  Object.keys(selectedSubOptions).forEach(key => {
    const val = selectedSubOptions[key];
    if (typeof val === 'object' && val !== null) {
      let itemsList = [];
      Object.keys(val).forEach(itemKey => {
        if (val[itemKey] > 0) {
          itemsList.push(`${val[itemKey]} ${itemKey}`);
        }
      });
      if (itemsList.length > 0) {
        formattedSelections.push(itemsList.join(', '));
      }
    } else if (val) {
      formattedSelections.push(val);
    }
  });

  const subVariantText = formattedSelections.join(' | ');

  addToCart(activeSubProduct, qty, subVariantText);
  closeSubModal();
}

function addToCart(product, qty, subVariant) {
  const existing = cart.find(item => item.product.id === product.id && item.subVariant === subVariant);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ product: product, qty: qty, subVariant: subVariant || "" });
  }
  updateCartUI();
  filterProducts();
}

function updateDirectQty(productId, newQty) {
  const existingIndex = cart.findIndex(item => item.product.id === productId);
  if (newQty <= 0) {
    if (existingIndex !== -1) cart.splice(existingIndex, 1);
  } else {
    if (existingIndex !== -1) {
      cart[existingIndex].qty = newQty;
    } else {
      const product = allProducts.find(p => p.id === productId);
      if (product) cart.push({ product: product, qty: newQty, subVariant: "" });
    }
  }
  updateCartUI();
  filterProducts();
}

function updateQtyInCartList(index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
  }
  updateCartUI();
  renderModalCartList();
  filterProducts();
  
  if (cart.length === 0) {
    closeCheckoutModal();
  }
}

function filterCategory(cat, btn) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterProducts();
}

function filterProducts() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  let filtered = allProducts.filter(p => {
    const matchCat = selectedCategory === "ALL" || p.kategori === selectedCategory;
    const matchSearch = p.nama.toLowerCase().includes(keyword);
    return matchCat && matchSearch;
  });
  renderProducts(filtered);
}

function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  document.getElementById("barItemCount").innerText = `${totalQty} Item`;
  document.getElementById("barTotalAmount").innerText = `Rp${totalPrice.toLocaleString('id-ID')}`;
  document.getElementById("modalTotalAmount").innerText = `Rp${totalPrice.toLocaleString('id-ID')}`;

  const btnCheckout = document.getElementById("btnOpenCheckout");
  if (btnCheckout) {
    btnCheckout.disabled = cart.length === 0;
  }
}

function openCheckoutModal() {
  if (cart.length === 0) return;
  renderModalCartList();
  document.getElementById("checkoutModal").style.display = "flex";
}

function closeCheckoutModal() {
  document.getElementById("checkoutModal").style.display = "none";
}

function renderModalCartList() {
  const listContainer = document.getElementById("modalCartList");
  if (!listContainer) return;
  listContainer.innerHTML = cart.map((item, index) => `
    <div class="cart-item-row">
      <div>
        <div class="cart-item-name">${item.product.nama}</div>
        ${item.subVariant ? `<div class="cart-item-sub">${item.subVariant}</div>` : ''}
        <div class="cart-item-price">Rp${item.product.harga.toLocaleString('id-ID')} x ${item.qty} = Rp${(item.product.harga * item.qty).toLocaleString('id-ID')}</div>
      </div>
      <div class="qty-controls">
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${index}, -1)">-</button>
        <span style="font-weight: bold; font-size: 13px;">${item.qty}</span>
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${index}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function addQuickNote(text) {
  const noteInput = document.getElementById("orderNote");
  if (!noteInput) return;
  if (noteInput.value.trim() === "") {
    noteInput.value = text;
  } else if (!noteInput.value.includes(text)) {
    noteInput.value += ", " + text;
  }
}

function openSettingsModal() {
  document.getElementById("settingShowImages").checked = posSettings.showImages;
  document.getElementById("settingPrintMode").value = posSettings.printMode;
  document.getElementById("settingPaperSize").value = posSettings.paperSize;
  document.getElementById("settingHeaderStore").value = posSettings.headerName || storeConfig.nama_toko || 'KTLM Kitchen';
  document.getElementById("settingAddressStore").value = posSettings.address || storeConfig.alamat || '';
  document.getElementById("settingWaStore").value = posSettings.waPhone || storeConfig.whatsapp || '';

  document.getElementById("settingsModal").style.display = "flex";
}

function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}

function savePrinterSettings() {
  posSettings.showImages = document.getElementById("settingShowImages").checked;
  posSettings.printMode = document.getElementById("settingPrintMode").value;
  posSettings.paperSize = document.getElementById("settingPaperSize").value;
  posSettings.headerName = document.getElementById("settingHeaderStore").value;
  posSettings.address = document.getElementById("settingAddressStore").value;
  posSettings.waPhone = document.getElementById("settingWaStore").value;

  localStorage.setItem('ktlm_pos_settings', JSON.stringify(posSettings));
  document.documentElement.style.setProperty('--paper-width', posSettings.paperSize);

  closeSettingsModal();
  filterProducts();
  alert("Pengaturan berhasil disimpan!");
}

async function processPayment() {
  if (cart.length === 0) return;

  const customer = document.getElementById("customerSelect").value;
  const paymentMethod = document.getElementById("paymentMethodSelect").value;
  const note = document.getElementById("orderNote").value;
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  const orderData = {
    customer: customer,
    paymentMethod: paymentMethod,
    note: note,
    totalAmount: totalPrice,
    items: cart.map(item => ({
      nama: item.product.nama,
      harga: item.product.harga,
      qty: item.qty,
      subVariant: item.subVariant
    }))
  };

  printReceipt(orderData);

  cart = [];
  document.getElementById("orderNote").value = "";
  updateCartUI();
  filterProducts();
  closeCheckoutModal();
}

function printReceipt(order) {
  const storeName = posSettings.headerName || storeConfig.nama_toko || "KTLM Kitchen";
  const storeAddr = posSettings.address || storeConfig.alamat || "Jl. Laks Martadinata 59D";
  const storeWa = posSettings.waPhone || storeConfig.whatsapp || "085838976880";
  const dateStr = new Date().toLocaleString('id-ID');

  let receiptText = `${storeName}\n${storeAddr}\nTelp/WA: ${storeWa}\n--------------------------------\n`;
  receiptText += `Tanggal : ${dateStr}\n`;
  receiptText += `Pelanggan: ${order.customer}\n`;
  receiptText += `Bayar    : ${order.paymentMethod}\n`;
  if (order.note) receiptText += `Catatan  : ${order.note}\n`;
  receiptText += `--------------------------------\n`;

  order.items.forEach(item => {
    receiptText += `${item.nama}\n`;
    if (item.subVariant) receiptText += `  (${item.subVariant})\n`;
    const subtotal = item.harga * item.qty;
    receiptText += `  ${item.qty} x ${item.harga.toLocaleString('id-ID')} = ${subtotal.toLocaleString('id-ID')}\n`;
  });

  receiptText += `--------------------------------\n`;
  receiptText += `TOTAL    : Rp${order.totalAmount.toLocaleString('id-ID')}\n`;
  receiptText += `--------------------------------\n`;
  receiptText += `  Terima Kasih Atas Kunjungan Anda\n\n\n`;

  if (posSettings.printMode === 'rawbt') {
    const rawbtUrl = "intent:" + encodeURIComponent(receiptText) + "#Intent;scheme=rawbt;package=ru.is_art.myprinter;end;";
    window.location.href = rawbtUrl;
  } else {
    const printArea = document.getElementById("receipt-print");
    printArea.innerHTML = `<pre>${receiptText}</pre>`;
    window.print();
  }
}

window.onload = function() {
  loadData();
};
