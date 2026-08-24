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
let currentModalProduct = null;
let currentModalQty = 1;

let posSettings = {
  showImages: true,
  printMode: 'rawbt',
  paperSize: '58mm',
  headerName: 'KTLM Kitchen',
  address: '',
  waPhone: ''
};

// =========================================
// INIT & LOAD DATA
// =========================================
function formatRupiah(angka) {
  return (angka || 0).toLocaleString('id-ID');
}

function initSettings() {
  const saved = localStorage.getItem('ktlm_pos_settings');
  if (saved) {
    try {
      posSettings = Object.assign(posSettings, JSON.parse(saved));
    } catch (e) {}
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
  } catch (err) {
    console.error(err);
    alert("Gagal memuat data dari server.");
  }
}

function syncDatabase() {
  loadData();
  alert("Database berhasil diperbarui!");
  closeSettingsModal();
}

// =========================================
// CATEGORY & SEARCH
// =========================================
function renderCategories() {
  const catBar = document.getElementById("categoryBar");
  if (!catBar) return;

  const activeProducts = allProducts.filter(p => {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    return statusAktif === 'Y';
  });

  const categories = ["ALL", ...new Set(activeProducts.map(p => p.kategori).filter(Boolean))];
  catBar.innerHTML = categories.map(cat =>
    `<button class="cat-btn ${cat === 'ALL' ? 'active' : ''}" onclick="filterCategory('${cat}', this)">${cat}</button>`
  ).join('');
}

function filterCategory(cat, btn) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterProducts();
}

