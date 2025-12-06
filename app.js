// app.js
// Pastikan firebase.js sudah diload (db, auth tersedia)

// =====================================================
// ================  Utility Functions  =================
// =====================================================
const $ = (id) => document.getElementById(id);

const formatRp = (n) => {
  if (!n && n !== 0) return "Rp 0";
  return "Rp " + Number(n).toLocaleString('id-ID');
};

// =====================================================
// ==================== Tab Switching ===================
// =====================================================
document.querySelectorAll('.tab-btn').forEach((b) => {
  b.addEventListener('click', () => {
    const target = b.dataset.target;
    document.querySelectorAll('.tab').forEach((t) => (t.style.display = 'none'));
    document.getElementById(target).style.display = 'block';
  });
});

// =====================================================
// ====================== MEMBERS =======================
// =====================================================
const membersTableBody = $('membersTable').querySelector('tbody');
const memberSelects = [ $('payMember') ];

$('addMemberBtn').addEventListener('click', async () => {
  const name = $('memberName').value.trim();
  const phone = $('memberPhone').value.trim();

  if (!name) return alert('Masukkan nama anggota');

  await db.collection('members').add({
    name,
    phone,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  $('memberName').value = '';
  $('memberPhone').value = '';
});

// Render members
function renderMembers(snapshot) {
  membersTableBody.innerHTML = '';

  // reset dropdown
  memberSelects.forEach((s) => {
    s.innerHTML = '<option value="">Pilih anggota</option>';
  });
  $('useMembers').innerHTML = '';

  snapshot.forEach((doc) => {
    const d = doc.data();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.name}</td>
      <td>${d.phone || '-'}</td>
      <td id="saldo-${doc.id}">-</td>
      <td><button class="del-member" data-id="${doc.id}">Hapus</button></td>
    `;
    membersTableBody.appendChild(tr);

    // multi select usage
    const multi = document.createElement('option');
    multi.value = doc.id;
    multi.textContent = d.name;
    $('useMembers').appendChild(multi);

    // select payment
    memberSelects.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      s.appendChild(opt);
    });
  });
}

// Delete member
membersTableBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('del-member')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus anggota?')) {
      await db.collection('members').doc(id).delete();
    }
  }
});

// Live listener
db.collection('members').orderBy('name').onSnapshot(renderMembers);

// =====================================================
// ======================= STOCKS =======================
// =====================================================
const stocksTableBody = $('stocksTable').querySelector('tbody');

$('addStockBtn').addEventListener('click', async () => {
  const tanggal = $('stockDate').value || new Date().toISOString().slice(0, 10);
  const jenis = $('stockType').value || 'standard';
  const tabung = Number($('stockCans').value) || 0;
  const isiPerTabung = Number($('stockPerCan').value) || 0;
  const hargaPerTabung = Number($('stockPricePerCan').value) || 0;

  if (!tabung || !isiPerTabung || !hargaPerTabung)
    return alert('Isi semua kolom stok dengan angka > 0');

  await db.collection('stocks').add({
    tanggal,
    jenis,
    tabung,
    isiPerTabung,
    hargaPerTabung,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  $('stockType').value = '';
  $('stockCans').value = '';
  $('stockPerCan').value = '';
  $('stockPricePerCan').value = '';
});

function renderStocks(snapshot) {
  stocksTableBody.innerHTML = '';
  let totalCock = 0;

  snapshot.forEach((doc) => {
    const d = doc.data();
    const hargaPerCock =
      d.hargaPerTabung && d.isiPerTabung ? d.hargaPerTabung / d.isiPerTabung : 0;

    totalCock += (d.tabung || 0) * (d.isiPerTabung || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.tanggal || '-'}</td>
      <td>${d.jenis}</td>
      <td>${d.tabung}</td>
      <td>${d.isiPerTabung}</td>
      <td>${formatRp(d.hargaPerTabung)}</td>
      <td>${formatRp(Math.round(hargaPerCock))}</td>
      <td><button class="del-stock" data-id="${doc.id}">Hapus</button></td>
    `;
    stocksTableBody.appendChild(tr);
  });

  $('totalStock').textContent = totalCock;
}

stocksTableBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('del-stock')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus data stok?'))
      await db.collection('stocks').doc(id).delete();
  }
});

db.collection('stocks').orderBy('createdAt', 'desc').onSnapshot(renderStocks);

// =====================================================
// ======================= USAGES =======================
// =====================================================
const usagesTableBody = $('usagesTable').querySelector('tbody');

