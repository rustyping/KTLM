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

// Variable penampung data transaksi terakhir untuk cetak struk
let lastOrderData = null;

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

// Subkategori Filter
function getSubCategoriesForProduct(product) {
  if (!allSubcategories || allSubcategories.length === 0 || !product) return [];
  return allSubcategories.filter(function(s) {
    return (s.id_produk && String(s.id_produk).toLowerCase() === String(product.id).toLowerCase()) ||
           (s.produk && String(s.produk).toLowerCase() === String(product.nama).toLowerCase());
  });
}

// Load Data Awal
async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    storeConfig = data.store || {};
    allProducts = data.products || [];
    allSubcategories = data.subkategori || [];

    const titleEl = document.getElementById("storeTitleHeader");
    if (titleEl && storeConfig.Header) {
      titleEl.innerText = storeConfig.Header;
    }

    renderCategories();
    filterProducts();
  } catch (err) {
    console.error(err);
    alert("Gagal memuat data kasir.");
  }
}

function renderCategories() {
  const catBar = document.getElementById("categoryBar");
  if (!catBar) return;

  const activeProducts = allProducts.filter(function(p) {
    const statusAktif = (p['Aktif (Y/N)'] || p.aktif || p.Aktif || p[8] || 'Y').toString().trim().toUpperCase();
    return statusAktif === 'Y';
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
    const matchCat = (selectedCategory === "ALL" || p.kategori === selectedCategory);
    const matchSearch = p.nama.toLowerCase().indexOf(keyword) !== -1;
    
    return isAktif && matchCat && matchSearch;
  });

  renderProducts(filtered);
}

// Render Produk Kasir (Tombol: Add / [- 1 +])
function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  if (!products || products.length === 0) {
    grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: #6c757d; padding: 20px;">Menu tidak ditemukan</p>';
    return;
  }
  
  grid.innerHTML = products.map(function(p) {
    const totalQtyInCart = cart
      .filter(function(c) { return String(c.product.id) === String(p.id); })
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
          '<button type="button" class="btn-qty-action" onclick="changeQtyCard(\'' + p.id + '\', -1, event)">-</button>' +
          '<span class="qty-val-text">' + totalQtyInCart + '</span>' +
          '<button type="button" class="btn-qty-action" onclick="changeQtyCard(\'' + p.id + '\', 1, event)">+</button>' +
        '</div>';
    } else {
      buttonHtml = 
        '<button type="button" class="btn-add-item" onclick="handleAddButtonClick(\'' + p.id + '\', event)">Add</button>';
    }

    return '' +
      '<div class="product-card">' +
        '<div class="product-img-wrapper" onclick="handleImageClick(\'' + p.id + '\')">' +
          '<img src="' + imgUrl + '" alt="' + p.nama + '" class="product-img" onerror="this.src=\'' + DEFAULT_PLACEHOLDER + '\'" loading="lazy">' +
          (hasSub ? '<span class="variant-tag">+ Variasi</span>' : '') +
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
  const product = allProducts.find(function(p) { return String(p.id) === String(productId); });
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);
  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    addToCart(product, 1, "");
  }
}

// Handle Klik Gambar Produk (Masuk Detail seperti index.html)
function handleImageClick(productId) {
  const product = allProducts.find(function(p) { return String(p.id) === String(productId); });
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);
  if (subCategories.length > 0) {
    openSubCategoryModal(product, subCategories);
  } else {
    openProductDetailModal(product);
  }
}

// Change Qty langsung pada kartu
function changeQtyCard(productId, delta, event) {
  if (event) event.stopPropagation();
  const product = allProducts.find(function(p) { return String(p.id) === String(productId); });
  if (!product) return;

  const subCategories = getSubCategoriesForProduct(product);

  if (subCategories.length > 0) {
    if (delta > 0) {
      openSubCategoryModal(product, subCategories);
    } else {
      const cartIdx = cart.map(function(i) { return String(i.product.id); }).lastIndexOf(String(productId));
      if (cartIdx !== -1) {
        updateQtyInCartList(cartIdx, -1);
      }
    }
  } else {
    const existingIndex = cart.findIndex(function(c) { return String(c.product.id) === String(productId); });
    if (existingIndex !== -1) {
      updateQtyInCartList(existingIndex, delta);
    }
  }
}

