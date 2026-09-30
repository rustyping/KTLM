// Ganti dengan URL API Google Script milik Mas Hendra
const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";

let allData = [];
let uniqueCustomers = []; 

function formatRupiah(angka) {
  return (angka || 0).toLocaleString('id-ID');
}

// Mesin Pintar Pembaca Segala Format Tanggal
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

// MEMAKSA TAMPILAN TANGGAL MENJADI DD/MM/YYYY
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
    
    // FITUR BARU: Mengumpulkan nama-nama pelanggan secara otomatis dari transaksi
    uniqueCustomers = [...new Set(allData.map(item => item.customerName))].filter(Boolean).sort();
    populateCustomerDropdown();
    
    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('laporanTable').style.display = 'table';
    
    applyFilter(); 
  } catch (err) {
    console.error("Gagal memuat laporan:", err);
    document.getElementById('loadingMsg').innerText = "Gagal memuat data. Periksa koneksi internet.";
  }
}

// FITUR BARU: Memasukkan daftar nama ke dalam kotak pilihan
function populateCustomerDropdown() {
  const select = document.getElementById("customerFilter");
  if (!select) return;
  
  let optionsHtml = `<option value="ALL">✅ Semua Pelanggan</option>`;
  uniqueCustomers.forEach(cust => {
    optionsHtml += `<option value="${cust}">${cust}</option>`;
  });
  
  select.innerHTML = optionsHtml;
}

// MESIN PENYARING (Berdasarkan Tanggal & Pelanggan)
function applyFilter() {
  const startInput = document.getElementById('startDate').value;
  const endInput = document.getElementById('endDate').value;
  const customerInput = document.getElementById('customerFilter') ? document.getElementById('customerFilter').value : "ALL";
  
  let start = new Date(startInput);
  start.setHours(0, 0, 0, 0);
  
  let end = new Date(endInput);
  end.setHours(23, 59, 59, 999);

  const filteredData = allData.filter(row => {
    let rowDate = parseDateIndo(row.waktu);
    let matchDate = (rowDate >= start && rowDate <= end);
    let matchCustomer = (customerInput === "ALL" || row.customerName === customerInput);
    
    return matchDate && matchCustomer;
  });

  renderTableAndSummary(filteredData);
}

function resetFilter() {
  setDefaultDates();
  const select = document.getElementById("customerFilter");
  if (select) select.value = "ALL";
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Tidak ada transaksi yang sesuai.</td></tr>`;
  }

  const labaBersih = sumOmset - sumHpp;

  document.getElementById('sumTrx').innerText = data.length;
  document.getElementById('sumOmset').innerText = `Rp${formatRupiah(sumOmset)}`;
  document.getElementById('sumHpp').innerText = `Rp${formatRupiah(sumHpp)}`;
  document.getElementById('sumLaba').innerText = `Rp${formatRupiah(labaBersih)}`;
}

setDefaultDates();
loadLaporan();
