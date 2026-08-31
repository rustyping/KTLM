/* =========================================================================
   SISTEM KASIR KTLM KITCHEN (kasir.js)
   Diperbarui dengan Fitur Tarik Pesanan Katalog ke Keranjang Kasir (Bisa Edit & Tambah Ongkir)
   ========================================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>KTLM</text></svg>";

/* --- VARIABEL GLOBAL --- */
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
let currentCartSubtotal = 0;  

// Tambahan Variabel untuk mengingat pesanan katalog mana yang sedang diedit
let activeCatalogOrder = null; 

/* --- PENGATURAN KASIR --- */
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
    alert("Gagal memuat data dari server. Pastikan HP terkoneksi internet.");
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
          
          <div class="product-details" style="flex-direction: column; align-items: stretch;">
            <div class="product-info-text">
              <div class="product-title">${p.nama}</div>
              <div class="product-price">Rp${formatRupiah(p.harga)}</div>
            </div>

            ${isSelected ? `
              <div class="qty-badge-inline" style="margin-top:6px; justify-content:space-between;" onclick="event.stopPropagation()">
                <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', -1, event)">-</button>
                <input type="number" min="0" class="qty-input-inline" 
                       value="${totalQtyInCart}" 
                       onchange="onQtyDirectChange('${p.id}', this.value)"
                       onfocus="this.select()">
                <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', 1, event)">+</button>
              </div>
            ` : `
              <button type="button" class="btn-add-action" onclick="handleAddClick('${p.id}', event)">Add</button>
            `}
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
          
          <div onclick="event.stopPropagation()">
            ${isSelected ? `
              <div class="qty-badge-inline">
                <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', -1, event)">-</button>
                <input type="number" min="0" class="qty-input-inline" 
                       value="${totalQtyInCart}" 
                       onchange="onQtyDirectChange('${p.id}', this.value)"
                       onfocus="this.select()">
                <button type="button" class="btn-qty-card" onclick="changeProductQtyInline('${p.id}', 1, event)">+</button>
              </div>
            ` : `
              <button type="button" class="btn-add-action" style="padding: 4px 16px; margin-top:0;" onclick="handleAddClick('${p.id}', event)">Add</button>
            `}
          </div>
        </div>
      `;
    }
  }).join('');
}

function handleAddClick(productId, event) {
  if (event) event.stopPropagation(); 
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const subCategories = getSubCategoriesForProduct(product);
  
  if (subCategories.length > 0) openSubCategoryModal(product, subCategories);
  else addToCart(product, 1, "");
}

function changeProductQtyInline(productId, delta, event) {
  if (event) event.stopPropagation();
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);
  if (subCategories.length > 0) {
    if (delta > 0) openSubCategoryModal(product, subCategories);
    else {
      const cartIdx = cart.map(i => i.product.id).lastIndexOf(productId);
      if (cartIdx !== -1) updateQtyInCartList(cartIdx, -1);
    }
  } else {
    const currentQty = cart.filter(c => c.product.id === productId).reduce((sum, i) => sum + i.qty, 0);
    updateDirectQty(productId, currentQty + delta);
  }
}

function onQtyDirectChange(productId, val) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  let newQty = parseInt(val) || 0;
  if (newQty < 0) newQty = 0; 
  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) openSubCategoryModal(product, subCategories);
  else updateDirectQty(productId, newQty);
}

function getSubCategoriesForProduct(product) {
  if (!allSubcategories || allSubcategories.length === 0) return [];
  return allSubcategories.filter(s => 
    (s.id_produk && s.id_produk.toString().toLowerCase() === product.id.toString().toLowerCase()) ||
    (s.produk && s.produk.toString().toLowerCase() === product.nama.toString().toLowerCase())
  );
}

/* =========================================================
   MODAL DETAIL PRODUK 
   ========================================================= */
let currentDetailProduct = null;
let currentDetailQty = 1;

function handleProductClick(id, event) {
  if (event) event.stopPropagation();
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  openDetailModal(product);
}

function openDetailModal(product) {
  currentDetailProduct = product;
  const existingItem = cart.find(item => item.product.id === product.id);
  currentDetailQty = existingItem ? existingItem.qty : 1; 

  const rawImgUrl = product['Link Gambar'] || product.linkGambar || product.gambar || product[10];
  const imgUrl = fixImageUrl(rawImgUrl);
  
  document.getElementById('detailModalHeaderTitle').innerText = product.nama;
  document.getElementById('detailModalTitle').innerText = product.nama;
  document.getElementById('detailModalImg').src = imgUrl;

  const desc = product.deskripsi || product.Deskripsi || product.keterangan || product.Keterangan || "";
  const descEl = document.getElementById('detailModalDesc');
  descEl.innerText = desc;
  descEl.style.display = desc ? "block" : "none"; 

  document.getElementById('detailModalPrice').innerText = 'Rp' + formatRupiah(product.harga);
  document.getElementById('detailModalNote').value = existingItem ? (existingItem.itemNote || "") : "";
  document.getElementById('detailModalQty').value = currentDetailQty;
  document.getElementById('detailModal').style.display = 'flex'; 
}

function closeDetailModal() {
  document.getElementById('detailModal').style.display = 'none';
  currentDetailProduct = null;
}

function adjustDetailModalQty(delta) {
  currentDetailQty = Math.max(0, currentDetailQty + delta);
  document.getElementById("detailModalQty").value = currentDetailQty;
}

function handleModalQtyManualChange(val) {
  let newQty = parseInt(val) || 0;
  if (newQty < 0) newQty = 0;
  currentDetailQty = newQty;
  document.getElementById("detailModalQty").value = currentDetailQty;
}

function saveDetailModalToCart() {
  if (!currentDetailProduct) return;
  const productToSave = currentDetailProduct;
  const qtyToSave = currentDetailQty;
  
  const subCategories = getSubCategoriesForProduct(productToSave);
  const itemNote = document.getElementById("detailModalNote").value.trim();

  closeDetailModal();

  if (subCategories.length > 0) {
    window.tempItemNote = itemNote; 
    openSubCategoryModal(productToSave, subCategories);
  } else {
    const existingIndex = cart.findIndex(item => item.product.id === productToSave.id);
    if (qtyToSave <= 0) {
      if (existingIndex !== -1) cart.splice(existingIndex, 1);
    } else {
      if (existingIndex !== -1) {
        cart[existingIndex].qty = qtyToSave;
        cart[existingIndex].itemNote = itemNote;
      } else {
        cart.push({ product: productToSave, qty: qtyToSave, subVariant: "", itemNote: itemNote });
      }
    }
    updateCartUI();
    filterProducts();
  }
}

/* =========================================================
   MANAJEMEN KERANJANG UTAMA
   ========================================================= */

function addToCart(product, qty, subVariant, itemNote = "") {
  if (window.tempItemNote) {
    itemNote = window.tempItemNote;
    window.tempItemNote = ""; 
  }
  const existing = cart.find(item => item.product.id === product.id && item.subVariant === subVariant && item.itemNote === itemNote);
  if (existing) existing.qty += qty;
  else cart.push({ product: product, qty: qty, subVariant: subVariant || "", itemNote: itemNote });
  updateCartUI();
  filterProducts();
}

function updateDirectQty(productId, newQty) {
  const existingIndex = cart.findIndex(item => item.product.id === productId);
  if (newQty <= 0) {
    if (existingIndex !== -1) cart.splice(existingIndex, 1);
  } else {
    if (existingIndex !== -1) cart[existingIndex].qty = newQty;
    else {
      const product = allProducts.find(p => p.id === productId);
      if (product) cart.push({ product: product, qty: newQty, subVariant: "", itemNote: "" });
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
  
  const checkoutModal = document.getElementById("checkoutModal");
  if (checkoutModal && checkoutModal.style.display === "flex") {
    currentCartSubtotal = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);
    updateCheckoutTotalSummary();
  }

  // Jika keranjang benar-benar dikosongkan secara manual, hapus ingatan pesanan katalognya
  if (cart.length === 0) {
    activeCatalogOrder = null;
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
    return (statusAktif === 'Y') && 
           (selectedCategory === "ALL" || p.kategori === selectedCategory) && 
           (p.nama.toLowerCase().includes(keyword));
  });
  renderProducts(filtered);
}

function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  const itemCountEl = document.getElementById("barItemCount");
  const totalAmountEl = document.getElementById("barTotalAmount");
  const btnCheckout = document.getElementById("btnOpenCheckout");

  if (itemCountEl) itemCountEl.innerText = `${totalQty} Item`;
  if (totalAmountEl) totalAmountEl.innerText = `Rp${formatRupiah(totalPrice)}`;
  if (btnCheckout) btnCheckout.disabled = cart.length === 0; 
}

/* =========================================================
   MODAL CHECKOUT (FORM KASIR)
   ========================================================= */

function openCheckoutModal() {
  if (cart.length === 0) return;
  currentCartSubtotal = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);
  
  const shippingInput = document.getElementById('shippingCostInput');
  // Hanya reset ongkir ke 0 JIKA bukan hasil tarikan pesanan katalog
  if (shippingInput && activeCatalogOrder == null) shippingInput.value = 0;

  renderModalCartList(); 
  updateCheckoutTotalSummary(); 
  document.getElementById("checkoutModal").style.display = "flex";
}

function closeCheckoutModal() {
  document.getElementById("checkoutModal").style.display = "none";
}

function handleShippingInput(inputEl) {
  let rawValue = inputEl.value.replace(/[^0-9]/g, '');
  if (rawValue === "") {
    inputEl.value = "0";
    rawValue = "0";
  }
  inputEl.value = parseInt(rawValue, 10).toLocaleString('id-ID');
  updateCheckoutTotalSummary(); 
}

function updateCheckoutTotalSummary() {
  const shippingInput = document.getElementById('shippingCostInput');
  const rawShipping = shippingInput ? shippingInput.value.replace(/[^0-9]/g, '') : "0";
  const shippingCost = parseInt(rawShipping, 10) || 0;

  const grandTotal = currentCartSubtotal + shippingCost;
  const totalEl = document.getElementById('modalTotalAmount');
  if (totalEl) totalEl.innerText = 'Rp' + formatRupiah(grandTotal);
}

function renderModalCartList() {
  const container = document.getElementById("modalCartList");
  if (!container) return;
  
  // Tambahkan pita informasi jika ini adalah pesanan dari katalog
  let headerInfo = "";
  if (activeCatalogOrder) {
    headerInfo = `<div style="background:#e3f2fd; color:#1565c0; padding:8px; border-radius:6px; font-size:12px; font-weight:bold; margin-bottom:10px;">
                    MENGEDIT PESANAN ONLINE (${activeCatalogOrder.noInvoice})
                  </div>`;
  }

  let itemsHtml = cart.map((item, idx) => `
    <div class="cart-item-row">
      <div>
        <div class="cart-item-name">${item.product.nama}</div>
        ${item.subVariant ? `<div class="cart-item-sub">[ ${item.subVariant} ]</div>` : ''}
        ${item.itemNote ? `<div class="cart-item-sub" style="color:#d32f2f; font-weight:bold;">Catatan: ${item.itemNote}</div>` : ''}
        <div class="cart-item-price">Rp${formatRupiah(item.product.harga)} x ${item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, -1)">-</button>
        <span style="font-size:13px; font-weight:bold;">${item.qty}</span>
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = headerInfo + itemsHtml;
}

