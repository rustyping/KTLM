const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23adb5bd'>MENU</text></svg>";

let storeConfig = {};
let allProducts = [];
let allSubcategories = [];
let cart = [];
let selectedCategory = "ALL";

let activeSubProduct = null;
let selectedSubOptions = {};

let currentDetailProduct = null;
let currentDetailQty = 1;

// Helper URL Gambar Google Drive
function fixImageUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') return DEFAULT_PLACEHOLDER;
  if (url.indexOf('drive.google.com') !== -1) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return "https://lh3.googleusercontent.com/d/" + match[1];
    }
  }
  return url;
}

// Format nomor HP ke WhatsApp Internasional
function formatToWhatsappNumber(phoneStr) {
  if (!phoneStr) return "";
  let cleaned = phoneStr.toString().replace(/\D/g, '');
  if (cleaned.indexOf("0") === 0) {
    cleaned = "62" + cleaned.substring(1);
  }
  return cleaned;
}

// Filter produk katalog
function isVisibleInCatalog(p) {
  if (!p) return false;
  const statusKatalog = (p.katalog || "Y").toString().trim().toUpperCase();
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

  const activeProducts = allProducts.filter(function(p) {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    return statusAktif === 'Y' && isVisibleInCatalog(p);
  });

  const categories = ["ALL"];
  activeProducts.forEach(function(p) {
    if (p.kategori && categories.indexOf(p.kategori) === -1) {
      categories.push(p.kategori);
    }
  });

  catBar.innerHTML = categories.map(function(cat) {
    const activeClass = (cat === selectedCategory) ? 'active' : '';
    return '<button class="cat-btn ' + activeClass + '" onclick="filterCategory(\'' + cat + '\', this)">' + cat + '</button>';
  }).join('');
}

function getSubCategoriesForProduct(product) {
  if (!allSubcategories || allSubcategories.length === 0) return [];
  return allSubcategories.filter(function(s) {
    return (s.id_produk && s.id_produk.toString().toLowerCase() === product.id.toString().toLowerCase()) ||
           (s.produk && s.produk.toString().toLowerCase() === product.nama.toString().toLowerCase());
  });
}

function filterCategory(cat, btn) {
  selectedCategory = cat;
  const btns = document.querySelectorAll('.cat-btn');
  for (let i = 0; i < btns.length; i++) {
    btns[i].classList.remove('active');
  }
  if (btn) btn.classList.add('active');
  filterProducts();
}

function filterProducts() {
  const searchInput = document.getElementById("searchInput");
  const keyword = searchInput ? searchInput.value.toLowerCase() : "";
  
  let filtered = allProducts.filter(function(p) {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    const isAktif = statusAktif === 'Y';
    const isKatalog = isVisibleInCatalog(p);
    const matchCat = (selectedCategory === "ALL" || p.kategori === selectedCategory);
    const matchSearch = p.nama.toLowerCase().indexOf(keyword) !== -1;
    
    return isAktif && isKatalog && matchCat && matchSearch;
  });

  renderProducts(filtered);
}

// Render Produk dengan Tampilan ala Gacoan
function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  if (!products || products.length === 0) {
    grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: #6c757d; padding: 20px;">Menu tidak ditemukan</p>';
    return;
  }
  
  grid.innerHTML = products.map(function(p) {
    const totalQtyInCart = cart
      .filter(function(c) { return c.product.id === p.id; })
      .reduce(function(sum, i) { return sum + i.qty; }, 0);

    const subCategories = getSubCategoriesForProduct(p);
    const hasSub = subCategories.length > 0;

    const rawImgUrl = p['Link Gambar'] || p.linkGambar || p.gambar || p[10];
    const imgUrl = fixImageUrl(rawImgUrl);
    const isSelected = totalQtyInCart > 0;

    let buttonHtml = '';
    if (isSelected) {
      buttonHtml = 
        '<div class="qty-control-inline" onclick="event.stopPropagation()">' +
          '<button type="button" class="btn-qty-action" onclick="changeQtyCard(\'' + p.id + '\', -1)">-</button>' +
          '<span class="qty-val-text">' + totalQtyInCart + '</span>' +
          '<button type="button" class="btn-qty-action" onclick="changeQtyCard(\'' + p.id + '\', 1)">+</button>' +
        '</div>';
    } else {
      buttonHtml = 
        '<button type="button" class="btn-add-item" onclick="handleAddButtonClick(\'' + p.id + '\', event)">Add</button>';
    }

    return '' +
      '<div class="product-card">' +
        '<div class="product-img-wrapper" onclick="handleImageClick(\'' + p.id + '\')">' +
          '<img src="' + imgUrl + '" alt="' + p.nama + '" class="product-img" onerror="this.src=\'' + DEFAULT_PLACEHOLDER + '\'" loading="lazy">' +
          (hasSub ? '<span class="variant-tag">+ Variasi/Pilihan</span>' : '') +
        '</div>' +
        '<div class="product-info">' +
          '<div>' +
            '<div class="product-title">' + p.nama + '</div>' +
            '<div class="product-price">Rp' + (p.harga || 0).toLocaleString('id-ID') + '</div>' +
          '</div>' +
          buttonHtml +
        '</div>' +
      '</div>';
  }).join('');
}

