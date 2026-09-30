const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";

let allData = [];

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
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const today = String(now.getDate()).padStart(2, '0');
  
  document.getElementById('startDate').value = `${year}-${month}-01`;
  document.getElementById('endDate').value = `${year}-${month}-${today}`;
}

function setLastMonth() {
  const now = new Date();
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const startYear = firstDayLastMonth.getFullYear();
  const startMonth = String(firstDayLastMonth.getMonth() + 1).padStart(2, '0');
  const startDay = String(firstDayLastMonth.getDate()).padStart(2, '0');
  
  const endYear = lastDayLastMonth.getFullYear();
  const endMonth = String(lastDayLastMonth.getMonth() + 1).padStart(2, '0');
  const endDay = String(lastDayLastMonth.getDate()).padStart(2, '0');
  
  document.getElementById('startDate').value = `${startYear}-${startMonth}-${startDay}`;
  document.getElementById('endDate').value = `${endYear}-${endMonth}-${endDay}`;
  
  applyFilter();
}

async function loadLaporan() {
  try {
    const res = await fetch(`${API_URL}?action=getLaporan`);
    const json = await res.json();
    
    if (!json.data) {
       alert("Data gagal ditarik! Pastikan sudah melakukan 'Deploy > Versi Baru' di Google Apps Script.");
    }
    
    allData = json.data || [];
    
    // Mengisi pilihan kotak filter pelanggan secara otomatis berdasarkan data yang ada
    populateCustomerDropdown();

    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('laporanTable').style.display = 'table';
    
    applyFilter(); 
  } catch (err) {
    console.error("Gagal memuat laporan:", err);
    document.getElementById('loadingMsg').innerText = "Gagal memuat data. Periksa koneksi internet.";
  }
}

function populateCustomerDropdown() {
  const select = document.getElementById('customerFilter');
  // Ambil daftar nama unik dari seluruh data transaksi
  const customers = [...new Set(allData.map(item => item.customerName).filter(Boolean))].sort();
  
  let optionsHtml = '<option value="ALL">Semua Pelanggan</option>';
  customers.forEach(name => {
    optionsHtml += `<option value="${name}">${name}</option>`;
  });
  select.innerHTML = optionsHtml;
}

function applyFilter() {
  const startInput = document.getElementById('startDate').value;
  const endInput = document.getElementById('endDate').value;
  const selectedCustomer = document.getElementById('customerFilter').value;
  
  let start = new Date(startInput);
  start.setHours(0, 0, 0, 0);
  
  let end = new Date(endInput);
  end.setHours(23, 59, 59, 999);

  const filteredData = allData.filter(row => {
    let rowDate = parseDateIndo(row.waktu);
    let passDate = (rowDate >= start && rowDate <= end);
    let passCustomer = (selectedCustomer === "ALL" || row.customerName === selectedCustomer);
    
    return passDate && passCustomer;
  });

  renderTableAndSummary(filteredData);
}

function resetFilter() {
  setDefaultDates();
  document.getElementById('customerFilter').value = "ALL";
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Tidak ada transaksi pada kriteria tersebut.</td></tr>`;
  }

  const labaBersih = sumOmset - sumHpp;

  document.getElementById('sumTrx').innerText = data.length;
  document.getElementById('sumOmset').innerText = `Rp${formatRupiah(sumOmset)}`;
  document.getElementById('sumHpp').innerText = `Rp${formatRupiah(sumHpp)}`;
  document.getElementById('sumLaba').innerText = `Rp${formatRupiah(labaBersih)}`;
}

setDefaultDates();
loadLaporan();
