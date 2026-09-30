// Ganti dengan URL API Google Script milik Mas Hendra
const API_URL = "https://script.google.com/macros/s/AKfycbzw8qMzc73BfdUP1sQaM8XUYMwTUVCjXWL1ZuhjVUE1w4U9H3unuH3dWqTZZkzCGmDbvA/exec";

let allData = [];

function formatRupiah(angka) {
  return (angka || 0).toLocaleString('id-ID');
}

// Mengubah format string tanggal "31/08/2026, 12.43.28" menjadi format Objek Date JavaScript
// Mengubah format string tanggal apa pun menjadi format Objek Date yang akurat
function parseDateIndo(dateStr) {
  if (!dateStr) return new Date(0);
  let str = String(dateStr).trim();
  
  // Mencari pola DD/MM/YYYY (contoh: 31/08/2026 atau 31/8/2026)
  let match1 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match1) {
    return new Date(match1[3], match1[2] - 1, match1[1]); // Format: Tahun, Bulan-1, Tanggal
  }
  
  // Mencari pola YYYY-MM-DD (Format bawaan Google/Database)
  let match2 = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match2) {
     return new Date(match2[1], match2[2] - 1, match2[3]);
  }

  // Jika bentuknya unik, biarkan sistem yang menebak
  let parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

// Setel input filter tanggal otomatis ke awal bulan dan hari ini
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
    allData = json.data || [];
    
    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('laporanTable').style.display = 'table';
    
    applyFilter(); // Langsung saring data berdasarkan bulan ini
  } catch (err) {
    console.error("Gagal memuat laporan:", err);
    document.getElementById('loadingMsg').innerText = "Gagal memuat data. Periksa koneksi internet.";
  }
}

function applyFilter() {
  const startInput = document.getElementById('startDate').value;
  const endInput = document.getElementById('endDate').value;
  
  let start = new Date(startInput);
  start.setHours(0, 0, 0, 0);
  
  let end = new Date(endInput);
  end.setHours(23, 59, 59, 999);

  // Saring data
  const filteredData = allData.filter(row => {
    let rowDate = parseDateIndo(row.waktu);
    return rowDate >= start && rowDate <= end;
  });

  renderTableAndSummary(filteredData);
}

function resetFilter() {
  setDefaultDates();
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
        <td style="white-space: nowrap;">${row.waktu}</td>
        <td><strong>${row.noInvoice}</strong></td>
        <td>${row.customerName}</td>
        <td style="font-size:11px; max-width:250px;">${row.detailItems}</td>
        <td>${row.jenisPembayaran}<br><small style="color:#666;">(${row.sumber})</small></td>
        <td style="font-weight:bold; color:#1b5e20;">Rp${formatRupiah(row.totalBelanja)}</td>
      </tr>
    `;
  }).join('');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Tidak ada transaksi pada tanggal tersebut.</td></tr>`;
  }

  // Hitung Keuntungan
  const labaBersih = sumOmset - sumHpp;

  document.getElementById('sumTrx').innerText = data.length;
  document.getElementById('sumOmset').innerText = `Rp${formatRupiah(sumOmset)}`;
  document.getElementById('sumHpp').innerText = `Rp${formatRupiah(sumHpp)}`;
  document.getElementById('sumLaba').innerText = `Rp${formatRupiah(labaBersih)}`;
}

// Inisialisasi
setDefaultDates();
loadLaporan();
