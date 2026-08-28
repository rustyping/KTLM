/* =========================================================================
   SISTEM KASIR KTLM KITCHEN (kasir.js)
   Diperbarui dengan Fitur Ongkos Kirim Otomatis dengan Pemisah Ribuan (Titik)
   ========================================================================= */

// Link API dari Google Apps Script untuk menarik dan mengirim data ke Google Sheet
const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";

// Gambar bawaan jika link gambar dari Google Sheet kosong atau rusak
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>KTLM</text></svg>";

/* --- VARIABEL GLOBAL PENYIMPAN DATA --- */
let storeConfig = {};         // Menyimpan nama toko, alamat, dan WA dari Sheet 'data'
let allProducts = [];         // Menyimpan seluruh daftar menu dari Sheet 'produk'
let allCustomers = [];        // Menyimpan daftar pelanggan dari Sheet 'customer'
let allSubcategories = [];    // Menyimpan daftar variasi/paket dari Sheet 'subkategori'
let cart = [];                // Menyimpan barang yang sedang dimasukkan kasir ke keranjang
let pendingOrdersArr = [];    // Menyimpan daftar pesanan online yang masuk dari pelanggan
let selectedCategory = "ALL"; // Mengingat kategori tab apa yang sedang diklik kasir
let activeSubProduct = null;
let selectedSubOptions = {};
let lastTransaction = null;   // Menyimpan data pesanan terakhir untuk fitur cetak ulang struk
let currentCartSubtotal = 0;  // Menyimpan subtotal belanja (sebelum ditambah ongkir)

/* --- PENGATURAN KASIR (Tersimpan di HP) --- */
let posSettings = {
  showImages: true,    // Tampilkan gambar produk (mode kartu) atau tidak (mode kompak)
  printMode: 'rawbt',  // Menggunakan aplikasi pihak ketiga RawBT untuk print bluetooth
  paperSize: '58mm',   // Ukuran kertas printer thermal
  headerName: 'KTLM Kitchen', 
  address: '',
  waPhone: ''
};

/* =========================================================================
   FUNGSI-FUNGSI UTILITAS (ALAT BANTU DASAR)
   ========================================================================= */

// Mengubah angka biasa menjadi format mata uang Indonesia (contoh: 50000 -> 50.000)
function formatRupiah(angka) {
  return (angka || 0).toLocaleString('id-ID');
}

// Menarik pengaturan kasir terakhir (seperti mode gambar & nama toko) dari memori HP
function initSettings() {
  const saved = localStorage.getItem('ktlm_pos_settings');
  if (saved) {
    try {
      posSettings = Object.assign(posSettings, JSON.parse(saved));
    } catch(e){}
  }
  document.documentElement.style.setProperty('--paper-width', posSettings.paperSize);
}

// Memperbaiki link gambar Google Drive agar bisa ditampilkan langsung di HTML
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

/* =========================================================================
   FUNGSI PENGAMBILAN & PENAMPILAN DATA DARI GOOGLE SHEET
   ========================================================================= */

// Menarik semua data (Produk, Pelanggan, Subkategori) dari Google Sheet saat aplikasi dibuka
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

// Membuat daftar pilihan pelanggan (Dropdown) di form pembayaran
function renderCustomers() {
  const custSelect = document.getElementById("customerSelect");
  if (!custSelect) return;
  if (allCustomers.length > 0) {
    custSelect.innerHTML = allCustomers.map(c => `<option value="${c.nama}">${c.nama}</option>`).join('');
  } else {
    custSelect.innerHTML = `<option value="Umum">Umum / Walk-in</option>`;
  }
}

// Membuat barisan tombol kategori di bagian atas (ALL, Minuman, Makanan, dll)
function renderCategories() {
  const catBar = document.getElementById("categoryBar");
  if (!catBar) return;
  
  // Hanya ambil kategori dari produk yang berstatus "Y" (Aktif)
  const activeProducts = allProducts.filter(p => {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    return statusAktif === 'Y';
  });

  const categories = ["ALL", ...new Set(activeProducts.map(p => p.kategori).filter(Boolean))];
  catBar.innerHTML = categories.map(cat => 
    `<button class="cat-btn ${cat==='ALL'?'active':''}" onclick="filterCategory('${cat}', this)">${cat}</button>`
  ).join('');
}

