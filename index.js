const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>MENU</text></svg>";

let storeConfig = {};
let allProducts = [];
let cart = [];
let selectedCategory = "ALL";
let activeSubProduct = null;
let selectedSubOptions = {};

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

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    storeConfig = data.store || {};
    allProducts = data.products || [];

    // Header Nama Toko
    const titleEl = document.getElementById("storeTitleHeader");
    if (titleEl && storeConfig.Header) {
      titleEl.innerText = storeConfig.Header;
    }

    renderCategories();
    renderProducts(allProducts);
  } catch (err) {
    console.error(err);
    alert("Gagal memuat katalog menu.");
  }
}

function renderCategories() {
  const catBar = document.getElementById("categoryBar");
  if (!catBar) return;
  const categories = ["ALL", ...new Set(allProducts.map(p => p.kategori).filter(Boolean))];
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

    const imgUrl = fixImageUrl(p.gambar);
    const isSelected = totalQtyInCart > 0;

    return `
      <div class="product-card ${isSelected ? 'has-selected' : ''}" onclick="addToCartDirect('${p.id}')">
        <div class="product-img-wrapper">
          <img src="${imgUrl}" alt="${p.nama}" class="product-img" onerror="this.src='${DEFAULT_PLACEHOLDER}'" loading="lazy">
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
                     onchange="updateDirectQty('${p.id}', this.value)"
                     onfocus="this.select()">
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function addToCartDirect(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.product.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ product: product, qty: 1, subVariant: "" });
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
  if (!searchInput) return;
  const keyword = searchInput.value.toLowerCase();
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

/* FUNGSI UTAMA: PROSES SIMPAN KE SHEET & REDIRECT KE WHATSAPP */
async function submitCatalogOrder() {
  const custName = document.getElementById("custNameInput")?.value.trim();
  if (!custName) {
    alert("Silakan isi Nama Pemesan terlebih dahulu.");
    document.getElementById("custNameInput").focus();
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
  
  let detailText = cart.map(i => `${i.product.nama} (${i.qty}x)`).join(", ");
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
    // 1. Simpan ke Google Sheet Data Penjualan dengan status PENDING
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    // 2. Ambil Nomor WA dari Sheet Data B3 (storeConfig.WA)
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
      waText += `• ${i.product.nama} (${i.qty}x) = Rp${(i.qty * i.product.harga).toLocaleString('id-ID')}\n`;
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
