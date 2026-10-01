// Ganti dengan URL API Google Script
const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";

let allData = [];
let uniqueCustomers = []; 

function formatRupiah(angka) {
  return (angka || 0).toLocaleString('id-ID');
}

function parseDateIndo(dateStr) {
  if (!dateStr) return new Date(0);
  let str = String(dateStr).trim();
  let match1 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match1) return new Date(match1[3], match1[2] - 1, match1[1]);
  let match2 = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match2) return new Date(match2[1], match2[2] - 1, match2[3]);
  let parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function formatTampilanTanggal(dateStr) {
  let d = parseDateIndo(dateStr);
  if (d.getTime() === 0) return dateStr; 
  let day = String(d.getDate()).padStart(2, '0');
  let month = String(d.getMonth() + 1).padStart(2, '0');
  let year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function setDefaultDates() {
  const now = new Date();
  
  // Mengambil tahun, bulan, dan tanggal berdasarkan Waktu Lokal Indonesia (Bukan Global)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const today = String(now.getDate()).padStart(2, '0');
  
  // Setel paksa ke tanggal 01 pada bulan yang sedang berjalan
  document.getElementById('startDate').value = `${year}-${month}-01`;
  // Setel ke hari ini
  document.getElementById('endDate').value = `${year}-${month}-${today}`;
}


// FUNGSI BARU: Setel otomatis ke bulan lalu
function setLastMonth() {
  const now = new Date();
  
  // Mengambil tanggal 1 di bulan sebelumnya
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Mengambil tanggal terakhir di bulan sebelumnya (dengan mengeset hari = 0 di bulan ini)
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const startYear = firstDayLastMonth.getFullYear();
  const startMonth = String(firstDayLastMonth.getMonth() + 1).padStart(2, '0');
  const startDay = String(firstDayLastMonth.getDate()).padStart(2, '0');
  
  const endYear = lastDayLastMonth.getFullYear();
  const endMonth = String(lastDayLastMonth.getMonth() + 1).padStart(2, '0');
  const endDay = String(lastDayLastMonth.getDate()).padStart(2, '0');
  
  document.getElementById('startDate').value = `${startYear}-${startMonth}-${startDay}`;
  document.getElementById('endDate').value = `${endYear}-${endMonth}-${endDay}`;
  
  // Langsung terapkan filter agar datanya otomatis berubah
  applyFilter();
}

// FUNGSI BARU: Setel otomatis ke bulan ini TANPA mereset pelanggan
function setThisMonth() {
  setDefaultDates();
  applyFilter();
}


async function loadLaporan() {
  try {
    const res = await fetch(`${API_URL}?action=getLaporan`);
    const json = await res.json();
    
    if (!json.data) alert("Data gagal ditarik! Pastikan Deploy > Versi Baru di Apps Script.");
    
    allData = json.data || [];
    uniqueCustomers = [...new Set(allData.map(item => item.customerName))].filter(Boolean).sort();
    populateCustomerCheckboxes();
    
    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('laporanTable').style.display = 'table';
    
    applyFilter(); 
  } catch (err) {
    console.error("Gagal memuat laporan:", err);
    document.getElementById('loadingMsg').innerText = "Gagal memuat data. Periksa koneksi internet.";
  }
}

function toggleCustomerList() {
  const list = document.getElementById('customerCheckboxes');
  list.style.display = list.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', function(e) {
  const container = document.getElementById('listCustomer');
  if (container && !container.contains(e.target)) {
    const list = document.getElementById('customerCheckboxes');
    if(list) list.style.display = 'none';
  }
});

function populateCustomerCheckboxes() {
  const container = document.getElementById("customerCheckboxes");
  if (!container) return;
  
  let html = `
    <li>
      <input type="checkbox" id="checkAllCust" checked onchange="toggleAllCust(this)"> 
      <label for="checkAllCust" style="font-weight:bold; color:#1b5e20;">✅ Pilih Semua</label>
    </li>
    <hr style="margin:8px 0; border:none; border-top:1px solid #eee;">
  `;
  
  uniqueCustomers.forEach((cust, index) => {
    html += `
      <li>
        <input type="checkbox" class="cust-checkbox" id="cust_${index}" value="${cust}" checked onchange="uncheckAllIfNeeded()">
        <label for="cust_${index}">${cust}</label>
      </li>
    `;
  });
  
  container.innerHTML = html;
  updateCustomerFeedback();
}

function toggleAllCust(source) {
  const checkboxes = document.querySelectorAll('.cust-checkbox');
  checkboxes.forEach(cb => cb.checked = source.checked);
  updateCustomerFeedback();
}