// Menampilkan kartu-kartu produk ke layar berdasarkan hasil filter kategori/pencarian
function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  if (products.length === 0) {
    grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: #6c757d; padding: 20px;">Menu tidak ditemukan</p>';
    return;
  }
  
  grid.innerHTML = products.map(p => {
    // Mengecek apakah produk ini sudah ada di dalam keranjang belanja
    const totalQtyInCart = cart
      .filter(c => c.product.id === p.id)
      .reduce((sum, i) => sum + i.qty, 0);

    const subCategories = getSubCategoriesForProduct(p);
    const hasSub = subCategories.length > 0;
    
    const rawImgUrl = p['Link Gambar'] || p.linkGambar || p.gambar || p[10];
    const imgUrl = fixImageUrl(rawImgUrl);
    const isSelected = totalQtyInCart > 0;

    // Tampilan jika Mode Gambar (Kartu Besar) dinyalakan
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
    // Tampilan jika Mode Gambar (Kartu Kompak) dimatikan
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

/* =========================================================================
   LOGIKA INTERAKSI KARTU PRODUK (TOMBOL ADD & QTY)
   ========================================================================= */

// Dijalankan saat tombol "Add" di kartu menu ditekan
function handleAddClick(productId, event) {
  if (event) event.stopPropagation(); // Mencegah modal pop-up menu terbuka saat mengeklik Add
  
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);
  
  // Jika menu punya variasi/paket, paksa buka modal variasi. Jika tidak, langsung masuk keranjang (qty = 1).
  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    addToCart(product, 1, "");
  }
}

// Menambah/mengurangi angka dari tombol (+) dan (-) di kartu menu
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

// Dijalankan saat kasir mengetik langsung angka jumlah qty di dalam kotak kartu menu
function onQtyDirectChange(productId, val) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  let newQty = parseInt(val) || 0;
  if (newQty < 0) newQty = 0; // Mencegah minus

  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    updateDirectQty(productId, newQty);
  }
}

// Mencari data subkategori (variasi/paket) yang terkait dengan sebuah produk
function getSubCategoriesForProduct(product) {
  if (!allSubcategories || allSubcategories.length === 0) return [];
  return allSubcategories.filter(s => 
    (s.id_produk && s.id_produk.toString().toLowerCase() === product.id.toString().toLowerCase()) ||
    (s.produk && s.produk.toString().toLowerCase() === product.nama.toString().toLowerCase())
  );
}

/* =========================================================================
   MODAL DETAIL PRODUK (POP-UP SAAT KARTU DIKLIK)
   ========================================================================= */

// Membuka modal (jendela pop-up besar) yang memuat gambar dan deskripsi saat bagian tengah kartu diklik
function handleProductClick(id, event) {
  if (event) event.stopPropagation();
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  openDetailModal(product);
}

function openDetailModal(product) {
  currentDetailProduct = product;
  
  const existingItem = cart.find(item => item.product.id === product.id);
  currentDetailQty = existingItem ? existingItem.qty : 1; // Tarik data sebelumnya jika sudah di keranjang

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
  document.getElementById('detailModal').style.display = 'flex'; // Munculkan pop-up
}

// Menutup modal detail produk
function closeDetailModal() {
  document.getElementById('detailModal').style.display = 'none';
  currentDetailProduct = null;
}

// Menangani tombol (+) dan (-) di dalam modal pop-up
function adjustDetailModalQty(delta) {
  currentDetailQty = Math.max(0, currentDetailQty + delta);
  document.getElementById("detailModalQty").value = currentDetailQty;
}

// Menangani input angka ketikan manual di dalam modal pop-up
function handleModalQtyManualChange(val) {
  let newQty = parseInt(val) || 0;
  if (newQty < 0) newQty = 0;
  currentDetailQty = newQty;
  document.getElementById("detailModalQty").value = currentDetailQty;
}