// Handle Klik Tombol Add
function handleAddButtonClick(productId, event) {
  if (event) event.stopPropagation();
  const product = allProducts.find(function(p) { return p.id === productId; });
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);
  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    addToCart(product, 1, "");
  }
}

// Handle Klik Gambar Produk (Buka Modal Detail atau Subkategori)
function handleImageClick(productId) {
  const product = allProducts.find(function(p) { return p.id === productId; });
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);
  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    openProductDetailModal(product);
  }
}

// Change Qty langsung di kartu produk
function changeQtyCard(productId, delta) {
  const product = allProducts.find(function(p) { return p.id === productId; });
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) {
    if (delta > 0) {
      openSubCategoryModal(product, subCategories);
    } else {
      const lastIndex = cart.map(function(c) { return c.product.id; }).lastIndexOf(productId);
      if (lastIndex !== -1) {
        updateQtyInCartList(lastIndex, -1);
      }
    }
  } else {
    const existingIndex = cart.findIndex(function(c) { return c.product.id === productId; });
    if (existingIndex !== -1) {
      updateQtyInCartList(existingIndex, delta);
    }
  }
}

/* MODAL DETAIL PRODUK (POPUP KLIK GAMBAR ALA GACOAN) */
function openProductDetailModal(product) {
  currentDetailProduct = product;
  const existingItem = cart.find(function(item) { return item.product.id === product.id; });
  currentDetailQty = existingItem ? existingItem.qty : 1;

  const titleEl = document.getElementById("detailModalTitle");
  if (titleEl) titleEl.innerText = product.nama;

  const nameEl = document.getElementById("detailModalName");
  if (nameEl) nameEl.innerText = product.nama;

  const priceEl = document.getElementById("detailModalPrice");
  if (priceEl) priceEl.innerText = "Rp" + (product.harga || 0).toLocaleString('id-ID');

  const imgEl = document.getElementById("detailModalImg");
  if (imgEl) {
    const rawImgUrl = product['Link Gambar'] || product.linkGambar || product.gambar || product[10];
    imgEl.src = fixImageUrl(rawImgUrl);
  }

  const noteEl = document.getElementById("detailModalNote");
  if (noteEl) noteEl.value = existingItem ? (existingItem.note || "") : "";

  const qtyEl = document.getElementById("detailModalQty");
  if (qtyEl) qtyEl.innerText = currentDetailQty;

  const modal = document.getElementById("productDetailModal");
  if (modal) modal.style.display = "flex";
}

function closeProductDetailModal() {
  const modal = document.getElementById("productDetailModal");
  if (modal) modal.style.display = "none";
  currentDetailProduct = null;
}

function changeDetailModalQty(delta) {
  currentDetailQty += delta;
  if (currentDetailQty < 1) currentDetailQty = 1;
  const qtyEl = document.getElementById("detailModalQty");
  if (qtyEl) qtyEl.innerText = currentDetailQty;
}

