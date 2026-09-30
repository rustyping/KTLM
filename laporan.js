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
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
  document.getElementById('endDate').value = now.toISOString().split('T')[0];
}

async function loadLaporan() {
  try {
    const res = await fetch(`${API_URL}?action=getLaporan`);
    const json = await res.json();
    
    if (!json.data) {
       alert("Data gagal ditarik! Pastikan Anda sudah melakukan 'Deploy > Versi Baru' di Google Apps Script.");
    }
    
    allData = json.data || [];
    
    // Tarik nama pelanggan unik
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

// FITUR BARU: Membuka/Menutup Dropdown Checkbox
function toggleCustomerList() {
  const list = document.getElementById('customerCheckboxes');
  list.style.display = list.style.display === 'block' ? 'none' : 'block';
}

// Menutup dropdown jika user klik di luar kotak
document.addEventListener('click', function(e) {
  const container = document.getElementById('listCustomer');
  if (container && !container.contains(e.target)) {
    document.getElementById('customerCheckboxes').style.display = 'none';
  }
});

// FITUR BARU: Membuat Checkbox Pelanggan
function populateCustomerCheckboxes() {
  const container = document.getElementById("customerCheckboxes");
  if (!container) return;
  
  // Tombol Centang Semua
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
}

// Logika Centang Semua
function toggleAllCust(source) {
  const checkboxes = document.querySelectorAll('.cust-checkbox');
  checkboxes.forEach(cb => cb.checked = source.checked);
}

// Jika salah satu dicentang/dihapus, atur status "Pilih Semua"
function uncheckAllIfNeeded() {
  const checkAll = document.getElementById('checkAllCust');
  const checkboxes = document.querySelectorAll('.cust-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkAll.checked = allChecked;
}

// MESIN PENYARING
function applyFilter() {
  const startInput = document.getElementById('startDate').value;
  const endInput = document.getElementById('endDate').value;
  
  let start = new Date(startInput);
  start.setHours(0, 0, 0, 0);
  
  let end = new Date(endInput);
  end.setHours(23, 59, 59, 999);

  // Ambil nama pelanggan yang dicentang
  const checkedBoxes = document.querySelectorAll('.cust-checkbox:checked');
  const selectedCustomers = Array.from(checkedBoxes).map(cb => cb.value);
  const isAllChecked = document.getElementById('checkAllCust') && document.getElementById('checkAllCust').checked;

  const filteredData = allData.filter(row => {
    let rowDate = parseDateIndo(row.waktu);
    let matchDate = (rowDate >= start && rowDate <= end);
    
    // Cocokkan jika Pilih Semua dicentang, ATAU namanya ada dalam daftar centang
    let matchCustomer = isAllChecked || selectedCustomers.includes(row.customerName);
    
    return matchDate && matchCustomer;
  });

  renderTableAndSummary(filteredData);
}

function resetFilter() {
  setDefaultDates();
  
  // Centang kembali semuanya saat reset
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
        <td><strong>${row.noInvoice}</strong></td>
        <td>${row.customerName}</td>
        <td style="font-size:11px; max-width:250px;">${row.detailItems}</td>
        <td>${row.jenisPembayaran}<br><small style="color:#666;">(${row.sumber})</small></td>
        <td style="font-weight:bold; color:#1b5e20;">Rp${formatRupiah(row.totalBelanja)}</td>
      </tr>
    `;
  }).join('');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Tidak ada transaksi yang sesuai kriteria.</td></tr>`;
  }

  const labaBersih = sumOmset - sumHpp;

  document.getElementById('sumTrx').innerText = data.length;
  document.getElementById('sumOmset').innerText = `Rp${formatRupiah(sumOmset)}`;
  document.getElementById('sumHpp').innerText = `Rp${formatRupiah(sumHpp)}`;
  document.getElementById('sumLaba').innerText = `Rp${formatRupiah(labaBersih)}`;
}

setDefaultDates();
loadLaporan();