// Dijalankan saat tombol "SIMPAN KE KERANJANG" di modal ditekan
function saveDetailModalToCart() {
  if (!currentDetailProduct) return;
  
  const productToSave = currentDetailProduct;
  const qtyToSave = currentDetailQty;
  
  const subCategories = getSubCategoriesForProduct(productToSave);
  const itemNote = document.getElementById("detailModalNote").value.trim();

  closeDetailModal();

  // Kalau produk punya variasi, teruskan ke pop-up variasi
  if (subCategories.length > 0) {
    window.tempItemNote = itemNote; 
    openSubCategoryModal(productToSave, subCategories);
  } else {
    // Timpa (Update) jika produk sudah ada, atau buat data baru jika belum ada
    const existingIndex = cart.findIndex(item => item.product.id === productToSave.id);
    
    if (qtyToSave <= 0) {
      if (existingIndex !== -1) cart.splice(existingIndex, 1);
    } else {
      if (existingIndex !== -1) {
        cart[existingIndex].qty = qtyToSave;
        cart[existingIndex].itemNote = itemNote;
      } else {
        cart.push({ 
          product: productToSave, 
          qty: qtyToSave, 
          subVariant: "", 
          itemNote: itemNote 
        });
      }
    }
    
    updateCartUI();
    filterProducts();
  }
}

/* =========================================================================
   SISTEM MANAJEMEN KERANJANG (CART) UTAMA
   ========================================================================= */

// Menambahkan data produk ke dalam keranjang
function addToCart(product, qty, subVariant, itemNote = "") {
  if (window.tempItemNote) {
    itemNote = window.tempItemNote;
    window.tempItemNote = ""; 
  }

  // Cek apakah item yang sama (dengan nama, varian, dan note yang sama persis) sudah ada
  const existing = cart.find(item => item.product.id === product.id && item.subVariant === subVariant && item.itemNote === itemNote);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ product: product, qty: qty, subVariant: subVariant || "", itemNote: itemNote });
  }
  updateCartUI();
  filterProducts();
}

// Memperbarui total produk di keranjang (Dijalankan dari input ketikan angka manual)
function updateDirectQty(productId, newQty) {
  const existingIndex = cart.findIndex(item => item.product.id === productId);
  if (newQty <= 0) {
    if (existingIndex !== -1) cart.splice(existingIndex, 1);
  } else {
    if (existingIndex !== -1) {
      cart[existingIndex].qty = newQty;
    } else {
      const product = allProducts.find(p => p.id === productId);
      if (product) cart.push({ product: product, qty: newQty, subVariant: "", itemNote: "" });
    }
  }
  updateCartUI();
  filterProducts();
}

// Memperbarui kuantitas (menambah/mengurang) dari dalam jendela pop-up konfirmasi pesanan (Checkout Modal)
function updateQtyInCartList(index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1); // Hapus jika sisa 0
  }
  
  updateCartUI();
  renderModalCartList(); // Refresh tampilan daftar barang di modal
  filterProducts();
  
  // Jika modal checkout sedang aktif terbuka, perbarui total uangnya juga
  const checkoutModal = document.getElementById("checkoutModal");
  if (checkoutModal && checkoutModal.style.display === "flex") {
    currentCartSubtotal = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);
    updateCheckoutTotalSummary();
  }

  // Jika barang habis dihapus semua, tutup modal checkout-nya otomatis
  if (cart.length === 0) {
    closeCheckoutModal();
  }
}

// Filter tampilan kartu menu saat tombol kategori di atas diklik
function filterCategory(cat, btn) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterProducts();
}

// Mesin pemilah untuk memastikan produk sesuai dengan pencarian teks kasir (Search Box) dan kategori
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

// Memperbarui total harga dan jumlah item di bar merah (Bottom Bar) bagian bawah layar
function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  const itemCountEl = document.getElementById("barItemCount");
  const totalAmountEl = document.getElementById("barTotalAmount");
  const btnCheckout = document.getElementById("btnOpenCheckout");

  if (itemCountEl) itemCountEl.innerText = `${totalQty} Item`;
  if (totalAmountEl) totalAmountEl.innerText = `Rp${formatRupiah(totalPrice)}`;
  if (btnCheckout) btnCheckout.disabled = cart.length === 0; // Kunci tombol jika keranjang kosong
}

/* =========================================================================
   MODAL KONFIRMASI PEMBAYARAN (CHECKOUT / FORM KASIR)
   ========================================================================= */