function addQuickNote(text) {
  const noteInput = document.getElementById("orderNote");
  if (!noteInput) return;
  if (noteInput.value.trim() === "") noteInput.value = text;
  else noteInput.value += ", " + text;
}

/* =========================================================
   PENGATURAN KASIR
   ========================================================= */
function openSettingsModal() {
  document.getElementById("settingShowImages").checked = posSettings.showImages;
  document.getElementById("settingPrintMode").value = posSettings.printMode;
  document.getElementById("settingPaperSize").value = posSettings.paperSize;
  document.getElementById("settingHeaderStore").value = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  document.getElementById("settingAddressStore").value = posSettings.address || storeConfig.Alamat || '';
  document.getElementById("settingWaStore").value = posSettings.waPhone || storeConfig.WA || '';
  document.getElementById("settingsModal").style.display = "flex";
}

function closeSettingsModal() { document.getElementById("settingsModal").style.display = "none"; }

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

/* =========================================================
   PROSES SIMPAN & CETAK STRUK UTAMA
   ========================================================= */

async function processPayment() {
  if (cart.length === 0) return;

  const btnPay = document.querySelector("#checkoutModal .btn-confirm-pay");
  if (btnPay) {
    btnPay.disabled = true; 
    btnPay.innerText = "PROSES SIMPAN...";
  }

  const now = new Date();
  const waktuTx = now.toLocaleString('id-ID');
  
  // Gunakan invoice lama jika ini meneruskan orderan katalog, atau buat baru jika walk-in
  const invoiceNo = activeCatalogOrder ? activeCatalogOrder.noInvoice : "INV-" + now.getFullYear() + (now.getMonth()+1).toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + "-" + Math.floor(1000 + Math.random() * 9000);
  
  const selectedCustomer = document.getElementById("customerSelect")?.value || "Umum";
  const selectedPayment = document.getElementById("paymentMethodSelect")?.value || "Tunai";
  const noteValue = document.getElementById("orderNote")?.value.trim() || "";
  
  const shippingInput = document.getElementById('shippingCostInput');
  const rawShipping = shippingInput ? shippingInput.value.replace(/[^0-9]/g, '') : "0";
  const shippingCost = parseInt(rawShipping, 10) || 0;
  
  const totalHpp = cart.reduce((sum, i) => sum + ((i.product.hpp || 0) * i.qty), 0);
  const totalProduk = cart.reduce((sum, i) => sum + ((i.product.harga || 0) * i.qty), 0);
  const totalBelanja = totalProduk + shippingCost; 
  
  let detailText = cart.map(i => {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += ` (${i.subVariant})`;
    if (i.itemNote) nameStr += ` [Note: ${i.itemNote}]`; 
    return `${nameStr} (${i.qty}x)`;
  }).join(", ");

  if (shippingCost > 0) detailText += ` | +Ongkir: Rp${formatRupiah(shippingCost)}`;
  if (noteValue) detailText += ` | Catatan Pesanan: ${noteValue}`;

  const payload = {
    isCatalog: (activeCatalogOrder != null), // Tanda kalau ini berasal dari pesanan online
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
    note: noteValue,
    ongkir: shippingCost 
  };

  try {
    // 1. Simpan Transaksi Penjualan ke Sheet (Sebagai Baris Baru yang Valid)
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    // 2. PERBAIKAN: Ubah status baris pesanan lama menjadi BATAL agar tidak dihitung ganda
    if (activeCatalogOrder && activeCatalogOrder.rowNum) {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
            action: "updateStatus", 
            rowNum: activeCatalogOrder.rowNum,
            status: "BATAL (DIEDIT)" // <-- Mematikan data ganda
        })
      });
    }

    saveLastTransaction(payload);
    printReceipt(payload, noteValue);

    alert("Transaksi Berhasil Disimpan & Dicetak!");
    
    // Pembersihan Sistem
    cart = [];
    activeCatalogOrder = null; // Putuskan memori orderan online
    if (document.getElementById("orderNote")) document.getElementById("orderNote").value = "";
    if (document.getElementById("shippingCostInput")) document.getElementById("shippingCostInput").value = 0;
    
    updateCartUI();
    closeCheckoutModal();
    filterProducts(); 
    checkPendingOrders(); // Refresh lonceng notifikasi di atas
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
  const ongkir = tx.ongkir || 0;
  const subtotal = tx.totalBelanja - ongkir;

  if (posSettings.printMode === 'rawbt') {
    let receiptText = `${storeTitle}\n${storeAddr}\nWA: ${storeWa}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `No: ${tx.noInvoice}\nTgl: ${tx.waktu}\nCust: ${tx.customerName}\nBayar: ${tx.jenisPembayaran}\n`;
    receiptText += `--------------------------------\n`;

    itemsToPrint.forEach(i => {
      let itemLabel = i.product.nama;
      if (i.subVariant) itemLabel += `\n  [${i.subVariant}]`;
      if (i.itemNote) itemLabel += `\n  *Note: ${i.itemNote}`;
      let itemTotal = i.qty * (i.product.harga || 0);
      receiptText += `${itemLabel}\n  ${i.qty} x Rp${formatRupiah(i.product.harga)} = Rp${formatRupiah(itemTotal)}\n`;
    });

    receiptText += `--------------------------------\n`;
    
    if (ongkir > 0) {
      receiptText += `Subtotal : Rp${formatRupiah(subtotal)}\n`;
      receiptText += `Ongkir   : Rp${formatRupiah(ongkir)}\n`;
      receiptText += `--------------------------------\n`;
    }

    if (noteToPrint) receiptText += `Catatan: ${noteToPrint}\n--------------------------------\n`;
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
        <div>
          ${i.product.nama} 
          ${i.subVariant ? `<br><small>[${i.subVariant}]</small>` : ''}
          ${i.itemNote ? `<br><small style="font-weight:bold;">*Note: ${i.itemNote}</small>` : ''}
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>${i.qty} x Rp${formatRupiah(i.product.harga)}</span>
          <span>Rp${formatRupiah(i.qty * (i.product.harga || 0))}</span>
        </div>
      `).join('')}
      ----------------------------------<br>
      
      ${ongkir > 0 ? `
        <div style="display:flex; justify-content:space-between;">
          <span>Subtotal:</span>
          <span>Rp${formatRupiah(subtotal)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Ongkir:</span>
          <span>Rp${formatRupiah(ongkir)}</span>
        </div>
        ----------------------------------<br>
      ` : ''}

      ${noteToPrint ? `<div style="font-style:italic; margin-bottom:5px;">Catatan: ${noteToPrint}</div>----------------------------------<br>` : ''}
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
  printReceipt(data, data.note); 
}