/* MODAL DETAIL PRODUK (KLIK GAMBAR SEPERTI INDEX.HTML) */
function openProductDetailModal(product) {
  currentDetailProduct = product;
  const existingItem = cart.find(function(item) { return String(item.product.id) === String(product.id); });
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
  const existingItem = cart.find(function(item) { return String(item.product.id) === String(currentDetailProduct.id); });

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

/* MANAJEMEN KERANJANG & CHECKOUT */
function addToCart(product, qty, subVariant) {
  const existing = cart.find(function(item) {
    return String(item.product.id) === String(product.id) && (item.subVariant || "") === (subVariant || "");
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

  calculateChange();
}

function openCheckoutModal() {
  if (cart.length === 0) return;
  renderModalCartList();
  toggleCashInput();
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
    if (item.note) noteText += " (Ket: " + item.note + ")";

    return '' +
      '<div class="cart-item-row">' +
        '<div>' +
          '<div class="cart-item-name">' + item.product.nama + '</div>' +
          (noteText ? '<div style="font-size:11px; color:#6c757d; font-style:italic;">' + noteText + '</div>' : '') +
          '<div class="cart-item-price">Rp' + (item.product.harga || 0).toLocaleString('id-ID') + ' x ' + item.qty + '</div>' +
        '</div>' +
        '<div class="qty-controls">' +
          '<button type="button" class="btn-qty-mini" onclick="updateQtyInCartList(' + idx + ', -1)">-</button>' +
          '<span style="font-size:13px; font-weight:bold;">' + item.qty + '</span>' +
          '<button type="button" class="btn-qty-mini" onclick="updateQtyInCartList(' + idx + ', 1)">+</button>' +
        '</div>' +
      '</div>';
  }).join('');
}

/* KALKULATOR UANG DITERIMA & KEMBALIAN (KASIR) */
function toggleCashInput() {
  const paymentSelect = document.getElementById("paymentMethodSelect");
  const cashSection = document.getElementById("cashCalculationSection");
  if (!paymentSelect || !cashSection) return;

  if (paymentSelect.value === "Tunai") {
    cashSection.style.display = "block";
  } else {
    cashSection.style.display = "none";
  }
}

function setExactCash() {
  const totalPrice = cart.reduce(function(sum, item) { return sum + ((item.product.harga || 0) * item.qty); }, 0);
  const input = document.getElementById("cashReceivedInput");
  if (input) {
    input.value = totalPrice;
    calculateChange();
  }
}

function addQuickCash(amount) {
  const input = document.getElementById("cashReceivedInput");
  if (input) {
    const currentVal = parseInt(input.value) || 0;
    input.value = currentVal + amount;
    calculateChange();
  }
}

function calculateChange() {
  const totalPrice = cart.reduce(function(sum, item) { return sum + ((item.product.harga || 0) * item.qty); }, 0);
  const cashInput = document.getElementById("cashReceivedInput");
  const cashVal = parseInt(cashInput ? cashInput.value : 0) || 0;
  
  const change = cashVal - totalPrice;
  const displayEl = document.getElementById("cashChangeDisplay");

  if (displayEl) {
    if (change < 0) {
      displayEl.innerText = "Kurang Rp" + Math.abs(change).toLocaleString('id-ID');
      displayEl.style.color = "#dc2626";
    } else {
      displayEl.innerText = "Rp" + change.toLocaleString('id-ID');
      displayEl.style.color = "#0369a1";
    }
  }
}

/* FITUR CETAK STRUK / PRINT RECEIPT */
function printReceipt(orderData) {
  const data = orderData || lastOrderData;
  if (!data) {
    alert("Tidak ada data transaksi yang bisa dicetak.");
    return;
  }

  const storeName = storeConfig.Header || storeConfig.namaToko || "KASIR TOKO";
  const storeAddress = storeConfig.Alamat || storeConfig.alamat || "";
  const storePhone = storeConfig.Telepon || storeConfig.tlp || storeConfig.phone || "";

  let itemsRowsHtml = data.items.map(function(item) {
    let subText = item.subVariant ? ' (' + item.subVariant + ')' : '';
    let noteText = item.note ? ' [Ket: ' + item.note + ']' : '';
    let fullTitle = item.product.nama + subText + noteText;
    let subtotal = (item.product.harga || 0) * item.qty;

    return '' +
      '<tr>' +
        '<td colspan="2" style="font-weight:bold; padding-top:4px;">' + fullTitle + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="padding-bottom:4px; padding-left:8px;">' + item.qty + ' x Rp' + (item.product.harga || 0).toLocaleString('id-ID') + '</td>' +
        '<td style="text-align:right; padding-bottom:4px;">Rp' + subtotal.toLocaleString('id-ID') + '</td>' +
      '</tr>';
  }).join('');

  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) {
    alert("Popup diblokir! Harap izinkan popup di browser Anda untuk mencetak struk.");
    return;
  }

  const doc = printWindow.document;
  doc.write('<!DOCTYPE html><html><head><title>Struk ' + data.invoiceNo + '</title>');
  doc.write('<style>');
  doc.write('@page { size: 58mm auto; margin: 0; }');
  doc.write('body { font-family: "Courier New", Courier, monospace; font-size: 11px; line-height: 1.3; width: 58mm; margin: 0 auto; padding: 6px; color: #000; background: #fff; }');
  doc.write('.text-center { text-align: center; }');
  doc.write('.text-right { text-align: right; }');
  doc.write('.bold { font-weight: bold; }');
  doc.write('.divider { border-top: 1px dashed #000; margin: 6px 0; }');
  doc.write('table { width: 100%; border-collapse: collapse; }');
  doc.write('td { vertical-align: top; }');
  doc.write('.title { font-size: 13px; font-weight: bold; text-transform: uppercase; }');
  doc.write('</style></head><body>');
  
  doc.write('<div class="text-center">');
  doc.write('<div class="title">' + storeName + '</div>');
  if (storeAddress) doc.write('<div>' + storeAddress + '</div>');
  if (storePhone) doc.write('<div>Telp: ' + storePhone + '</div>');
  doc.write('</div>');

  doc.write('<div class="divider"></div>');
  doc.write('<div>No  : ' + data.invoiceNo + '</div>');
  doc.write('<div>Tgl : ' + data.waktu + '</div>');
  doc.write('<div>Plg : ' + data.customerName + '</div>');
  doc.write('<div>Kasir: ' + (data.kasir || 'Kasir Toko') + '</div>');

  doc.write('<div class="divider"></div>');
  doc.write('<table>' + itemsRowsHtml + '</table>');
  doc.write('<div class="divider"></div>');

  doc.write('<table>');
  doc.write('<tr><td>TOTAL</td><td class="text-right bold">Rp' + data.totalBelanja.toLocaleString('id-ID') + '</td></tr>');
  doc.write('<tr><td>BAYAR (' + data.jenisPembayaran + ')</td><td class="text-right">Rp' + data.uangDiterima.toLocaleString('id-ID') + '</td></tr>');
  doc.write('<tr><td>KEMBALI</td><td class="text-right">Rp' + Math.max(0, data.kembalian).toLocaleString('id-ID') + '</td></tr>');
  doc.write('</table>');

  doc.write('<div class="divider"></div>');
  doc.write('<div class="text-center" style="margin-top:8px;">');
  doc.write('<div>Terima Kasih atas Kunjungan Anda</div>');
  doc.write('<div>Selamat Menikmati!</div>');
  doc.write('</div>');

  doc.write('</body></html>');
  doc.close();

  printWindow.focus();
  setTimeout(function() {
    printWindow.print();
    printWindow.close();
  }, 400);
}

