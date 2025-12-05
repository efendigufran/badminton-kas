// app.js - Versi RAPIH + Multi-Select Player Input + Komentar Lengkap
// Backend menggunakan Firebase Firestore
// Catatan: firebaseConfig berada di firebase.js dan sudah di-import di HTML

// --- Inisialisasi Firestore ---
const db = firebase.firestore();

// =============================================================
// 1. FUNGSI MEMUAT ANGGOTA (untuk multi-select pemain)
// =============================================================
async function loadMembers() {
  const memberSelect = document.getElementById('playerSelect'); // multi select
  memberSelect.innerHTML = '';

  const snap = await db.collection('members').orderBy('name').get();
  snap.forEach(doc => {
    const m = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = m.name;
    memberSelect.appendChild(opt);
  });
}

// =============================================================
// 2. FUNGSI MENYIMPAN PEMAKAIAN SHUTTLECOCK (dengan multi-select pemain)
// =============================================================
async function addUsage() {
  const date = document.getElementById('usageDate').value;
  const cockUsed = parseInt(document.getElementById('cockUsed').value);
  const pricePerCock = parseInt(document.getElementById('pricePerCock').value);
  const players = Array.from(document.getElementById('playerSelect').selectedOptions)
    .map(o => o.value);

  if (!date || !cockUsed || !pricePerCock || players.length === 0) {
    alert('Lengkapi semua field + pilih pemain.');
    return;
  }

  const totalBiaya = cockUsed * pricePerCock;
  const biayaPerOrang = totalBiaya / players.length;

  // Simpan record per pemain (1 pemain = 1 dokumen)
  const batch = db.batch();
  players.forEach(memberId => {
    const ref = db.collection('usages').doc();
    batch.set(ref, {
      date,
      memberId,
      cockUsed,
      pricePerCock,
      totalBiaya,
      biayaPerOrang,
      players,
      createdAt: new Date()
    });
  });

  await batch.commit();
  alert('Pemakaian shuttlecock berhasil dicatat untuk semua pemain.');
  loadUsages();
  computeBalances();
}

// =============================================================
// 3. MENAMPILKAN RIWAYAT PEMAKAIAN
// =============================================================
async function loadUsages() {
  const table = document.getElementById('usageTable');
  table.innerHTML = '';

  const snap = await db.collection('usages').orderBy('date', 'desc').get();

  snap.forEach(doc => {
    const u = doc.data();

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${u.date}</td>
      <td>${u.players.map(x => `<span class="tag">${x}</span>`).join(' ')}</td>
      <td>${u.cockUsed}</td>
      <td>${u.pricePerCock}</td>
      <td>${u.totalBiaya}</td>
      <td>${u.biayaPerOrang}</td>
    `;
    table.appendChild(row);
  });
}

// =============================================================
// 4. MENYIMPAN PEMBAYARAN ANGGOTA
// =============================================================
async function addPayment() {
  const date = document.getElementById('payDate').value;
  const memberId = document.getElementById('payMember').value;
  const amount = parseInt(document.getElementById('payAmount').value);

  if (!date || !memberId || !amount) {
    alert('Lengkapi pembayaran.');
    return;
  }

  await db.collection('payments').add({
    date,
    memberId,
    amount,
    createdAt: new Date()
  });

  alert('Pembayaran berhasil disimpan.');
  computeBalances();
  loadPayments();
}

// =============================================================
// 5. MENAMPILKAN RIWAYAT PEMBAYARAN
// =============================================================
async function loadPayments() {
  const table = document.getElementById('paymentTable');
  table.innerHTML = '';

  const snap = await db.collection('payments').orderBy('date', 'desc').get();

  snap.forEach(doc => {
    const p = doc.data();

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.date}</td>
      <td>${p.memberId}</td>
      <td>${p.amount}</td>
    `;
    table.appendChild(row);
  });
}

// =============================================================
// 6. HITUNG SALDO PER ANGGOTA (Pemakaian - Pembayaran)
// =============================================================
async function computeBalances() {
  const table = document.getElementById('balanceTable');
  table.innerHTML = '';

  // Muat semua anggota
  const members = {};
  const membersSnap = await db.collection('members').get();
  membersSnap.forEach(m => {
    members[m.id] = { name: m.data().name, use: 0, pay: 0 };
  });

  // Hitung total biaya per anggota dari usages
  const usagesSnap = await db.collection('usages').get();
  usagesSnap.forEach(u => {
    const d = u.data();
    const id = d.memberId;
    if (members[id]) members[id].use += (d.biayaPerOrang || 0);
  });

  // Hitung total pembayaran
  const paySnap = await db.collection('payments').get();
  paySnap.forEach(p => {
    const d = p.data();
    const id = d.memberId;
    if (members[id]) members[id].pay += (d.amount || 0);
  });

  // Tampilkan
  Object.keys(members).forEach(id => {
    const m = members[id];
    const saldo = m.pay - m.use;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${m.name}</td>
      <td>${m.use.toFixed(0)}</td>
      <td>${m.pay.toFixed(0)}</td>
      <td class="${saldo < 0 ? 'minus' : 'plus'}">${saldo.toFixed(0)}</td>
    `;
    table.appendChild(row);
  });
}

// =============================================================
// 7. AUTO LOAD KETIKA PAGE BUKA
// =============================================================
window.onload = () => {
  loadMembers();
  loadUsages();
  loadPayments();
  computeBalances();
};
