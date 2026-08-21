const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>MENU</text></svg>";

let storeConfig = {};
let allProducts = [];
let allSubcategories = [];
let cart = [];
let selectedCategory = "ALL";
let activeSubProduct = null;
let selectedSubOptions = {};

// Helper URL Gambar Google Drive
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

// Format nomor HP ke format WhatsApp Internasional (62xxxx)
function formatToWhatsappNumber(phoneStr) {
  if (!phoneStr) return "";
  let cleaned = phoneStr.toString().replace(/\D/g, '');
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  }
  return cleaned;
}


// Helper untuk memfilter produk yang tampil di Web Katalog
function isVisibleInCatalog(p) {
  if (!p) return false;
  
  // Ambil nilai dari properti 'katalog'
  const statusKatalog = (p.katalog || "Y").toString().trim().toUpperCase();
  
  // Jika Kolom J bernilai N, sembunyikan dari Web Katalog
  if (statusKatalog === "N" || statusKatalog === "NO" || statusKatalog === "FALSE") {
    return false;
  }
  
  return true;
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    storeConfig = data.store || {};
    allProducts = data.products || [];
    allSubcategories = data.subkategori || [];

    // Header Nama Toko
    const titleEl = document.getElementById("storeTitleHeader");
    if (titleEl && storeConfig.Header) {
      titleEl.innerText = storeConfig.Header;
    }

    renderCategories();
    filterProducts();
  } catch (err) {
    console.error(err);
    alert("Gagal memuat katalog menu.");
  }
}