// Fungsi opsional jika ingin mencetak struk transaksi terakhir secara manual
function printLastReceipt() {
  printReceipt(lastOrderData);
}

/* PROSES SIMPAN TRANSAKSI KASIR KE SHEET */
async function submitCashierOrder() {
  const custNameEl = document.getElementById("custNameInput");
  const custName = custNameEl ? custNameEl.value.trim() : "";

  if (!custName) {
    alert("Silakan isi Nama Pelanggan / Meja.");
    if (custNameEl) custNameEl.focus();
    return;
  }

  const btnSubmit = document.getElementById("btnSubmitOrder");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Menyimpan Transaksi...";
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1);
  const date = (now.getDate() < 10 ? '0' : '') + now.getDate();
  const invoiceNo = "INV-POS-" + year + month + date + "-" + Math.floor(1000 + Math.random() * 9000);
  const waktuTx = now.toLocaleString('id-ID');

  const paymentEl = document.getElementById("paymentMethodSelect");
  const selectedPayment = paymentEl ? paymentEl.value : "Tunai";

  const noteEl = document.getElementById("orderNote");
  const noteValue = noteEl ? noteEl.value.trim() : "";
  
  const totalBelanja = cart.reduce(function(sum, i) { return sum + ((i.product.harga || 0) * i.qty); }, 0);
  const totalHpp = cart.reduce(function(sum, i) { return sum + ((i.product.hpp || 0) * i.qty); }, 0);
  
  const cashInput = document.getElementById("cashReceivedInput");
  const uangDiterima = selectedPayment === "Tunai" ? (parseInt(cashInput ? cashInput.value : totalBelanja) || totalBelanja) : totalBelanja;
  const kembalian = uangDiterima - totalBelanja;

  let detailText = cart.map(function(i) {
    let nameStr = i.product.nama;
    if (i.subVariant) nameStr += " (" + i.subVariant + ")";
    if (i.note) nameStr += " [Ket: " + i.note + "]";
    return nameStr + " (" + i.qty + "x)";
  }).join(", ");

  if (noteValue) detailText += " | Catatan: " + noteValue;

  const payload = {
    noInvoice: invoiceNo,
    waktu: waktuTx,
    customerName: custName,
    detailItems: detailText,
    totalBelanja: totalBelanja,
    totalHpp: totalHpp,
    jenisPembayaran: selectedPayment,
    uangDiterima: uangDiterima,
    kembalian: kembalian,
    kasir: "Kasir Toko",
    sumber: "POS Kasir",
    status: "SUKSES"
  };

  // Simpan data untuk cetak struk
  lastOrderData = {
    invoiceNo: invoiceNo,
    waktu: waktuTx,
    customerName: custName,
    jenisPembayaran: selectedPayment,
    totalBelanja: totalBelanja,
    uangDiterima: uangDiterima,
    kembalian: kembalian,
    kasir: "Kasir Toko",
    items: JSON.parse(JSON.stringify(cart))
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const doPrint = confirm("✅ Transaksi Berhasil Disimpan!\nNo Invoice: " + invoiceNo + "\nKembalian: Rp" + Math.max(0, kembalian).toLocaleString('id-ID') + "\n\nApakah Anda ingin mencetak struk?");
    if (doPrint) {
      printReceipt(lastOrderData);
    }
    
    // Reset Form & Keranjang
    cart = [];
    updateCartUI();
    filterProducts();
    closeCheckoutModal();
    if (custNameEl) custNameEl.value = "";
    if (noteEl) noteEl.value = "";
    if (cashInput) cashInput.value = "";

  } catch (err) {
    console.error("Gagal menyimpan transaksi:", err);
    alert("Gagal menyimpan transaksi. Silakan coba lagi.");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "💾 SIMPAN & PROSES TRANSAKSI";
    }
  }
}

loadData();