function uncheckAllIfNeeded() {
  const checkAll = document.getElementById('checkAllCust');
  const checkboxes = document.querySelectorAll('.cust-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  if(checkAll) checkAll.checked = allChecked;
  updateCustomerFeedback();
}

// FITUR BARU: Memberikan respon teks ke Ibu saat memilih pelanggan
function updateCustomerFeedback() {
  const anchor = document.querySelector('#listCustomer .anchor');
  const checkAll = document.getElementById('checkAllCust');
  const checkedBoxes = document.querySelectorAll('.cust-checkbox:checked');
  
  if (!anchor) return;

  if (checkAll && checkAll.checked) {
    anchor.innerHTML = "✅ Semua Pelanggan";
    anchor.style.color = "#1b5e20";
  } else if (checkedBoxes.length === 0) {
    anchor.innerHTML = "⚠️ Belum ada dipilih";
    anchor.style.color = "#d32f2f";
  } else if (checkedBoxes.length === 1) {
    anchor.innerHTML = `👤 ${checkedBoxes[0].value}`;
    anchor.style.color = "#1976d2";
  } else {
    anchor.innerHTML = `👥 ${checkedBoxes.length} Pelanggan Dipilih`;
    anchor.style.color = "#1976d2";
  }
}

// FITUR BARU: Menampilkan atau menyembunyikan kolom tabel
function toggleTableColumns() {
  const table = document.getElementById('laporanTable');
  if (!table) return;
  
  table.classList.toggle('hide-invoice', !document.getElementById('chkInvoice').checked);
  table.classList.toggle('hide-customer', !document.getElementById('chkCustomer').checked);
  table.classList.toggle('hide-detail', !document.getElementById('chkDetail').checked);
  table.classList.toggle('hide-pembayaran', !document.getElementById('chkPembayaran').checked);
}

function applyFilter() {
  const startInput = document.getElementById('startDate').value;
  const endInput = document.getElementById('endDate').value;
  
  let start = new Date(startInput);
  start.setHours(0, 0, 0, 0);
  
  let end = new Date(endInput);
  end.setHours(23, 59, 59, 999);

  const checkedBoxes = document.querySelectorAll('.cust-checkbox:checked');
  const selectedCustomers = Array.from(checkedBoxes).map(cb => cb.value);
  const isAllChecked = document.getElementById('checkAllCust') && document.getElementById('checkAllCust').checked;

  const filteredData = allData.filter(row => {
    let rowDate = parseDateIndo(row.waktu);
    let matchDate = (rowDate >= start && rowDate <= end);
    let matchCustomer = isAllChecked || selectedCustomers.includes(row.customerName);
    return matchDate && matchCustomer;
  });

  renderTableAndSummary(filteredData);
}

function resetFilter() {
  setDefaultDates();
  const checkAll = document.getElementById('checkAllCust');
  if (checkAll) {
    checkAll.checked = true;
    toggleAllCust(checkAll);
  }
  applyFilter();
}

function renderTableAndSummary(data) {
  let sumOmset = 0;
  let sumHpp = 0;

  const tbody = document.getElementById('laporanBody');
  tbody.innerHTML = data.map(row => {
    sumOmset += row.totalBelanja;
    sumHpp += row.totalHpp;

    return `
      <tr>
        <td style="white-space: nowrap; font-weight:bold; color:#1b5e20;">
          ${formatTampilanTanggal(row.waktu)}
        </td>
        <td class="col-invoice"><strong>${row.noInvoice}</strong></td>
        <td class="col-customer">${row.customerName}</td>
        <td class="col-detail" style="font-size:11px; max-width:200px;">${row.detailItems}</td>
        <td class="col-pembayaran">${row.jenisPembayaran}<br><small style="color:#666;">(${row.sumber})</small></td>
        <td style="font-weight:bold; color:#1b5e20;">Rp${formatRupiah(row.totalBelanja)}</td>
      </tr>
    `;
  }).join('');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Tidak ada transaksi yang sesuai.</td></tr>`;
  }

  const labaBersih = sumOmset - sumHpp;

  document.getElementById('sumTrx').innerText = data.length;
  document.getElementById('sumOmset').innerText = `Rp${formatRupiah(sumOmset)}`;
  document.getElementById('sumHpp').innerText = `Rp${formatRupiah(sumHpp)}`;
  document.getElementById('sumLaba').innerText = `Rp${formatRupiah(labaBersih)}`;
  
  // Pastikan kolom tetap tersembunyi/tampil sesuai setelan HP Ibu
  toggleTableColumns(); 
}

setDefaultDates();
loadLaporan();