$('addUsageBtn').addEventListener('click', async () => {
  const tanggal = $('useDate').value || new Date().toISOString().slice(0, 10);
  const cock = Number($('useCocks').value) || 0;
  const playersTotal = Number($('usePlayers').value) || 1;

  const selected = Array.from($('useMembers').selectedOptions).map((o) => o.value);

  if (cock <= 0) return alert('Jumlah cock harus > 0');
  if (selected.length === 0)
    return alert('Pilih minimal satu pemain dari daftar anggota');

  // Harga cock terbaru
  const q = await db.collection('stocks').orderBy('createdAt', 'desc').limit(1).get();
  let hargaPerCock = 0;
  if (!q.empty) {
    const s = q.docs[0].data();
    hargaPerCock = s.hargaPerTabung / s.isiPerTabung;
  }

  const totalBiaya = Math.round(cock * hargaPerCock);
  const biayaPerOrang = Math.round(totalBiaya / playersTotal);

  // Insert per member
  const batch = db.batch();
  selected.forEach((memberId) => {
    const ref = db.collection('usages').doc();
    batch.set(ref, {
      tanggal,
      memberId,
      cock,
      players: playersTotal,
      hargaPerCock,
      totalBiaya,
      biayaPerOrang,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  $('useCocks').value = '';
  $('usePlayers').value = '';
  $('useMembers').selectedIndex = -1;
});

function renderUsages(snapshot) {
  usagesTableBody.innerHTML = '';

  snapshot.forEach((doc) => {
    const d = doc.data();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.tanggal}</td>
      <td data-id="${d.memberId}" class="usage-membername">Loading...</td>
      <td>${d.cock}</td>
      <td>${d.players}</td>
      <td>${formatRp(d.totalBiaya)}</td>
      <td>${formatRp(d.biayaPerOrang)}</td>
      <td><button class="del-usage" data-id="${doc.id}">Hapus</button></td>
    `;
    usagesTableBody.appendChild(tr);
  });

  // replace memberId → name
  db.collection('members').get().then((snap) => {
    const map = {};
    snap.forEach((m) => (map[m.id] = m.data().name));

    document.querySelectorAll('.usage-membername').forEach((td) => {
      const id = td.dataset.id;
      td.textContent = map[id] || '-';
    });
  });
}

usagesTableBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('del-usage')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pemakaian?')) {
      await db.collection('usages').doc(id).delete();
    }
  }
});

db.collection('usages').orderBy('createdAt', 'desc').onSnapshot(renderUsages);

// =====================================================
// ====================== PAYMENTS ======================
// =====================================================
const paymentsTableBody = $('paymentsTable').querySelector('tbody');

$('addPaymentBtn').addEventListener('click', async () => {
  const memberId = $('payMember').value;
  const date = $('payDate').value || new Date().toISOString().slice(0, 10);
  const amount = Number($('payAmount').value) || 0;

  if (!memberId) return alert('Pilih anggota');
  if (!amount || amount <= 0) return alert('Masukkan jumlah pembayaran > 0');

  await db.collection('payments').add({
    memberId,
    date,
    amount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  $('payAmount').value = '';
  $('payMember').value = '';
});

function renderPayments(snapshot) {
  paymentsTableBody.innerHTML = '';

  snapshot.forEach((doc) => {
    const d = doc.data();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.date}</td>
      <td>${d.memberId || '-'}</td>
      <td>${formatRp(d.amount)}</td>
      <td><button class="del-payment" data-id="${doc.id}">Hapus</button></td>
    `;
    paymentsTableBody.appendChild(tr);
  });
}

paymentsTableBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('del-payment')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pembayaran?'))
      await db.collection('payments').doc(id).delete();
  }
});

db.collection('payments').orderBy('createdAt', 'desc').onSnapshot(renderPayments);

// =====================================================
// ====================== BALANCES ======================
// =====================================================
async function computeBalances() {
  // get members
  const membersSnap = await db.collection('members').get();
  const members = {};
  membersSnap.forEach((m) => {
    members[m.id] = { id: m.id, name: m.data().name, pay: 0, use: 0 };
  });

  // sum usages
  const usagesSnap = await db.collection('usages').get();
  usagesSnap.forEach((u) => {
    const d = u.data();
    if (members[d.memberId]) {
      members[d.memberId].use += d.biayaPerOrang || 0;
    }
  });

  // sum payments
  const paymentsSnap = await db.collection('payments').get();
  paymentsSnap.forEach((p) => {
    const d = p.data();
    if (members[d.memberId]) {
      members[d.memberId].pay += d.amount || 0;
    }
  });

  // render
  const tbody = $('balanceTable').querySelector('tbody');
  tbody.innerHTML = '';

  let totalDebt = 0;

  for (const id in members) {
    const m = members[id];
    const saldo = m.pay - m.use;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${formatRp(m.use)}</td>
      <td>${formatRp(m.pay)}</td>
      <td>${formatRp(saldo)}</td>
    `;
    tbody.appendChild(tr);

    // update saldo on member table
    const sdEl = document.getElementById(`saldo-${id}`);
    if (sdEl) sdEl.textContent = formatRp(saldo);

    if (saldo < 0) totalDebt += Math.abs(saldo);
  }

  $('totalDebt').textContent = formatRp(totalDebt);
}

// tombol hitung saldo
$('computeBalanceBtn').addEventListener('click', computeBalances);
