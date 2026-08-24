const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>KTLM</text></svg>";

let storeConfig = {};
let allProducts = [];
let allCustomers = [];
let allSubcategories = [];
let cart = [];
let pendingOrdersArr = [];
let selectedCategory = "ALL";
let activeSubProduct = null;
let selectedSubOptions = {};
let lastTransaction = null;
let selectedProductForModal = null;
let currentModalQty = 1;

// Render Kartu Produk di Grid (Gambar 1)
function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';

  products.forEach(product => {
    const itemInCart = cart.find(c => c.id === product.id);
    const qty = itemInCart ? itemInCart.qty : 0;

    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Saat gambar / area kartu diklik -> Buka Modal Detail (Gambar 3)
    card.onclick = (e) => {
      if (!e.target.classList.contains('btn-circle-blue') && !e.target.classList.contains('btn-card-add')) {
        openDetailModal(product);
      }
    };

    let actionButtonHTML = '';
    if (qty > 0) {
      // Tombol Pill Biru (- 1 +)
      actionButtonHTML = `
        <div class="card-qty-pill">
          <button class="btn-circle-blue" onclick="updateCartQty('${product.id}', -1)">-</button>
          <span class="card-qty-val">${qty}</span>
          <button class="btn-circle-blue" onclick="updateCartQty('${product.id}', 1)">+</button>
        </div>
      `;
    } else {
      // Tombol Outlined 'Add'
      actionButtonHTML = `
        <button class="btn-card-add" onclick="openDetailModalFromId('${product.id}')">Add</button>
      `;
    }

    card.innerHTML = `
      <img src="${product.image || 'placeholder.jpg'}" alt="${product.name}">
      <div class="product-info">
        <h4>${product.name}</h4>
        <p class="price">Rp${product.price.toLocaleString('id-ID')}</p>
        ${actionButtonHTML}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Buka Modal Detail saat Klik Gambar (Gambar 3)
function openDetailModal(product) {
  selectedProductForModal = product;
  currentModalQty = 1;

  document.getElementById('modal-header-title').innerText = product.name;
  document.getElementById('modal-img').src = product.image || 'placeholder.jpg';
  document.getElementById('modal-title').innerText = product.name;
  document.getElementById('modal-desc').innerText = product.description || 'Pilihan menu lezat dan berkualitas.';
  document.getElementById('modal-price').innerText = `Rp${product.price.toLocaleString('id-ID')}`;
  document.getElementById('modal-notes').value = '';
  document.getElementById('modal-qty-val').innerText = currentModalQty;

  document.getElementById('detail-modal').style.display = 'flex';
}

function openDetailModalFromId(productId) {
  const product = products.find(p => p.id === productId);
  if (product) openDetailModal(product);
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
}

function changeModalQty(delta) {
  currentModalQty += delta;
  if (currentModalQty < 1) currentModalQty = 1;
  document.getElementById('modal-qty-val').innerText = currentModalQty;
}

// Simpan dari Modal Ke Keranjang (+ SIMPAN KE KERANJANG)
function saveModalToCart() {
  if (!selectedProductForModal) return;
  const note = document.getElementById('modal-notes').value;
  addToCart(selectedProductForModal, currentModalQty, note);
  closeDetailModal();
}

let posSettings = {
  showImages: true,
  printMode: 'rawbt',
  paperSize: '58mm',
  headerName: 'KTLM Kitchen',
  address: '',
  waPhone: ''
};

function formatRupiah(angka) {
  return (angka || 0).toLocaleString('id-ID');
}

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
    filterProducts();
    renderCustomers();
  } catch (err) {
    console.error(err);
    alert("Gagal memuat data dari server.");
  }
}

function renderCustomers() {
  const custSelect = document.getElementById("customerSelect");
  if (!custSelect) return;
  if (allCustomers.length > 0) {
    custSelect.innerHTML = allCustomers.map(c => `<option value="${c.nama}">${c.nama}</option>`).join('');
  } else {
    custSelect.innerHTML = `<option value="Umum">Umum / Walk-in</option>`;
  }
}

function renderCategories() {
  const catBar = document.getElementById("categoryBar");
  if (!catBar) return;
  
  const activeProducts = allProducts.filter(p => {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    return statusAktif === 'Y';
  });

  const categories = ["ALL", ...new Set(activeProducts.map(p => p.kategori).filter(Boolean))];
  catBar.innerHTML = categories.map(cat => 
    `<button class="cat-btn ${cat==='ALL'?'active':''}" onclick="filterCategory('${cat}', this)">${cat}</button>`
  ).join('');
}

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
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
    
    const rawImgUrl = p['Link Gambar'] || p.linkGambar || p.gambar || p[10];
    const imgUrl = fixImageUrl(rawImgUrl);
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
              <div class="product-price">Rp${formatRupiah(p.harga)}</div>
            </div>

            ${isSelected ? `
              <div class="qty-badge-inline" onclick="event.stopPropagation()">
                <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', -1, event)">-</button>
                <input type="number" min="0" class="qty-input-inline" 
                       value="${totalQtyInCart}" 
                       onchange="onQtyDirectChange('${p.id}', this.value)"
                       onfocus="this.select()">
                <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', 1, event)">+</button>
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
            <div class="product-price">Rp${formatRupiah(p.harga)}</div>
            ${hasSub ? `<span class="variant-tag-inline">+ Variasi/Paket</span>` : ''}
          </div>
          
          ${isSelected ? `
            <div class="qty-badge-inline" onclick="event.stopPropagation()">
              <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', -1, event)">-</button>
              <input type="number" min="0" class="qty-input-inline" 
                     value="${totalQtyInCart}" 
                     onchange="onQtyDirectChange('${p.id}', this.value)"
                     onfocus="this.select()">
              <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', 1, event)">+</button>
            </div>
          ` : ''}
        </div>
      `;
    }
  }).join('');
}

function changeProductQtyInline(productId, delta, event) {
  if (event) event.stopPropagation();
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) {
    if (delta > 0) {
      openSubCategoryModal(product, subCategories);
    } else {
      const cartIdx = cart.map(i => i.product.id).lastIndexOf(productId);
      if (cartIdx !== -1) {
        updateQtyInCartList(cartIdx, -1);
      }
    }
  } else {
    const currentQty = cart.filter(c => c.product.id === productId).reduce((sum, i) => sum + i.qty, 0);
    updateDirectQty(productId, currentQty + delta);
  }
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
  const searchInput = document.getElementById("searchInput");
  const keyword = searchInput ? searchInput.value.toLowerCase() : "";
  
  let filtered = allProducts.filter(p => {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    const isAktif = statusAktif === 'Y';

    const matchCat = selectedCategory === "ALL" || p.kategori === selectedCategory;
    const matchSearch = p.nama.toLowerCase().includes(keyword);
    
    return isAktif && matchCat && matchSearch;
  });

  renderProducts(filtered);
}

function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  const itemCountEl = document.getElementById("barItemCount");
  const totalAmountEl = document.getElementById("barTotalAmount");
  const modalTotalEl = document.getElementById("modalTotalAmount");
  const btnCheckout = document.getElementById("btnOpenCheckout");

  if (itemCountEl) itemCountEl.innerText = `${totalQty} Item`;
  if (totalAmountEl) totalAmountEl.innerText = `Rp${formatRupiah(totalPrice)}`;
  if (modalTotalEl) modalTotalEl.innerText = `Rp${formatRupiah(totalPrice)}`;
  if (btnCheckout) btnCheckout.disabled = cart.length === 0;
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
  const container = document.getElementById("modalCartList");
  if (!container) return;
  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item-row">
      <div>
        <div class="cart-item-name">${item.product.nama}</div>
        ${item.subVariant ? `<div class="cart-item-sub">[ ${item.subVariant} ]</div>` : ''}
        <div class="cart-item-price">Rp${formatRupiah(item.product.harga)} x ${item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, -1)">-</button>
        <span style="font-size:13px; font-weight:bold;">${item.qty}</span>
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function openSettingsModal() {
  document.getElementById("settingShowImages").checked = posSettings.showImages;
  document.getElementById("settingPrintMode").value = posSettings.printMode;
  document.getElementById("settingPaperSize").value = posSettings.paperSize;
  document.getElementById("settingHeaderStore").value = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  document.getElementById("settingAddressStore").value = posSettings.address || storeConfig.Alamat || '';
  document.getElementById("settingWaStore").value = posSettings.waPhone || storeConfig.WA || '';
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

  filterProducts();
  alert("Pengaturan tersimpan!");
  closeSettingsModal();
}

function addQuickNote(text) {
  const noteInput = document.getElementById("orderNote");
  if (!noteInput) return;
  if (noteInput.value.trim() === "") {
    noteInput.value = text;
  } else {
    noteInput.value += ", " + text;
  }
}

async function processPayment() {
  if (cart.length === 0) return;

  const btnPay = document.querySelector("#checkoutModal .btn-confirm-pay");
  if (btnPay) {
    btnPay.disabled = true;
    btnPay.innerText = "PROSES SIMPAN...";
  }

  const now = new Date();
  const invoiceNo = "INV-" + now.getFullYear() + (now.getMonth()+1).toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + "-" + Math.floor(1000 + Math.random() * 9000);
  const waktuTx = now.toLocaleString('id-ID');
  const selectedCustomer = document.getElementById("customerSelect")?.value || "Umum";
  const selectedPayment = document.getElementById("paymentMethodSelect")?.value || "Tunai";
  const noteValue = document.getElementById("orderNote")?.value.trim() || "";
  
  const totalBelanja = cart.reduce((sum, i) => sum + ((i.product.harga || 0) * i.qty), 0);
  const totalHpp = cart.reduce((sum, i) => sum + ((i.product.hpp || 0) * i.qty), 0);
  
  let detailText = cart.map(i => {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += ` (${i.subVariant})`;
    return `${nameStr} (${i.qty}x)`;
  }).join(", ");

  if (noteValue) {
    detailText += ` | Catatan: ${noteValue}`;
  }

  const payload = {
    isCatalog: false,
    noInvoice: invoiceNo,
    waktu: waktuTx,
    customerName: selectedCustomer,
    detailItems: detailText,
    totalBelanja: totalBelanja,
    totalHpp: totalHpp,
    jenisPembayaran: selectedPayment,
    uangDiterima: totalBelanja,
    kembalian: 0,
    kasir: "Kasir",
    sumber: "Kasir",
    status: "SELESAI",
    cartItems: JSON.parse(JSON.stringify(cart)),
    note: noteValue
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    saveLastTransaction(payload);
    printReceipt(payload, noteValue);

    alert("Transaksi Berhasil Disimpan!");
    cart = [];
    if (document.getElementById("orderNote")) document.getElementById("orderNote").value = "";
    updateCartUI();
    closeCheckoutModal();
    filterProducts();
  } catch (err) {
    console.error("Gagal simpan:", err);
    alert("Koneksi gagal. Cek sambungan internet.");
  } finally {
    if (btnPay) {
      btnPay.disabled = false;
      btnPay.innerText = "BAYAR & PRINT STRUK";
    }
  }
}

function printReceipt(tx, note) {
  const storeTitle = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  const storeAddr = posSettings.address || storeConfig.Alamat || '';
  const storeWa = posSettings.waPhone || storeConfig.WA || '';
  const storeBottom = storeConfig["Bottom 1"] || 'Terima Kasih!';

  const itemsToPrint = (tx && tx.cartItems && tx.cartItems.length > 0) ? tx.cartItems : cart;
  const noteToPrint = note || (tx ? tx.note : "") || "";

  if (posSettings.printMode === 'rawbt') {
    let receiptText = `${storeTitle}\n${storeAddr}\nWA: ${storeWa}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `No: ${tx.noInvoice}\nTgl: ${tx.waktu}\nCust: ${tx.customerName}\nBayar: ${tx.jenisPembayaran}\n`;
    receiptText += `--------------------------------\n`;

    itemsToPrint.forEach(i => {
      let itemLabel = i.product.nama;
      if (i.subVariant) itemLabel += `\n  [${i.subVariant}]`;
      let itemTotal = i.qty * (i.product.harga || 0);
      receiptText += `${itemLabel}\n  ${i.qty} x Rp${formatRupiah(i.product.harga)} = Rp${formatRupiah(itemTotal)}\n`;
    });

    receiptText += `--------------------------------\n`;
    if (noteToPrint) receiptText += `Note: ${noteToPrint}\n--------------------------------\n`;
    receiptText += `TOTAL: Rp${formatRupiah(tx.totalBelanja)}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `${storeBottom}\n\n\n`;

    const intentUrl = "intent:" + encodeURIComponent(receiptText) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    window.location.href = intentUrl;
  } else {
    const receipt = document.getElementById("receipt-print");
    if (!receipt) return;
    receipt.style.display = "block";
    receipt.innerHTML = `
      <div style="text-align:center; font-weight:bold;">${storeTitle}</div>
      <div style="text-align:center;">${storeAddr}</div>
      <div style="text-align:center;">WA: ${storeWa}</div>
      ----------------------------------<br>
      No: ${tx.noInvoice}<br>
      Tgl: ${tx.waktu}<br>
      Cust: ${tx.customerName}<br>
      Bayar: ${tx.jenisPembayaran}<br>
      ----------------------------------<br>
      ${itemsToPrint.map(i => `
        <div>${i.product.nama} ${i.subVariant ? `<br><small>[${i.subVariant}]</small>` : ''}</div>
        <div style="display:flex; justify-content:space-between;">
          <span>${i.qty} x Rp${formatRupiah(i.product.harga)}</span>
          <span>Rp${formatRupiah(i.qty * (i.product.harga || 0))}</span>
        </div>
      `).join('')}
      ----------------------------------<br>
      ${noteToPrint ? `<div style="font-style:italic; margin-bottom:5px;">Note: ${noteToPrint}</div>----------------------------------<br>` : ''}
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>TOTAL:</span>
        <span>Rp${formatRupiah(tx.totalBelanja)}</span>
      </div>
      ----------------------------------<br>
      <div style="text-align:center; margin-top:8px;">${storeBottom}</div>
    `;
    window.print();
    receipt.style.display = "none";
  }
}

async function checkPendingOrders() {
  try {
    const res = await fetch(`${API_URL}?action=getPendingOrders`);
    const data = await res.json();
    pendingOrdersArr = data.orders || [];

    const badge = document.getElementById("orderBadge");
    if (badge) {
      badge.innerText = pendingOrdersArr.length;
      badge.style.display = pendingOrdersArr.length > 0 ? "inline-block" : "none";
    }
  } catch (err) {
    console.error("Gagal cek pesanan:", err);
  }
}

function openPendingOrdersModal() {
  renderPendingOrders();
  document.getElementById("pendingOrdersModal").style.display = "flex";
}

function closePendingOrdersModal() {
  document.getElementById("pendingOrdersModal").style.display = "none";
}

function renderPendingOrders() {
  const container = document.getElementById("pendingOrdersList");
  if (!container) return;

  if (pendingOrdersArr.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#6c757d; padding:20px;'>Belum ada pesanan masuk dari katalog.</p>";
    return;
  }

  container.innerHTML = pendingOrdersArr.map(order => `
    <div style="background:#f8f9fa; border:1px solid #dee2e6; border-radius:10px; padding:12px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="color:#1b5e20;">${order.noInvoice}</strong>
        <span style="font-size:11px; color:#6c757d;">${order.waktu}</span>
      </div>
      <div style="font-size:13px; font-weight:bold; margin-bottom:4px;">Pelanggan: ${order.customerName}</div>
      <div style="font-size:12px; color:#333; background:#fff; padding:8px; border-radius:6px; border:1px solid #eee; margin-bottom:8px;">
        ${order.detailItems}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:bold; margin-bottom:10px;">
        <span>Total: Rp${formatRupiah(order.totalBelanja)}</span>
        <span style="color:#2e7d32; font-size:11px; background:#e8f5e9; padding:2px 8px; border-radius:4px;">${order.jenisPembayaran}</span>
      </div>
      <button onclick="processAndPrintCatalogOrder(${order.rowNum})" class="btn-confirm-pay" style="padding:10px; font-size:13px;">
        🖨️ PROSES & PRINT STRUK
      </button>
    </div>
  `).join('');
}

async function processAndPrintCatalogOrder(rowNum) {
  const order = pendingOrdersArr.find(o => o.rowNum === rowNum);
  if (!order) return;

  const catalogPayload = { ...order, isCatalog: true };
  saveLastTransaction(catalogPayload);

  printReceiptFromCatalog(order);

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "updateStatus",
        rowNum: order.rowNum
      })
    });

    alert(`Pesanan ${order.noInvoice} berhasil diproses!`);
    checkPendingOrders();
    closePendingOrdersModal();
  } catch (err) {
    console.error("Gagal update status:", err);
    alert("Gagal memperbarui status di Google Sheet.");
  }
}

function printReceiptFromCatalog(order) {
  const storeTitle = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  const storeAddr = posSettings.address || storeConfig.Alamat || '';
  const storeWa = posSettings.waPhone || storeConfig.WA || '';
  const storeBottom = storeConfig["Bottom 1"] || 'Terima Kasih!';

  let formattedItemsText = "";
  let htmlItemsText = "";

  let [rawItems, noteText] = (order.detailItems || "").split(/\|\s*Catatan:\s*/i);
  let itemList = rawItems.split(",").map(i => i.trim()).filter(Boolean);

  itemList.forEach(itemStr => {
    const match = itemStr.match(/^(.*?)(?:\s*\((?:(\d+)x)\))?$/);
    let name = itemStr;
    let qty = 1;

    if (match) {
      name = match[1].trim();
      if (match[2]) qty = parseInt(match[2], 10) || 1;
    }

    let product = allProducts.find(p => 
      name.toLowerCase().includes(p.nama.toLowerCase()) || 
      p.nama.toLowerCase().includes(name.toLowerCase())
    );
    let unitPrice = product ? (product.harga || 0) : 0;
    let itemTotal = unitPrice * qty;

    if (unitPrice > 0) {
      formattedItemsText += `${name}\n  ${qty} x Rp${formatRupiah(unitPrice)} = Rp${formatRupiah(itemTotal)}\n`;
    } else {
      formattedItemsText += `${name}\n  ${qty}x\n`;
    }

    htmlItemsText += `
      <div>${name}</div>
      <div style="display:flex; justify-content:space-between;">
        <span>${qty} x Rp${formatRupiah(unitPrice)}</span>
        <span>Rp${formatRupiah(itemTotal)}</span>
      </div>
    `;
  });

  if (posSettings.printMode === 'rawbt') {
    let receiptText = `${storeTitle}\n${storeAddr}\nWA: ${storeWa}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `No: ${order.noInvoice}\nTgl: ${order.waktu}\nCust: ${order.customerName}\nBayar: ${order.jenisPembayaran}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `${formattedItemsText}`;
    receiptText += `--------------------------------\n`;
    if (noteText) receiptText += `Note: ${noteText.trim()}\n--------------------------------\n`;
    receiptText += `TOTAL: Rp${formatRupiah(order.totalBelanja)}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `${storeBottom}\n\n\n`;

    const intentUrl = "intent:" + encodeURIComponent(receiptText) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    window.location.href = intentUrl;
  } else {
    const receipt = document.getElementById("receipt-print");
    if (!receipt) return;
    receipt.style.display = "block";
    receipt.innerHTML = `
      <div style="text-align:center; font-weight:bold;">${storeTitle}</div>
      <div style="text-align:center;">${storeAddr}</div>
      <div style="text-align:center;">WA: ${storeWa}</div>
      ----------------------------------<br>
      No: ${order.noInvoice}<br>
      Tgl: ${order.waktu}<br>
      Cust: ${order.customerName}<br>
      Bayar: ${order.jenisPembayaran}<br>
      ----------------------------------<br>
      ${htmlItemsText}
      ----------------------------------<br>
      ${noteText ? `<div style="font-style:italic; margin-bottom:5px;">Note: ${noteText.trim()}</div>----------------------------------<br>` : ''}
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>TOTAL:</span>
        <span>Rp${formatRupiah(order.totalBelanja)}</span>
      </div>
      ----------------------------------<br>
      <div style="text-align:center; margin-top:8px;">${storeBottom}</div>
    `;
    window.print();
    receipt.style.display = "none";
  }
}

function saveLastTransaction(payloadData) {
  lastTransaction = payloadData;
  localStorage.setItem("lastPOSOrder", JSON.stringify(payloadData));
  showReprintToast();
}

function showReprintToast() {
  const toast = document.getElementById("toastReprint");
  if (toast) toast.style.display = "flex";
}

function hideReprintToast() {
  const toast = document.getElementById("toastReprint");
  if (toast) toast.style.display = "none";
}

function cetakUlangStrukTerakhir() {
  const data = lastTransaction || JSON.parse(localStorage.getItem("lastPOSOrder"));
  if (!data) {
    alert("Belum ada data transaksi terakhir.");
    return;
  }
  
  if (data.isCatalog) {
    printReceiptFromCatalog(data);
  } else {
    printReceipt(data, data.note);
  }
}

// Inisialisasi
loadData();
setInterval(checkPendingOrders, 15000);
checkPendingOrders();