// Membuka modal yang berisi ringkasan daftar belanja sebelum dicetak
function openCheckoutModal() {
  if (cart.length === 0) return;

  // Hitung subtotal barang (belum ditambah ongkir)
  currentCartSubtotal = cart.reduce((sum, item) => sum + (item.product.harga * item.qty), 0);

  // Reset ongkir ke 0 tiap kali jendela ini dibuka ulang
  const shippingInput = document.getElementById('shippingCostInput');
  if (shippingInput) shippingInput.value = 0;

  renderModalCartList(); // Tampilkan daftar barang
  updateCheckoutTotalSummary(); // Hitung total akhir
  document.getElementById("checkoutModal").style.display = "flex";
}

// Menutup modal konfirmasi belanja
function closeCheckoutModal() {
  document.getElementById("checkoutModal").style.display = "none";
}

// Mengatur titik (Ribuan) otomatis saat kasir mengetik ongkos kirim manual
function handleShippingInput(inputEl) {
  // Hapus semua huruf/simbol asing, sisakan angka murni
  let rawValue = inputEl.value.replace(/[^0-9]/g, '');
  if (rawValue === "") {
    inputEl.value = "0";
    rawValue = "0";
  }
  // Tambahkan titik pemisah
  inputEl.value = parseInt(rawValue, 10).toLocaleString('id-ID');
  
  updateCheckoutTotalSummary(); // Langsung perbarui total akhir di bawah
}

// Mengkalkulasi uang Subtotal Produk + Ongkos Kirim untuk ditampilkan ke layar kasir
function updateCheckoutTotalSummary() {
  const shippingInput = document.getElementById('shippingCostInput');
  // Bersihkan titik sebelum diseret ke dalam rumus hitungan matematika
  const rawShipping = shippingInput ? shippingInput.value.replace(/[^0-9]/g, '') : "0";
  const shippingCost = parseInt(rawShipping, 10) || 0;

  const grandTotal = currentCartSubtotal + shippingCost;

  const totalEl = document.getElementById('modalTotalAmount');
  if (totalEl) {
    totalEl.innerText = 'Rp' + formatRupiah(grandTotal);
  }
}

