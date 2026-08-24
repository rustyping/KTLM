/* ==========================================================================
   KTLM KITCHEN POS - SYSTEM ENGINE (kasir.js)
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. DATA MASTER PRODUK (Contoh Data Menu ala Gacoan / KTLM Kitchen)
// --------------------------------------------------------------------------
const PRODUCTS = [
  {
    id: 'p1',
    name: 'Mie Iblis (Pedas Manis)',
    price: 11000,
    category: 'Mie',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80',
    hasVariants: true,
    levels: [0, 1, 2, 3, 4, 6, 8],
    toppings: [
      { id: 't1', name: 'Extra Udang Keju (2 pcs)', price: 9000 },
      { id: 't2', name: 'Extra Pangsit Goreng', price: 4000 },
      { id: 't3', name: 'Telur Ceplok', price: 4000 }
    ]
  },
  {
    id: 'p2',
    name: 'Mie Setan (Pedas Asin)',
    price: 11000,
    category: 'Mie',
    image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80',
    hasVariants: true,
    levels: [1, 2, 3, 4, 6, 8],
    toppings: [
      { id: 't1', name: 'Extra Udang Keju (2 pcs)', price: 9000 },
      { id: 't2', name: 'Extra Pangsit Goreng', price: 4000 }
    ]
  },
  {
    id: 'p3',
    name: 'Udang Keju (3 pcs)',
    price: 10000,
    category: 'Dimsum',
    image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&q=80',
    hasVariants: false
  },
  {
    id: 'p4',
    name: 'Udang Rambutan (3 pcs)',
    price: 10000,
    category: 'Dimsum',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80',
    hasVariants: false
  },
  {
    id: 'p5',
    name: 'Siomay Ayam (3 pcs)',
    price: 9000,
    category: 'Dimsum',
    image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80',
    hasVariants: false
  },
  {
    id: 'p6',
    name: 'Es Genderuwo',
    price: 9500,
    category: 'Minuman',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80',
    hasVariants: false
  },
  {
    id: 'p7',
    name: 'Es Pocong',
    price: 9500,
    category: 'Minuman',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80',
    hasVariants: false
  },
  {
    id: 'p8',
    name: 'Es Teh Manis',
    price: 4000,
    category: 'Minuman',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    hasVariants: true,
    drinkOptions: ['Dingin (Es)', 'Hangat']
  }
];

// --------------------------------------------------------------------------
// 2. STATE MANAGEMENT (Aplikasi State)
// --------------------------------------------------------------------------
let cart = []; // Menyimpan item di keranjang [{ cartItemId, id, name, price, qty, level, toppings, note }]
let currentCategory = 'Semua';
let searchQuery = '';
let activeProductForModal = null;
let selectedLevel = null;
let selectedToppings = [];
let modalQty = 1;

// --------------------------------------------------------------------------
// 3. INITIALIZATION & EVENT LISTENERS
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  renderCategoryBar();
  renderProducts();
  updateCartUI();

  // Search Bar Event
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderProducts();
    });
  }
});

// Helper Format Rupiah
function formatRp(number) {
  return 'Rp ' + number.toLocaleString('id-ID');
}

// --------------------------------------------------------------------------
// 4. RENDER CATEGORY BAR & PRODUCTS
// --------------------------------------------------------------------------
function renderCategoryBar() {
  const categoryContainer = document.getElementById('category-bar');
  if (!categoryContainer) return;

  const categories = ['Semua', ...new Set(PRODUCTS.map(p => p.category))];
  categoryContainer.innerHTML = categories.map(cat => `
    <button class="cat-btn ${cat === currentCategory ? 'active' : ''}" onclick="selectCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function selectCategory(cat) {
  currentCategory = cat;
  renderCategoryBar();
  renderProducts();
}

function renderProducts() {
  const gridContainer = document.getElementById('product-grid');
  if (!gridContainer) return;

  const filtered = PRODUCTS.filter(p => {
    const matchesCategory = currentCategory === 'Semua' || p.category === currentCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">Menu tidak ditemukan</div>`;
    return;
  }

  gridContainer.innerHTML = filtered.map(product => {
    // Hitung total Qty item produk ini di keranjang
    const cartItems = cart.filter(item => item.id === product.id);
    const totalQtyInCart = cartItems.reduce((acc, cur) => acc + cur.qty, 0);
    const hasSelected = totalQtyInCart > 0;

    return `
      <div class="product-card ${hasSelected ? 'has-selected' : ''}">
        <div class="product-img-wrapper" onclick="handleProductClick('${product.id}')">
          <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
          ${product.hasVariants ? `<span class="variant-tag">Ada Pilihan</span>` : ''}
        </div>
        <div class="product-details">
          <div class="product-info-text">
            <div class="product-title" onclick="handleProductClick('${product.id}')">${product.name}</div>
            <div class="product-price">${formatRp(product.price)}</div>
          </div>
          
          ${hasSelected && !product.hasVariants ? `
            <div class="qty-badge-inline">
              <button class="btn-qty-card" onclick="updateSimpleQty('${product.id}', -1)">-</button>
              <span class="qty-input-inline">${totalQtyInCart}</span>
              <button class="btn-qty-card" onclick="updateSimpleQty('${product.id}', 1)">+</button>
            </div>
          ` : `
            <button class="btn-add-card" onclick="handleProductClick('${product.id}')">
              ${hasSelected ? `+ Tambah (${totalQtyInCart})` : '+ Tambah'}
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// 5. MODAL VARIASI & LEVEL (Gacoan Pop-Up System)
// --------------------------------------------------------------------------
function handleProductClick(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  if (product.hasVariants) {
    openVariantModal(product);
  } else {
    // Jika tidak ada variasi, langsung tambah 1 ke keranjang
    addToCartSimple(product);
  }
}

function openVariantModal(product) {
  activeProductForModal = product;
  selectedLevel = product.levels ? product.levels[0] : null;
  selectedToppings = [];
  modalQty = 1;

  const modal = document.getElementById('variant-modal');
  if (!modal) return;

  // Render Judul & Detail Modal
  document.getElementById('modal-product-title').innerText = product.name;
  document.getElementById('modal-product-price').innerText = formatRp(product.price);

  let htmlContent = '';

  // Render Level Pedas (jika ada)
  if (product.levels) {
    htmlContent += `
      <div class="option-group">
        <div class="option-label">PILEH LEVEL PEDAS</div>
        <div class="chips-container">
          ${product.levels.map(lvl => `
            <div class="chip-option ${lvl === selectedLevel ? 'selected' : ''}" onclick="selectLevel(${lvl})">
              Lvl ${lvl}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Render Opsi Minuman (jika ada)
  if (product.drinkOptions) {
    selectedLevel = product.drinkOptions[0]; // simpan di selectedLevel untuk kemudahan
    htmlContent += `
      <div class="option-group">
        <div class="option-label">PILIHAN SERTI</div>
        <div class="chips-container">
          ${product.drinkOptions.map(opt => `
            <div class="chip-option ${opt === selectedLevel ? 'selected' : ''}" onclick="selectDrinkOption('${opt}')">
              ${opt}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Render Topping (jika ada)
  if (product.toppings) {
    htmlContent += `
      <div class="option-group">
        <div class="option-label">TAMBAH TOPPING</div>
        ${product.toppings.map(t => `
          <div class="counter-item-row">
            <span class="counter-item-name">${t.name} (+${formatRp(t.price)})</span>
            <input type="checkbox" onchange="toggleTopping('${t.id}')" style="width: 18px; height: 18px;">
          </div>
        `).join('')}
      </div>
    `;
  }

  // Counter Qty Modal
  htmlContent += `
    <div class="counter-item-row" style="margin-top: 15px;">
      <span class="counter-item-name">JUMLAH PESANAN</span>
      <div class="qty-badge-inline">
        <button class="btn-qty-card" onclick="changeModalQty(-1)">-</button>
        <span class="qty-input-inline" id="modal-qty-val">${modalQty}</span>
        <button class="btn-qty-card" onclick="changeModalQty(1)">+</button>
      </div>
    </div>
  `;

  document.getElementById('variant-modal-body').innerHTML = htmlContent;
  modal.style.display = 'flex';
}

function selectLevel(lvl) {
  selectedLevel = lvl;
  openVariantModal(activeProductForModal); // Refresh UI Modal
}

function selectDrinkOption(opt) {
  selectedLevel = opt;
  openVariantModal(activeProductForModal);
}

function toggleTopping(toppingId) {
  const index = selectedToppings.indexOf(toppingId);
  if (index > -1) {
    selectedToppings.splice(index, 1);
  } else {
    selectedToppings.push(toppingId);
  }
}

function changeModalQty(delta) {
  modalQty = Math.max(1, modalQty + delta);
  const qtyElem = document.getElementById('modal-qty-val');
  if (qtyElem) qtyElem.innerText = modalQty;
}

function closeVariantModal() {
  const modal = document.getElementById('variant-modal');
  if (modal) modal.style.display = 'none';
  activeProductForModal = null;
}

function submitVariantToCart() {
  if (!activeProductForModal) return;

  // Hitung total harga item + topping
  let extraPrice = 0;
  let toppingNames = [];

  if (activeProductForModal.toppings) {
    selectedToppings.forEach(tId => {
      const top = activeProductForModal.toppings.find(t => t.id === tId);
      if (top) {
        extraPrice += top.price;
        toppingNames.push(top.name);
      }
    });
  }

  const itemPrice = activeProductForModal.price + extraPrice;
  const cartItemId = `${activeProductForModal.id}-${selectedLevel}-${selectedToppings.sort().join(',')}`;

  // Cek apakah item variasi identik sudah ada di keranjang
  const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

  if (existingIndex > -1) {
    cart[existingIndex].qty += modalQty;
  } else {
    cart.push({
      cartItemId: cartItemId,
      id: activeProductForModal.id,
      name: activeProductForModal.name,
      basePrice: activeProductForModal.price,
      price: itemPrice,
      qty: modalQty,
      variantDetail: selectedLevel !== null ? (typeof selectedLevel === 'number' ? `Level ${selectedLevel}` : selectedLevel) : '',
      toppingsText: toppingNames.join(', ')
    });
  }

  closeVariantModal();
  updateCartUI();
  renderProducts();
}

// --------------------------------------------------------------------------
// 6. KERANJANG BELANJA & BOTTOM BAR MANAGEMENT
// --------------------------------------------------------------------------
function addToCartSimple(product) {
  const existingIndex = cart.findIndex(item => item.id === product.id && !item.variantDetail);

  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      cartItemId: product.id,
      id: product.id,
      name: product.name,
      basePrice: product.price,
      price: product.price,
      qty: 1,
      variantDetail: '',
      toppingsText: ''
    });
  }

  updateCartUI();
  renderProducts();
}

function updateSimpleQty(productId, delta) {
  const itemIndex = cart.findIndex(item => item.id === productId && !item.variantDetail);
  if (itemIndex > -1) {
    cart[itemIndex].qty += delta;
    if (cart[itemIndex].qty <= 0) {
      cart.splice(itemIndex, 1);
    }
  }
  updateCartUI();
  renderProducts();
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Bottom Bar Elements
  const bottomItemsElem = document.getElementById('bottom-cart-items');
  const bottomTotalElem = document.getElementById('bottom-cart-total');
  const checkoutBtn = document.getElementById('btn-checkout');

  if (bottomItemsElem) bottomItemsElem.innerText = `${totalItems} Item`;
  if (bottomTotalElem) bottomTotalElem.innerText = formatRp(totalPrice);
  if (checkoutBtn) checkoutBtn.disabled = totalItems === 0;
}

// --------------------------------------------------------------------------
// 7. MODAL CHECKOUT & CETAK STRUK THERMAL
// --------------------------------------------------------------------------
function openCartDrawer() {
  if (cart.length === 0) return;

  const checkoutModal = document.getElementById('checkout-modal');
  const cartContainer = document.getElementById('cart-items-container');
  const summaryTotal = document.getElementById('checkout-total-price');

  if (!checkoutModal || !cartContainer) return;

  // Render Rincian Item Keranjang
  cartContainer.innerHTML = cart.map((item, index) => `
    <div class="cart-item-row">
      <div>
        <div class="cart-item-name">${item.name}</div>
        ${item.variantDetail || item.toppingsText ? `
          <div class="cart-item-sub">${[item.variantDetail, item.toppingsText].filter(Boolean).join(' | ')}</div>
        ` : ''}
        <div class="cart-item-price">${formatRp(item.price)} x ${item.qty}</div>
      </div>
      <div class="qty-badge-inline">
        <button class="btn-qty-card" onclick="changeCartItemQty(${index}, -1)">-</button>
        <span class="qty-input-inline">${item.qty}</span>
        <button class="btn-qty-card" onclick="changeCartItemQty(${index}, 1)">+</button>
      </div>
    </div>
  `).join('');

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  if (summaryTotal) summaryTotal.innerText = formatRp(totalPrice);

  checkoutModal.style.display = 'flex';
}

function changeCartItemQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  if (cart.length === 0) {
    closeCheckoutModal();
  } else {
    openCartDrawer(); // Re-render Checkout
  }
  updateCartUI();
  renderProducts();
}

function closeCheckoutModal() {
  const checkoutModal = document.getElementById('checkout-modal');
  if (checkoutModal) checkoutModal.style.display = 'none';
}

// --------------------------------------------------------------------------
// 8. PROSES BAYAR & CETAK STRUK
// --------------------------------------------------------------------------
function processPayment() {
  if (cart.length === 0) return;

  const orderType = document.getElementById('order-type') ? document.getElementById('order-type').value : 'Dine In';
  const customerName = document.getElementById('customer-name') ? document.getElementById('customer-name').value || 'Pelanggan' : 'Pelanggan';
  const paymentMethod = document.getElementById('payment-method') ? document.getElementById('payment-method').value : 'Tunai';

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Template Struk Thermal (58mm)
  const receiptHTML = `
    <div style="text-align: center; font-weight: bold; font-size: 14px;">KTLM KITCHEN</div>
    <div style="text-align: center; font-size: 10px; margin-bottom: 8px;">Jl. Raya Utama No. 123, Malang</div>
    <div style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>
    <div style="font-size: 10px;">
      <div>Tgl : ${timeStr}</div>
      <div>Plg : ${customerName} (${orderType})</div>
      <div>Byr : ${paymentMethod}</div>
    </div>
    <div style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>
    ${cart.map(item => `
      <div style="font-size: 10px;">
        <div style="font-weight: bold;">${item.name}</div>
        ${item.variantDetail || item.toppingsText ? `<div>* ${[item.variantDetail, item.toppingsText].filter(Boolean).join(' | ')}</div>` : ''}
        <div style="display: flex; justify-content: space-between;">
          <span>${item.qty} x ${item.price.toLocaleString('id-ID')}</span>
          <span>${(item.qty * item.price).toLocaleString('id-ID')}</span>
        </div>
      </div>
    `).join('')}
    <div style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
      <span>TOTAL</span>
      <span>${formatRp(totalPrice)}</span>
    </div>
    <div style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>
    <div style="text-align: center; margin-top: 10px; font-size: 10px;">Terima Kasih Atas Kunjungannya!</div>
  `;

  // Tampilkan Elemen Cetak Struk
  const receiptContainer = document.getElementById('receipt-print');
  if (receiptContainer) {
    receiptContainer.innerHTML = receiptHTML;
    receiptContainer.style.display = 'block';
  }

  // Panggil dialog cetak browser
  window.print();

  // Reset State Setelah Transaksi Selesai
  alert('Transaksi Berhasil!');
  cart = [];
  closeCheckoutModal();
  updateCartUI();
  renderProducts();

  if (receiptContainer) {
    receiptContainer.style.display = 'none';
  }
}
