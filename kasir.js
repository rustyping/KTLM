// --- DATA DUMMY PRODUK ---
const products = [
  { id: '1', name: 'Dos Keju', price: 10000, category: 'Pempek', image: 'pempek.jpg', desc: 'pempek dos dengan isi keju' },
  { id: '2', name: 'Cuko Offline', price: 25000, category: 'Pempek', image: 'cuko.jpg', desc: 'cuko asli pempek mantap' },
  { id: '3', name: 'Dos Vegetarian', price: 12500, category: 'Pempek', image: 'veg.jpg', desc: 'pempek olahan vegetarian' },
  { id: '4', name: 'Gohyong', price: 15000, category: 'Ala Carte', image: 'gohyong.jpg', desc: 'gohyong ayam krispi lezat' },
  { id: '5', name: 'Pempek Lenggang', price: 18000, category: 'KTLM', image: 'lenggang.jpg', desc: 'pempek goreng balut telur' }
];

// --- STATE APLIKASI ---
let cart = [];
let activeCategory = 'ALL';
let searchQuery = '';
let selectedModalProduct = null;
let currentModalQty = 1;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  updateBottomBar();
});

// --- RENDER & FILTER PRODUK ---
function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'ALL' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  filtered.forEach(product => {
    const itemInCart = cart.find(c => c.id === product.id);
    const qty = itemInCart ? itemInCart.qty : 0;
    const hasSelectedClass = qty > 0 ? 'has-selected' : '';

    const card = document.createElement('div');
    card.className = `product-card ${hasSelectedClass}`;
    
    // Klik area kartu -> Buka Modal Detail (Gambar 3)
    card.onclick = () => openDetailModal(product);

    card.innerHTML = `
      <div class="product-img-wrapper">
        <img src="${product.image || 'placeholder.jpg'}" alt="${product.name}" class="product-img">
      </div>
      <div class="product-details">
        <div class="product-info-text">
          <div class="product-title">${product.name}</div>
          <div class="product-price">Rp${product.price.toLocaleString('id-ID')}</div>
        </div>
        
        <!-- Kapsul (- 1 +) / Tombol Add -->
        <div class="qty-badge-inline" onclick="event.stopPropagation()">
          <button class="btn-qty-card" onclick="updateQty('${product.id}', -1, event)">-</button>
          <input type="number" class="qty-input-inline" value="${qty}" readonly>
          <button class="btn-qty-card" onclick="updateQty('${product.id}', 1, event)">+</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.trim() === cat);
  });
  renderProducts();
}

function filterProducts() {
  searchQuery = document.getElementById('searchInput').value;
  renderProducts();
}

// --- MANAJEMEN KERANJANG UTAMA ---
function updateQty(productId, delta, event) {
  if (event) event.stopPropagation();

  const product = products.find(p => p.id === productId);
  if (!product) return;

  let item = cart.find(c => c.id === productId);

  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(c => c.id !== productId);
    }
  } else if (delta > 0) {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: delta,
      notes: ''
    });
  }

  renderProducts();
  updateBottomBar();
}

function updateBottomBar() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  document.getElementById('totalItemsText').innerText = `${totalItems} Item`;
  document.getElementById('totalPriceText').innerText = `Rp${totalPrice.toLocaleString('id-ID')}`;

  const btnCheckout = document.getElementById('btnCheckout');
  btnCheckout.disabled = cart.length === 0;
}

// --- MODAL DETAIL MENU (POPUP BUBBLE - GAMBAR 3) ---
function openDetailModal(product) {
  selectedModalProduct = product;
  
  // Cek apakah item sudah ada di keranjang untuk mengisi nilai awal qty
  const existingItem = cart.find(c => c.id === product.id);
  currentModalQty = existingItem ? existingItem.qty : 1;

  document.getElementById('modal-header-title').innerText = product.name;
  document.getElementById('modal-img').src = product.image || 'placeholder.jpg';
  document.getElementById('modal-title').innerText = product.name;
  document.getElementById('modal-desc').innerText = product.desc || '-';
  document.getElementById('modal-price').innerText = `Rp${product.price.toLocaleString('id-ID')}`;
  document.getElementById('modal-notes').value = existingItem ? existingItem.notes : '';
  document.getElementById('modal-qty-val').innerText = currentModalQty;

  document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
  selectedModalProduct = null;
}

function changeModalQty(delta) {
  currentModalQty += delta;
  if (currentModalQty < 1) currentModalQty = 1;
  document.getElementById('modal-qty-val').innerText = currentModalQty;
}

function saveModalToCart() {
  if (!selectedModalProduct) return;

  const notesInput = document.getElementById('modal-notes').value;
  let item = cart.find(c => c.id === selectedModalProduct.id);

  if (item) {
    item.qty = currentModalQty;
    item.notes = notesInput;
  } else {
    cart.push({
      id: selectedModalProduct.id,
      name: selectedModalProduct.name,
      price: selectedModalProduct.price,
      qty: currentModalQty,
      notes: notesInput
    });
  }

  closeDetailModal();
  renderProducts();
  updateBottomBar();
}

// --- MODAL CHECKOUT & KERANJANG ---
function openCheckoutModal() {
  if (cart.length === 0) return;

  renderCartItems();
  document.getElementById('cart-modal').style.display = 'flex';
}

function closeCheckoutModal() {
  document.getElementById('cart-modal').style.display = 'none';
}

function renderCartItems() {
  const container = document.getElementById('cartItemList');
  container.innerHTML = '';

  let totalPrice = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.qty;
    totalPrice += subtotal;

    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div>
        <div class="cart-item-name">${item.name}</div>
        ${item.notes ? `<div class="cart-item-sub">Catatan: ${item.notes}</div>` : ''}
        <div class="cart-item-price">Rp${item.price.toLocaleString('id-ID')} x ${item.qty}</div>
      </div>
      <div class="qty-controls">
        <button class="btn-qty-mini" onclick="updateQty('${item.id}', -1); renderCartItems();">-</button>
        <span style="font-weight:bold; font-size:14px;">${item.qty}</span>
        <button class="btn-qty-mini" onclick="updateQty('${item.id}', 1); renderCartItems();">+</button>
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById('modalCartTotal').innerText = `Rp${totalPrice.toLocaleString('id-ID')}`;
}

function processPayment() {
  const method = document.getElementById('paymentMethod').value;
  alert(`Pembayaran Berhasil via ${method}!`);
  
  cart = [];
  closeCheckoutModal();
  renderProducts();
  updateBottomBar();
}

// --- UTILITY MODAL PENGATURAN ---
function openSettingsModal() {
  alert('Menu Pengaturan POS.');
}