function saveDetailModalCart() {
  if (!currentDetailProduct) return;

  const noteEl = document.getElementById("detailModalNote");
  const noteInput = noteEl ? noteEl.value.trim() : "";
  const existingItem = cart.find(function(item) { return item.product.id === currentDetailProduct.id; });

  if (existingItem) {
    existingItem.qty = currentDetailQty;
    existingItem.note = noteInput;
  } else {
    cart.push({
      product: currentDetailProduct,
      qty: currentDetailQty,
      subVariant: "",
      note: noteInput
    });
  }

  closeProductDetailModal();
  updateCartUI();
  filterProducts();
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
  subCategories.forEach(function(group, index) {
    const groupName = group.nama_kategori || group.kategori_opsi || ("Pilihan " + (index + 1));
    let rawOptions = group.opsi || group.pilihan || "";
    let optionsList = Array.isArray(rawOptions) ? rawOptions : rawOptions.split(',').map(function(o) { return o.trim(); }).filter(Boolean);

    const groupLower = groupName.toLowerCase();
    const isCounterGroup = groupLower.indexOf('isi') !== -1 || groupLower.indexOf('varian') !== -1 || 
                           groupLower.indexOf('paket') !== -1 || groupLower.indexOf('pilih') !== -1 || 
                           group.tipe === 'counter';

    if (optionsList.length > 0) {
      if (isCounterGroup) {
        selectedSubOptions[groupName] = {};
        optionsList.forEach(function(opt) { selectedSubOptions[groupName][opt] = 0; });

        html += 
          '<div class="option-group">' +
            '<div class="option-label">' +
              '<span>' + groupName.toUpperCase() + '</span>' +
              '<span style="font-size: 11px; color: #2e7d32; font-weight: 800;" id="totalCounterTag_' + index + '">Total: 0 Item</span>' +
            '</div>' +
            '<div>' +
              optionsList.map(function(opt) {
                const safeOptId = opt.replace(/\s+/g, '_');
                return '' +
                  '<div class="counter-item-row">' +
                    '<span class="counter-item-name">' + opt + '</span>' +
                    '<div class="counter-control">' +
                      '<button type="button" class="btn-counter-mini" onclick="adjustSubCounter(\'' + groupName + '\', \'' + opt + '\', -1, ' + index + ')">-</button>' +
                      '<span class="counter-val" id="cnt_' + index + '_' + safeOptId + '">0</span>' +
                      '<button type="button" class="btn-counter-mini" onclick="adjustSubCounter(\'' + groupName + '\', \'' + opt + '\', 1, ' + index + ')">+</button>' +
                    '</div>' +
                  '</div>';
              }).join('') +
            '</div>' +
          '</div>';
      } else {
        selectedSubOptions[groupName] = optionsList[0];

        html += 
          '<div class="option-group">' +
            '<div class="option-label">' +
              '<span>' + groupName.toUpperCase() + '</span>' +
              '<span style="font-size: 10px; font-weight: normal; color: #6c757d;">(Pilih 1)</span>' +
            '</div>' +
            '<div class="chips-container">' +
              optionsList.map(function(opt, optIndex) {
                const isSelected = optIndex === 0 ? 'selected' : '';
                return '' +
                  '<button type="button" class="chip-option ' + isSelected + '" onclick="selectSingleSubOption(\'' + groupName + '\', \'' + opt + '\', this)">' +
                    opt +
                  '</button>';
              }).join('') +
            '</div>' +
          '</div>';
      }
    }
  });

  html += 
    '<div class="form-group" style="margin-top:15px;">' +
      '<label>JUMLAH PORSI / PAKET</label>' +
      '<input type="number" id="subQtyInput" class="form-input" value="1" min="1" style="font-size:18px; font-weight:bold; text-align:center;">' +
    '</div>';

  modalBody.innerHTML = html;
  const modal = document.getElementById("subCategoryModal");
  if (modal) modal.style.display = "flex";
}

function adjustSubCounter(groupName, optionValue, delta, groupIdx) {
  if (!selectedSubOptions[groupName]) selectedSubOptions[groupName] = {};
  
  let currentVal = selectedSubOptions[groupName][optionValue] || 0;
  let newVal = Math.max(0, currentVal + delta);
  selectedSubOptions[groupName][optionValue] = newVal;

  const elementId = "cnt_" + groupIdx + "_" + optionValue.replace(/\s+/g, '_');
  const el = document.getElementById(elementId);
  if (el) el.innerText = newVal;

  let totalItems = 0;
  Object.keys(selectedSubOptions[groupName]).forEach(function(k) {
    totalItems += selectedSubOptions[groupName][k];
  });
  const tagEl = document.getElementById("totalCounterTag_" + groupIdx);
  if (tagEl) tagEl.innerText = "Total: " + totalItems + " Item";
}