function renderCategories() {
  const catBar = document.getElementById("categoryBar");
  if (!catBar) return;

  // Hanya ambil kategori dari produk yang Aktif (Kolom I) DAN bernilai 'Y' di Kolom J
  const activeProducts = allProducts.filter(p => {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    return statusAktif === 'Y' && isVisibleInCatalog(p);
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

    // Pembacaan Gambar dari Kolom K ('Link Gambar')
    const rawImgUrl = p['Link Gambar'] || p.linkGambar || p.gambar || p[10];
    const imgUrl = fixImageUrl(rawImgUrl);
    const isSelected = totalQtyInCart > 0;

    return `
      <div class="product-card ${isSelected ? 'has-selected' : ''}" onclick="handleProductClick('${p.id}')">
        <div class="product-img-wrapper">
          <img src="${imgUrl}" alt="${p.nama}" class="product-img" onerror="this.src='${DEFAULT_PLACEHOLDER}'" loading="lazy">
          ${hasSub ? `<span class="variant-tag">+ Variasi/Pilihan</span>` : ''}
        </div>
        
        <div class="product-details">
          <div class="product-info-text">
            <div class="product-title">${p.nama}</div>
            <div class="product-price">Rp${(p.harga || 0).toLocaleString('id-ID')}</div>
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
  }).join('');
}

function getSubCategoriesForProduct(product) {
  if (!allSubcategories || allSubcategories.length === 0) return [];
  return allSubcategories.filter(s => 
    (s.id_produk && s.id_produk.toString().toLowerCase() === product.id.toString().toLowerCase()) ||
    (s.produk && s.produk.toString().toLowerCase() === product.nama.toString().toLowerCase())
  );
}

function handleProductClick(productId) {
  const product = allProducts.find(p => p.id === productId);
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

/* MODAL VARIASI & SUBKATEGORI */
function openSubCategoryModal(product, subCategories) {
  activeSubProduct = product;
  selectedSubOptions = {};

  const modalTitle = document.getElementById("subModalTitle");
  if (modalTitle) modalTitle.innerText = product.nama;
  
  const modalBody = document.getElementById("subModalBody");
  if (!modalBody) return;

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
      <label>JUMLAH PORSI / PAKET</label>
      <input type="number" id="subQtyInput" class="form-input" value="1" min="1" style="font-size:18px; font-weight:bold; text-align:center;">
    </div>
  `;

  modalBody.innerHTML = html;
  const modal = document.getElementById("subCategoryModal");
  if (modal) modal.style.display = "flex";
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
  const modal = document.getElementById("subCategoryModal");
  if (modal) modal.style.display = "none";
  activeSubProduct = null;
}

function confirmSubCategorySelection() {
  if (!activeSubProduct) return;
  const qtyInput = document.getElementById("subQtyInput");
  const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
  
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

/* MANAJEMEN KERANJANG */
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

function updateDirectQty(productId, val) {
  const newQty = parseInt(val) || 0;
  const existingIndex = cart.findIndex(item => item.product.id === productId);

  if (newQty <= 0) {
    if (existingIndex !== -1) cart.splice(existingIndex, 1);
  } else {
    if (existingIndex !== -1) {
      cart[existingIndex].qty = newQty;
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
  if (cart.length === 0) closeCheckoutModal();
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
    // 1. Cek Kolom I (Aktif) -> Harus 'Y'
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    const isAktif = statusAktif === 'Y';

    // 2. Cek Kolom J (Katalog) -> Jangan 'N'
    const isKatalog = isVisibleInCatalog(p);

    // 3. Filter Kategori & Pencarian
    const matchCat = selectedCategory === "ALL" || p.kategori === selectedCategory;
    const matchSearch = p.nama.toLowerCase().includes(keyword);
    
    return isAktif && isKatalog && matchCat && matchSearch;
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
  if (totalAmountEl) totalAmountEl.innerText = `Rp${totalPrice.toLocaleString('id-ID')}`;
  if (modalTotalEl) modalTotalEl.innerText = `Rp${totalPrice.toLocaleString('id-ID')}`;
  if (btnCheckout) btnCheckout.disabled = cart.length === 0;
}

function openCheckoutModal() {
  if (cart.length === 0) return;
  renderModalCartList();
  const modal = document.getElementById("checkoutModal");
  if (modal) modal.style.display = "flex";
}

function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (modal) modal.style.display = "none";
}

function renderModalCartList() {
  const container = document.getElementById("modalCartList");
  if (!container) return;
  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item-row">
      <div>
        <div class="cart-item-name">${item.product.nama}</div>
        ${item.subVariant ? `<div style="font-size:11px; color:#6c757d; font-style:italic;">[ ${item.subVariant} ]</div>` : ''}
        <div class="cart-item-price">Rp${(item.product.harga || 0).toLocaleString('id-ID')} x ${item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, -1)">-</button>
        <span style="font-size:13px; font-weight:bold;">${item.qty}</span>
        <button class="btn-qty-mini" onclick="updateQtyInCartList(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

/* PROSES SIMPAN KE SHEET & REDIRECT KE WHATSAPP */
async function submitCatalogOrder() {
  const custName = document.getElementById("custNameInput")?.value.trim();
  if (!custName) {
    alert("Silakan isi Nama Pemesan terlebih dahulu.");
    document.getElementById("custNameInput")?.focus();
    return;
  }

  const btnSubmit = document.getElementById("btnSubmitOrder");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Mengirim Pesanan...";
  }

  const now = new Date();
  const invoiceNo = "INV-KATALOG-" + now.getFullYear() + (now.getMonth()+1).toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + "-" + Math.floor(1000 + Math.random() * 9000);
  const waktuTx = now.toLocaleString('id-ID');
  const selectedPayment = document.getElementById("paymentMethodSelect")?.value || "Tunai";
  const noteValue = document.getElementById("orderNote")?.value.trim() || "";
  
  const totalBelanja = cart.reduce((sum, i) => sum + ((i.product.harga || 0) * i.qty), 0);
  const totalHpp = cart.reduce((sum, i) => sum + ((i.product.hpp || 0) * i.qty), 0);
  
  // Format rincian produk termasuk variasi
  let detailText = cart.map(i => {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += ` (${i.subVariant})`;
    return `${nameStr} (${i.qty}x)`;
  }).join(", ");

  if (noteValue) detailText += ` | Catatan: ${noteValue}`;

  const payload = {
    noInvoice: invoiceNo,
    waktu: waktuTx,
    customerName: custName,
    detailItems: detailText,
    totalBelanja: totalBelanja,
    totalHpp: totalHpp,
    jenisPembayaran: selectedPayment,
    uangDiterima: totalBelanja,
    kembalian: 0,
    kasir: "Katalog Online",
    sumber: "Katalog",
    status: "PENDING"
  };

  try {
    // 1. Simpan ke Google Sheet dengan status PENDING
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    // 2. Ambil Nomor WA dari Sheet Data (storeConfig.WA)
    const targetWaRaw = storeConfig.WA || "085838976880";
    const targetWaFormatted = formatToWhatsappNumber(targetWaRaw);

    // 3. Susun Pesan WhatsApp
    let waText = `*PESANAN BARU - KATALOG ONLINE*\n`;
    waText += `----------------------------------\n`;
    waText += `*No Invoice:* ${invoiceNo}\n`;
    waText += `*Nama:* ${custName}\n`;
    waText += `*Pembayaran:* ${selectedPayment}\n`;
    if (noteValue) waText += `*Alamat/Catatan:* ${noteValue}\n`;
    waText += `----------------------------------\n`;
    waText += `*Detail Pesanan:*\n`;
    
    cart.forEach(i => {
      let itemLine = `• ${i.product.nama}`;
      if (i.subVariant) itemLine += `\n   └ _[${i.subVariant}]_`;
      itemLine += ` (${i.qty}x) = Rp${(i.qty * i.product.harga).toLocaleString('id-ID')}\n`;
      waText += itemLine;
    });

    waText += `----------------------------------\n`;
    waText += `*TOTAL: Rp${totalBelanja.toLocaleString('id-ID')}*\n\n`;
    waText += `Halo, saya ingin memesan menu di atas. Mohon diproses, terima kasih!`;

    // 4. Redirect ke WhatsApp
    const waUrl = `https://wa.me/${targetWaFormatted}?text=${encodeURIComponent(waText)}`;
    window.location.href = waUrl;

  } catch (err) {
    console.error("Gagal mengirim pesanan:", err);
    alert("Gagal mengirim pesanan. Silakan coba lagi.");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "📲 KIRIM ORDER VIA WHATSAPP";
    }
  }
}

loadData();