function handleSearch() {
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

// =========================================
// PRODUCT RENDER (SESUAI GAMBAR 1)
// =========================================
function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  if (products.length === 0) {
    grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: #6c757d; padding: 20px;">Produk tidak ditemukan</p>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const totalQtyInCart = cart
      .filter(c => c.product.id === p.id)
      .reduce((sum, i) => sum + i.qty, 0);

    const rawImgUrl = p['Link Gambar'] || p.linkGambar || p.gambar || p[10];
    const imgUrl = fixImageUrl(rawImgUrl);
    const isSelected = totalQtyInCart > 0;

    // Tombol di bagian bawah produk (Tombol 'Add' jika Qty 0, atau counter '- 1 +' jika Qty > 0)
    const actionButtonHtml = totalQtyInCart > 0 
      ? `<div class="qty-counter-box" onclick="event.stopPropagation()">
           <button class="btn-qty-mini" onclick="updateDirectQty('${p.id}', ${totalQtyInCart - 1})">-</button>
           <span class="counter-val">${totalQtyInCart}</span>
           <button class="btn-qty-mini" onclick="handleProductClick('${p.id}', event)">+</button>
         </div>`
      : `<button class="btn-add-card" onclick="handleProductClick('${p.id}', event)">Add</button>`;

    return `
      <div class="product-card ${isSelected ? 'has-selected' : ''}">
        <div class="product-img-wrapper" onclick="openDetailModal('${p.id}')">
          <img src="${imgUrl}" alt="${p.nama}" class="product-img" onerror="this.src='${DEFAULT_PLACEHOLDER}'" loading="lazy">
        </div>
        
        <div class="product-details" onclick="openDetailModal('${p.id}')">
          <div class="product-title">${p.nama}</div>
          <div class="product-price">Rp${formatRupiah(p.harga)}</div>
          <div style="margin-top: 10px;" onclick="event.stopPropagation()">
            ${actionButtonHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// =========================================
// MODAL DETAIL PRODUK (SESUAI GAMBAR 2)
// =========================================
function openDetailModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  currentModalProduct = product;
  currentModalQty = 1;

  const rawImgUrl = product['Link Gambar'] || product.linkGambar || product.gambar || product[10];
  
  // Mengambil Keterangan dari Kolom F Google Sheet (index 5 / properti keterangan)
  const desc = product.keterangan || product.deskripsi || product['Keterangan'] || product['Deskripsi'] || product[5] || '';

  document.getElementById('modal-img').src = fixImageUrl(rawImgUrl);
  document.getElementById('modal-title').innerText = product.nama;
  
  const descEl = document.getElementById('modal-desc');
  if (descEl) descEl.innerText = desc;

  document.getElementById('modal-price').innerText = "Rp" + formatRupiah(product.harga);
  document.getElementById('modal-qty-val').innerText = currentModalQty;
  document.getElementById('modal-notes').value = '';

  document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
  currentModalProduct = null;
}

function changeModalQty(delta) {
  currentModalQty = Math.max(1, currentModalQty + delta);
  document.getElementById('modal-qty-val').innerText = currentModalQty;
}

function saveModalToCart() {
  if (!currentModalProduct) return;
  const notesInput = document.getElementById('modal-notes').value.trim();

  addToCart(currentModalProduct, currentModalQty, notesInput);
  closeDetailModal();
}

function handleProductClick(id, event) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  addToCart(product, 1, "");
}

// =========================================
// KERANJANG & KONTROL QTY
// =========================================
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
  renderCartList();
  filterProducts();

  if (cart.length === 0) {
    closeCartModal();
  }
}

function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  const totalItemsText = document.getElementById("totalItemsText");
  const totalPriceText = document.getElementById("totalPriceText");
  const cartTotalPrice = document.getElementById("cartTotalPrice");
  const btnCheckout = document.getElementById("btnCheckout");

  if (totalItemsText) totalItemsText.innerText = `${totalQty} Item`;
  if (totalPriceText) totalPriceText.innerText = `Rp${formatRupiah(totalPrice)}`;
  if (cartTotalPrice) cartTotalPrice.innerText = `Rp${formatRupiah(totalPrice)}`;
  if (btnCheckout) btnCheckout.disabled = cart.length === 0;

  calculateChange();
}

// =========================================
// MODAL KERANJANG & PEMBAYARAN
// =========================================
function openCartModal() {
  if (cart.length === 0) return;
  renderCartList();
  handlePaymentMethodChange();
  document.getElementById("cart-modal").style.display = "flex";
}

function closeCartModal() {
  document.getElementById("cart-modal").style.display = "none";
}

function renderCartList() {
  const container = document.getElementById("cartItemList");
  if (!container) return;
  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <div>
        <div style="font-weight: 700; font-size: 13px;">${item.product.nama}</div>
        ${item.subVariant ? `<div style="font-size: 11px; color: #6c757d;">[ ${item.subVariant} ]</div>` : ''}
        <div style="font-size: 12px; color: #2e7d32; font-weight: 700;">Rp${formatRupiah(item.product.harga)}</div>
      </div>
      <div class="qty-badge-inline">
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, -1)">-</button>
        <span class="counter-val">${item.qty}</span>
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function handlePaymentMethodChange() {
  const method = document.getElementById("paymentMethod")?.value;
  const cashContainer = document.getElementById("cashInputContainer");
  const changeRow = document.getElementById("changeDisplayRow");

  if (method === "CASH") {
    if (cashContainer) cashContainer.style.display = "flex";
    if (changeRow) changeRow.style.display = "flex";
  } else {
    if (cashContainer) cashContainer.style.display = "none";
    if (changeRow) changeRow.style.display = "none";
  }
  calculateChange();
}

function calculateChange() {
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);
  const cashPaid = parseFloat(document.getElementById("cashPaidInput")?.value) || 0;
  const change = cashPaid - totalPrice;

  const changeEl = document.getElementById("changeText");
  if (changeEl) {
    if (change < 0) {
      changeEl.innerText = "Kurang Rp" + formatRupiah(Math.abs(change));
      changeEl.style.color = "#d32f2f";
    } else {
      changeEl.innerText = "Rp" + formatRupiah(change);
      changeEl.style.color = "#2e7d32";
    }
  }
}

function setQuickCash(amount) {
  const input = document.getElementById("cashPaidInput");
  if (input) {
    input.value = amount;
    calculateChange();
  }
}

function setExactCash() {
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);
  const input = document.getElementById("cashPaidInput");
  if (input) {
    input.value = totalPrice;
    calculateChange();
  }
}

// =========================================
// SUBMIT TRANSAKSI & STRUK PRINT
// =========================================
async function submitOrder() {
  if (cart.length === 0) return;

  const method = document.getElementById("paymentMethod")?.value || "CASH";
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);
  const cashPaid = parseFloat(document.getElementById("cashPaidInput")?.value) || 0;

  if (method === "CASH" && cashPaid < totalPrice) {
    alert("Jumlah uang diterima kurang dari total pembayaran!");
    return;
  }

  const btnPay = document.querySelector("#cart-modal .btn-confirm-pay");
  if (btnPay) {
    btnPay.disabled = true;
    btnPay.innerText = "PROSES SIMPAN...";
  }

  const now = new Date();
  const invoiceNo = "INV-" + now.getFullYear() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0') + "-" + Math.floor(1000 + Math.random() * 9000);
  const waktuTx = now.toLocaleString('id-ID');

  const totalHpp = cart.reduce((sum, i) => sum + ((i.product.hpp || 0) * i.qty), 0);

  let detailText = cart.map(i => {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += ` (${i.subVariant})`;
    return `${nameStr} (${i.qty}x)`;
  }).join(", ");

  const payload = {
    noInvoice: invoiceNo,
    waktu: waktuTx,
    customerName: "Umum",
    detailItems: detailText,
    totalBelanja: totalPrice,
    totalHpp: totalHpp,
    jenisPembayaran: method,
    uangDiterima: method === "CASH" ? cashPaid : totalPrice,
    kembalian: method === "CASH" ? Math.max(0, cashPaid - totalPrice) : 0,
    kasir: "Kasir",
    sumber: "Kasir",
    status: "SELESAI"
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    printReceipt(payload, "");

    alert("Transaksi Berhasil Disimpan!");
    cart = [];
    const cashInput = document.getElementById("cashPaidInput");
    if (cashInput) cashInput.value = "";
    updateCartUI();
    closeCartModal();
    filterProducts();
  } catch (err) {
    console.error("Gagal simpan:", err);
    alert("Koneksi gagal. Cek sambungan internet.");
  } finally {
    if (btnPay) {
      btnPay.disabled = false;
      btnPay.innerText = "Proses Transaksi";
    }
  }
}

function printReceipt(tx, note) {
  const storeTitle = posSettings.headerName || storeConfig.Header || 'Toko Damai POS';
  const storeAddr = posSettings.address || storeConfig.Alamat || '';
  const storeWa = posSettings.waPhone || storeConfig.WA || '';
  const storeBottom = storeConfig["Bottom 1"] || 'Terima Kasih!';

  if (posSettings.printMode === 'rawbt') {
    let receiptText = `${storeTitle}\n${storeAddr}\nWA: ${storeWa}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `No: ${tx.noInvoice}\nTgl: ${tx.waktu}\nCust: ${tx.customerName}\nBayar: ${tx.jenisPembayaran}\n`;
    receiptText += `--------------------------------\n`;

    cart.forEach(i => {
      let itemLabel = i.product.nama;
      if (i.subVariant) itemLabel += `\n  [${i.subVariant}]`;
      let itemTotal = i.qty * (i.product.harga || 0);
      receiptText += `${itemLabel}\n  ${i.qty} x Rp${formatRupiah(i.product.harga)} = Rp${formatRupiah(itemTotal)}\n`;
    });

    receiptText += `--------------------------------\n`;
    if (note) receiptText += `Note: ${note}\n--------------------------------\n`;
    receiptText += `TOTAL: Rp${formatRupiah(tx.totalBelanja)}\n`;
    if (tx.jenisPembayaran === 'CASH') {
      receiptText += `TUNAI: Rp${formatRupiah(tx.uangDiterima)}\n`;
      receiptText += `KEMBALI: Rp${formatRupiah(tx.kembalian)}\n`;
    }
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
      ${cart.map(i => `
        <div>${i.product.nama} ${i.subVariant ? `<br><small>[${i.subVariant}]</small>` : ''}</div>
        <div style="display:flex; justify-content:space-between;">
          <span>${i.qty} x Rp${formatRupiah(i.product.harga)}</span>
          <span>Rp${formatRupiah(i.qty * (i.product.harga || 0))}</span>
        </div>
      `).join('')}
      ----------------------------------<br>
      ${note ? `<div style="font-style:italic; margin-bottom:5px;">Note: ${note}</div>----------------------------------<br>` : ''}
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>TOTAL:</span>
        <span>Rp${formatRupiah(tx.totalBelanja)}</span>
      </div>
      ${tx.jenisPembayaran === 'CASH' ? `
      <div style="display:flex; justify-content:space-between;">
        <span>Bayar:</span>
        <span>Rp${formatRupiah(tx.uangDiterima)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Kembali:</span>
        <span>Rp${formatRupiah(tx.kembalian)}</span>
      </div>
      ` : ''}
      ----------------------------------<br>
      <div style="text-align:center; margin-top:8px;">${storeBottom}</div>
    `;
    window.print();
    receipt.style.display = "none";
  }
}

// =========================================
// MODAL PENGATURAN
// =========================================
function openSettingsModal() {
  const paperSelect = document.getElementById("printerPaperSize");
  if (paperSelect) paperSelect.value = posSettings.paperSize;
  document.getElementById("settings-modal").style.display = "flex";
}

function closeSettingsModal() {
  document.getElementById("settings-modal").style.display = "none";
}

loadData();