// Membuat tampilan baris per baris produk yang ada di dalam keranjang checkout
function renderModalCartList() {
  const container = document.getElementById("modalCartList");
  if (!container) return;
  container.innerHTML = cart.map((item, idx) => `
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
}

// Menyisipkan catatan cepat ke dalam textbox pesanan
function addQuickNote(text) {
  const noteInput = document.getElementById("orderNote");
  if (!noteInput) return;
  if (noteInput.value.trim() === "") {
    noteInput.value = text;
  } else {
    noteInput.value += ", " + text;
  }
}

/* =========================================================================
   PENGATURAN KASIR (SETTINGS)
   ========================================================================= */

// Buka jendela Pengaturan Kasir (ikon gir roda)
function openSettingsModal() {
  document.getElementById("settingShowImages").checked = posSettings.showImages;
  document.getElementById("settingPrintMode").value = posSettings.printMode;
  document.getElementById("settingPaperSize").value = posSettings.paperSize;
  document.getElementById("settingHeaderStore").value = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  document.getElementById("settingAddressStore").value = posSettings.address || storeConfig.Alamat || '';
  document.getElementById("settingWaStore").value = posSettings.waPhone || storeConfig.WA || '';
  document.getElementById("settingsModal").style.display = "flex";
}

// Tutup jendela Pengaturan
function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}

// Simpan perubahan pengaturan (tersimpan permanen di memori HP masing-masing)
function savePrinterSettings() {
  posSettings.showImages = document.getElementById("settingShowImages").checked;
  posSettings.printMode = document.getElementById("settingPrintMode").value;
  posSettings.paperSize = document.getElementById("settingPaperSize").value;
  posSettings.headerName = document.getElementById("settingHeaderStore").value;
  posSettings.address = document.getElementById("settingAddressStore").value;
  posSettings.waPhone = document.getElementById("settingWaStore").value;

  localStorage.setItem('ktlm_pos_settings', JSON.stringify(posSettings));
  document.documentElement.style.setProperty('--paper-width', posSettings.paperSize);

  filterProducts(); // Refresh layar menu agar ukuran kartu berubah jika mode gambar dimatikan
  alert("Pengaturan tersimpan!");
  closeSettingsModal();
}

/* =========================================================================
   PROSES SIMPAN DATABASE & CETAK STRUK
   ========================================================================= */

// Fungsi paling vital: Mengirim data penjualan ke Google Sheet dan Memicu print struk
async function processPayment() {
  if (cart.length === 0) return;

  const btnPay = document.querySelector("#checkoutModal .btn-confirm-pay");
  if (btnPay) {
    btnPay.disabled = true; // Kunci tombol agar kasir tidak menekan dua kali (Double Entry)
    btnPay.innerText = "PROSES SIMPAN...";
  }

  // Pembuatan nomor invoice acak berdasarkan tanggal
  const now = new Date();
  const invoiceNo = "INV-" + now.getFullYear() + (now.getMonth()+1).toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + "-" + Math.floor(1000 + Math.random() * 9000);
  const waktuTx = now.toLocaleString('id-ID');
  
  // Menarik nilai-nilai dari form kasir (Nama, Pembayaran, Catatan)
  const selectedCustomer = document.getElementById("customerSelect")?.value || "Umum";
  const selectedPayment = document.getElementById("paymentMethodSelect")?.value || "Tunai";
  const noteValue = document.getElementById("orderNote")?.value.trim() || "";
  
  // Persiapan dan pembersihan angka Ongkos Kirim
  const shippingInput = document.getElementById('shippingCostInput');
  const rawShipping = shippingInput ? shippingInput.value.replace(/[^0-9]/g, '') : "0";
  const shippingCost = parseInt(rawShipping, 10) || 0;
  
  // Perhitungan modal hpp dan harga produk (subtotal murni)
  const totalHpp = cart.reduce((sum, i) => sum + ((i.product.hpp || 0) * i.qty), 0);
  const totalProduk = cart.reduce((sum, i) => sum + ((i.product.harga || 0) * i.qty), 0);
  
  // Total Belanja akhir yang disetor = Harga Produk + Ongkos Kirim
  const totalBelanja = totalProduk + shippingCost; 
  
  // Merakit teks Detail Pembelian untuk dicatat di kolom Google Sheet
  let detailText = cart.map(i => {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += ` (${i.subVariant})`;
    if (i.itemNote) nameStr += ` [Note: ${i.itemNote}]`; 
    return `${nameStr} (${i.qty}x)`;
  }).join(", ");

  // Menyisipkan info ongkir dan catatan ke dalam teks Detail Pembelian (Sheet)
  if (shippingCost > 0) {
    detailText += ` | +Ongkir: Rp${formatRupiah(shippingCost)}`;
  }
  if (noteValue) {
    detailText += ` | Catatan Pesanan: ${noteValue}`;
  }

  // Paket data lengkap (Payload) untuk dikirim ke Google Sheet
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
    cartItems: JSON.parse(JSON.stringify(cart)), // Salin keranjang secara utuh untuk kebutuhan struk
    note: noteValue,
    ongkir: shippingCost // Disimpan terpisah agar printer tahu nilai ongkirnya
  };

  try {
    // 1. Eksekusi kirim data ke script (Mode 'no-cors' karena kita tidak menunggu respon balik penuh)
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    // 2. Simpan jejak ini untuk fitur Cetak Struk Terakhir
    saveLastTransaction(payload);
    
    // 3. Picu fungsi cetak struk Bluetooth
    printReceipt(payload, noteValue);

    // 4. Bersihkan form kasir agar siap menerima pesanan berikutnya
    alert("Transaksi Berhasil Disimpan!");
    cart = [];
    if (document.getElementById("orderNote")) document.getElementById("orderNote").value = "";
    if (document.getElementById("shippingCostInput")) document.getElementById("shippingCostInput").value = 0;
    
    updateCartUI();
    closeCheckoutModal();
    filterProducts(); // Refresh agar tag warna merah di kartu produk hilang
  } catch (err) {
    console.error("Gagal simpan:", err);
    alert("Koneksi gagal. Cek sambungan internet.");
  } finally {
    if (btnPay) {
      btnPay.disabled = false; // Buka kunci tombol lagi
      btnPay.innerText = "BAYAR & PRINT STRUK";
    }
  }
}

// Fungsi Khusus: Membentuk Teks Struk dan Mengirimkannya ke Printer (RawBT/HTML)
function printReceipt(tx, note) {
  // Ambil data nama toko dari setelan memori HP (Atau Sheet jika tidak ada)
  const storeTitle = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  const storeAddr = posSettings.address || storeConfig.Alamat || '';
  const storeWa = posSettings.waPhone || storeConfig.WA || '';
  const storeBottom = storeConfig["Bottom 1"] || 'Terima Kasih!';

  const itemsToPrint = (tx && tx.cartItems && tx.cartItems.length > 0) ? tx.cartItems : cart;
  const noteToPrint = note || (tx ? tx.note : "") || "";
  
  // Hitung kembali subtotal jika ada ongkir
  const ongkir = tx.ongkir || 0;
  const subtotal = tx.totalBelanja - ongkir;

  // JALUR 1: Cetak via Aplikasi Bluetooth "RawBT" (Biasanya untuk HP Android)
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
    
    // Tampilkan rincian Subtotal & Ongkir di kertas thermal jika nilai ongkir lebih dari nol
    if (ongkir > 0) {
      receiptText += `Subtotal : Rp${formatRupiah(subtotal)}\n`;
      receiptText += `Ongkir   : Rp${formatRupiah(ongkir)}\n`;
      receiptText += `--------------------------------\n`;
    }

    if (noteToPrint) receiptText += `Catatan: ${noteToPrint}\n--------------------------------\n`;
    receiptText += `TOTAL: Rp${formatRupiah(tx.totalBelanja)}\n`;
    receiptText += `--------------------------------\n`;
    receiptText += `${storeBottom}\n\n\n`;

    // Baris ini akan memerintahkan HP membuka aplikasi RawBT 
    // (Syarat utama: Intent harus didukung oleh Webview Android Studio)
    const intentUrl = "intent:" + encodeURIComponent(receiptText) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    window.location.href = intentUrl;

  // JALUR 2: Cetak Standar HTML (Biasanya dipakai jika buka di Browser Laptop / Windows)
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
    window.print(); // Picu dialog print OS (Laptop/Chrome)
    receipt.style.display = "none";
  }
}

// Fitur Anti-Panik: Menyimpan seluruh detail transaksi tadi ke dalam penyimpanan permanen (LocalStorage) 
// Agar bisa ditarik kembali kalau kasir salah merobek kertas struk
function saveLastTransaction(payloadData) {
  lastTransaction = payloadData;
  localStorage.setItem("lastPOSOrder", JSON.stringify(payloadData));
  showReprintToast(); // Munculkan pop-up kecil peringatan "Cetak Ulang"
}

// Menampilkan balon peringatan untuk tombol Cetak Ulang Struk
function showReprintToast() {
  const toast = document.getElementById("toastReprint");
  if (toast) toast.style.display = "flex";
}

// Menyembunyikan balon Cetak Ulang (kalau disilang kasir)
function hideReprintToast() {
  const toast = document.getElementById("toastReprint");
  if (toast) toast.style.display = "none";
}

// Menembak ulang (Print) data transaksi terakhir (dipicu oleh tombol Cetak Ulang)
function cetakUlangStrukTerakhir() {
  const data = lastTransaction || JSON.parse(localStorage.getItem("lastPOSOrder"));
  if (!data) {
    alert("Belum ada data transaksi terakhir.");
    return;
  }
  
  if (data.isCatalog) {
    printReceiptFromCatalog(data); // Untuk struk pesanan dari pelanggan online
  } else {
    printReceipt(data, data.note); // Untuk struk pelanggan di kasir offline
  }
}

/* =========================================================================
   SISTEM NOTIFIKASI PESANAN ONLINE (DARI KATALOG PELANGGAN)
   ========================================================================= */

// Mengecek Google Sheet secara diam-diam setiap 15 detik untuk melihat apakah ada pesanan masuk
async function checkPendingOrders() {
  try {
    const res = await fetch(`${API_URL}?action=getPendingOrders`);
    const data = await res.json();
    pendingOrdersArr = data.orders || [];

    const badge = document.getElementById("orderBadge");
    if (badge) {
      badge.innerText = pendingOrdersArr.length;
      badge.style.display = pendingOrdersArr.length > 0 ? "inline-block" : "none"; // Munculkan lonceng merah jika ada
    }
  } catch (err) {
    console.error("Gagal cek pesanan:", err);
  }
}

// Kasir membuka kotak notifikasi lonceng pesanan masuk
function openPendingOrdersModal() {
  renderPendingOrders();
  document.getElementById("pendingOrdersModal").style.display = "flex";
}

// Kasir menutup kotak notifikasi pesanan masuk
function closePendingOrdersModal() {
  document.getElementById("pendingOrdersModal").style.display = "none";
}

// Menggambar daftar list pesanan masuk (Kotak-kotak order yang dikirim pelanggan dari Katalog Online)
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

// Dijalankan saat Kasir menekan tombol "PROSES & PRINT" pada sebuah orderan masuk
async function processAndPrintCatalogOrder(rowNum) {
  const order = pendingOrdersArr.find(o => o.rowNum === rowNum);
  if (!order) return;

  // Simpan jejak ini untuk fitur "Cetak Ulang Terakhir"
  const catalogPayload = { ...order, isCatalog: true };
  saveLastTransaction(catalogPayload);

  // Perintahkan HP mencetak struk
  printReceiptFromCatalog(order);

  try {
    // Beri tahu Google Sheet bahwa pesanan ini statusnya "SELESAI" agar tidak diproses dua kali
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
    checkPendingOrders(); // Cek lagi sisa pesanan di sheet
    closePendingOrdersModal(); // Tutup jendela otomatis
  } catch (err) {
    console.error("Gagal update status:", err);
    alert("Gagal memperbarui status di Google Sheet.");
  }
}

// Fungsi Pencetak Struk Khusus Untuk Pesanan dari Katalog Online (Karena format teks laporannya sedikit berbeda)
function printReceiptFromCatalog(order) {
  const storeTitle = posSettings.headerName || storeConfig.Header || 'KTLM Kitchen';
  const storeAddr = posSettings.address || storeConfig.Alamat || '';
  const storeWa = posSettings.waPhone || storeConfig.WA || '';
  const storeBottom = storeConfig["Bottom 1"] || 'Terima Kasih!';

  let formattedItemsText = "";
  let htmlItemsText = "";

  // Mengupas teks string dari pelanggan online yang tergabung dengan pemisah koma
  let [rawItems, noteText] = (order.detailItems || "").split(/\|\s*Catatan:\s*/i);
  let itemList = rawItems.split(",").map(i => i.trim()).filter(Boolean);

  itemList.forEach(itemStr => {
    // Membaca tulisan format pelanggan "Nasi Goreng (2x)"
    const match = itemStr.match(/^(.*?)(?:\s*\((?:(\d+)x)\))?$/);
    let name = itemStr;
    let qty = 1;

    if (match) {
      name = match[1].trim();
      if (match[2]) qty = parseInt(match[2], 10) || 1;
    }

    // Cocokkan nama teks dari pelanggan dengan database produk master kita (Mencari harganya)
    let product = allProducts.find(p => 
      name.toLowerCase().includes(p.nama.toLowerCase()) || 
      p.nama.toLowerCase().includes(name.toLowerCase())
    );
    let unitPrice = product ? (product.harga || 0) : 0;
    let itemTotal = unitPrice * qty;

    if (unitPrice > 0) {
      formattedItemsText += `${name}\n  ${qty} x Rp${formatRupiah(unitPrice)} = Rp${formatRupiah(itemTotal)}\n`;
    } else {
      formattedItemsText += `${name}\n  ${qty}x\n`; // Jika tidak ketemu harganya
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

/* =========================================================================
   TRIGER DAN AKSI OTOMATIS LAINNYA
   ========================================================================= */

// Sensor klik liar: Menutup otomatis modal (jendela pop-up) detail produk 
// Jika kasir atau pelanggan menekan ruang kosong / abu-abu di luar kotak putih
window.addEventListener('click', function(event) {
  const detailModal = document.getElementById('detailModal');
  if (event.target === detailModal) {
    closeDetailModal();
  }
});

// INSTALASI AWAL SAAT WEB KASIR PERTAMA KALI DIBUKA:
loadData(); // Jalankan fungsi penarikan master data dari Google Sheet

// Nyalakan sensor Radar Pesanan Online (Cek notifikasi setiap 15 detik)
setInterval(checkPendingOrders, 15000); 
checkPendingOrders(); // Pancing pengecekan pertama saat sistem baru nyala