function selectSingleSubOption(groupName, optionValue, btn) {
  selectedSubOptions[groupName] = optionValue;
  const parent = btn.parentElement;
  const chips = parent.querySelectorAll('.chip-option');
  for (let i = 0; i < chips.length; i++) {
    chips[i].classList.remove('selected');
  }
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

  Object.keys(selectedSubOptions).forEach(function(key) {
    const val = selectedSubOptions[key];
    if (typeof val === 'object' && val !== null) {
      let itemsList = [];
      Object.keys(val).forEach(function(itemKey) {
        if (val[itemKey] > 0) {
          itemsList.push(val[itemKey] + " " + itemKey);
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
  const existing = cart.find(function(item) {
    return item.product.id === product.id && (item.subVariant || "") === (subVariant || "");
  });

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ product: product, qty: qty, subVariant: subVariant || "", note: "" });
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

function updateCartUI() {
  const totalQty = cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
  const totalPrice = cart.reduce(function(sum, item) { return sum + ((item.product.harga || 0) * item.qty); }, 0);

  const itemCountEl = document.getElementById("barItemCount");
  const totalAmountEl = document.getElementById("barTotalAmount");
  const modalTotalEl = document.getElementById("modalTotalAmount");
  const btnCheckout = document.getElementById("btnOpenCheckout");

  if (itemCountEl) itemCountEl.innerText = totalQty + " Item";
  if (totalAmountEl) totalAmountEl.innerText = "Rp" + totalPrice.toLocaleString('id-ID');
  if (modalTotalEl) modalTotalEl.innerText = "Rp" + totalPrice.toLocaleString('id-ID');
  if (btnCheckout) btnCheckout.disabled = (cart.length === 0);
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
  container.innerHTML = cart.map(function(item, idx) {
    let noteText = "";
    if (item.subVariant) noteText += " [ " + item.subVariant + " ]";
    if (item.note) noteText += " (Catatan: " + item.note + ")";

    return '' +
      '<div class="cart-item-row">' +
        '<div>' +
          '<div class="cart-item-name">' + item.product.nama + '</div>' +
          (noteText ? '<div style="font-size:11px; color:#6c757d; font-style:italic;">' + noteText + '</div>' : '') +
          '<div class="cart-item-price">Rp' + (item.product.harga || 0).toLocaleString('id-ID') + ' x ' + item.qty + '</div>' +
        '</div>' +
        '<div class="qty-controls">' +
          '<button class="btn-qty-mini" onclick="updateQtyInCartList(' + idx + ', -1)">-</button>' +
          '<span style="font-size:13px; font-weight:bold;">' + item.qty + '</span>' +
          '<button class="btn-qty-mini" onclick="updateQtyInCartList(' + idx + ', 1)">+</button>' +
        '</div>' +
      '</div>';
  }).join('');
}

/* PROSES SIMPAN KE SHEET & REDIRECT KE WHATSAPP (Aman iPad / iOS 12) */
async function submitCatalogOrder() {
  const custNameEl = document.getElementById("custNameInput");
  const custName = custNameEl ? custNameEl.value.trim() : "";

  if (!custName) {
    alert("Silakan isi Nama Pemesan terlebih dahulu.");
    if (custNameEl) custNameEl.focus();
    return;
  }

  const btnSubmit = document.getElementById("btnSubmitOrder");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Mengirim Pesanan...";
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1);
  const date = (now.getDate() < 10 ? '0' : '') + now.getDate();
  const invoiceNo = "INV-KATALOG-" + year + month + date + "-" + Math.floor(1000 + Math.random() * 9000);
  const waktuTx = now.toLocaleString('id-ID');

  const paymentEl = document.getElementById("paymentMethodSelect");
  const selectedPayment = paymentEl ? paymentEl.value : "Tunai";

  const noteEl = document.getElementById("orderNote");
  const noteValue = noteEl ? noteEl.value.trim() : "";
  
  const totalBelanja = cart.reduce(function(sum, i) { return sum + ((i.product.harga || 0) * i.qty); }, 0);
  const totalHpp = cart.reduce(function(sum, i) { return sum + ((i.product.hpp || 0) * i.qty); }, 0);
  
  let detailText = cart.map(function(i) {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += " (" + i.subVariant + ")";
    if (i.note) nameStr += " [Ket: " + i.note + "]";
    return nameStr + " (" + i.qty + "x)";
  }).join(", ");

  if (noteValue) detailText += " | Catatan Tambahan: " + noteValue;

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
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const targetWaRaw = storeConfig.WA || "085838976880";
    const targetWaFormatted = formatToWhatsappNumber(targetWaRaw);

    let waText = "*PESANAN BARU - KATALOG ONLINE*\n";
    waText += "----------------------------------\n";
    waText += "*No Invoice:* " + invoiceNo + "\n";
    waText += "*Nama:* " + custName + "\n";
    waText += "*Pembayaran:* " + selectedPayment + "\n";
    if (noteValue) waText += "*Alamat/Catatan:* " + noteValue + "\n";
    waText += "----------------------------------\n";
    waText += "*Detail Pesanan:*\n";
    
    cart.forEach(function(i) {
      let itemLine = "• " + i.product.nama;
      if (i.subVariant) itemLine += "\n   └ _[" + i.subVariant + "]_";
      if (i.note) itemLine += "\n   └ _(Catatan: " + i.note + ")_";
      itemLine += " (" + i.qty + "x) = Rp" + (i.qty * (i.product.harga || 0)).toLocaleString('id-ID') + "\n";
      waText += itemLine;
    });

    waText += "----------------------------------\n";
    waText += "*TOTAL: Rp" + totalBelanja.toLocaleString('id-ID') + "*\n\n";
    waText += "Halo, saya ingin memesan menu di atas. Mohon diproses, terima kasih!";

    const waUrl = "https://wa.me/" + targetWaFormatted + "?text=" + encodeURIComponent(waText);
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