/* =========================================================================
   SISTEM TARIK PESANAN ONLINE (PARSER)
   ========================================================================= */

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

    // Mengirim sinyal angka ke Aplikasi Android untuk notifikasi titik merah
    if (window.Android && window.Android.updateAppBadge) {
      window.Android.updateAppBadge(pendingOrdersArr.length);
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
        <span>Estimasi: Rp${formatRupiah(order.totalBelanja)}</span>
        <span style="color:#2e7d32; font-size:11px; background:#e8f5e9; padding:2px 8px; border-radius:4px;">${order.jenisPembayaran}</span>
      </div>
      
      <!-- PERUBAHAN: Tombol kini menarik data ke kasir, bukan langsung print -->
      <button onclick="loadCatalogOrderToCart(${order.rowNum})" class="btn-confirm-pay" style="padding:10px; font-size:13px; background:#1976d2; box-shadow: 0 3px 6px rgba(25, 118, 210, 0.3);">
        📥 TARIK KE KASIR (EDIT/BAYAR)
      </button>
    </div>
  `).join('');
}

// ---------------------------------------------------------
// FUNGSI INTI: MEMBONGKAR TEKS KATALOG JADI PRODUK KASIR
// ---------------------------------------------------------
function parseCatalogItemsToCart(detailItems) {
  cart = []; // Kosongkan keranjang sebelumnya
  
  let parts = detailItems.split(" | Catatan Tambahan: ");
  let itemsPart = parts[0];
  let globalNote = parts[1] || "";

  // Pisahkan teks per item (Pisahkan berdasarkan karakter "x), " agar akurat)
  let strItems = itemsPart.split(/x\),\s*|x\)$/); 
  
  strItems.forEach(itemStr => {
      itemStr = itemStr.trim();
      if (!itemStr) return;

      // 1. Ambil Angka QTY (Berada di paling belakang, contoh: "(2" hasil dari split)
      let qtyMatch = itemStr.match(/\((\d+)$/);
      let qty = 1;
      if (qtyMatch) {
          qty = parseInt(qtyMatch[1]);
          itemStr = itemStr.replace(/\(\d+$/, "").trim(); // Buang teks "(2"
      }

      // 2. Ambil Catatan Khusus Menu (Jika ada keterangan [Ket: Pedas])
      let note = "";
      let noteMatch = itemStr.match(/\[Ket:\s*(.*?)\]$/);
      if (noteMatch) {
          note = noteMatch[1];
          itemStr = itemStr.replace(/\[Ket:\s*.*?\]$/, "").trim(); // Buang teks "[Ket: Pedas]"
      }

      // 3. Ambil Varian (Jika ada keterangan di dalam kurung)
      let variant = "";
      let variantMatch = itemStr.match(/\((.*?)\)$/);
      if (variantMatch) {
          variant = variantMatch[1];
          itemStr = itemStr.replace(/\(.*?\)$/, "").trim(); // Buang teks "(Paha)"
      }

      let productName = itemStr; // Sisanya adalah murni Nama Produk

      // 4. Cocokkan kembali nama tersebut dengan database agar harganya bisa dihitung ulang
      let product = allProducts.find(p => p.nama.trim().toLowerCase() === productName.toLowerCase());
      if (!product) {
          product = allProducts.find(p => p.nama.toLowerCase().includes(productName.toLowerCase()) || productName.toLowerCase().includes(p.nama.toLowerCase()));
      }

      if (product) {
          cart.push({ product: product, qty: qty, subVariant: variant, itemNote: note });
      } else {
          // Jika entah kenapa tidak ketemu harganya, buat produk sementara
          cart.push({
              product: { id: "DUMMY_"+Date.now(), nama: productName, harga: 0, hpp: 0, kategori: "Umum" },
              qty: qty,
              subVariant: variant,
              itemNote: note
          });
      }
  });
  return globalNote;
}

// ---------------------------------------------------------
// FUNGSI MENARIK PESANAN & MEMBUKA MODAL CHECKOUT
// ---------------------------------------------------------
function loadCatalogOrderToCart(rowNum) {
  const order = pendingOrdersArr.find(o => o.rowNum === rowNum);
  if (!order) return;

  // 1. Bongkar teksnya dan masukkan ke dalam keranjang
  const globalNote = parseCatalogItemsToCart(order.detailItems);

  // 2. Kunci pesanan ini ke memori agar nanti bisa diklaim "Selesai" ke Sheet
  activeCatalogOrder = order;

  // 3. Masukkan Nama Pelanggan ke form Checkout secara otomatis
  const custSelect = document.getElementById("customerSelect");
  if (custSelect) {
      let found = Array.from(custSelect.options).find(opt => opt.value === order.customerName);
      if (!found) {
          let newOpt = new Option(order.customerName + " (Katalog)", order.customerName);
          custSelect.add(newOpt);
      }
      custSelect.value = order.customerName;
  }

  // 4. Masukkan Metode Pembayaran
  const paymentSelect = document.getElementById("paymentMethodSelect");
  if (paymentSelect) {
      paymentSelect.value = order.jenisPembayaran;
  }

  // 5. Masukkan Catatan Tambahan (Jika ada ongkir/alamat/dll)
  const noteEl = document.getElementById("orderNote");
  if (noteEl) noteEl.value = globalNote;

  // 6. Tampilkan Hasilnya
  updateCartUI();
  closePendingOrdersModal();
  openCheckoutModal(); // Buka form kasir, siap untuk diedit atau diberi ongkir!
}

/* =========================================================================
   TRIGER DAN AKSI OTOMATIS LAINNYA
   ========================================================================= */

window.addEventListener('click', function(event) {
  const detailModal = document.getElementById('detailModal');
  if (event.target === detailModal) {
    closeDetailModal();
  }
});

loadData(); 
setInterval(checkPendingOrders, 15000); 
checkPendingOrders();
