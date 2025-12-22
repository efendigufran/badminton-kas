// app.js
// Pastikan firebase.js sudah diload (db, auth tersedia)

// ---------- Utility ----------
const $ = (id) => document.getElementById(id);
const formatRp = (n) => {
  if (!n && n !== 0) return "Rp 0";
  return "Rp " + Number(n).toLocaleString('id-ID');
};

// ---------- Tab switching ----------
document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click', ()=> {
    const target = b.dataset.target;
    document.querySelectorAll('.tab').forEach(t=>t.style.display='none');
    document.getElementById(target).style.display = 'block';
  });
});

// ---------- MEMBERS ----------
const membersTableBody = $('membersTable').querySelector('tbody');
const memberSelects = [ $('payMember') ];  // useMembers terisi berbeda

$('addMemberBtn').addEventListener('click', async ()=>{
  const name = $('memberName').value.trim();
  const phone = $('memberPhone').value.trim();
  if (!name) return alert('Masukkan nama anggota');

  await db.collection('members').add({
    name,
    phone,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('memberName').value='';
  $('memberPhone').value='';
});

// tampilkan list member + populate select
function renderMembers(snapshot) {
  membersTableBody.innerHTML = '';

  // reset select pembayaran
  memberSelects.forEach(s=>{
    s.innerHTML = '<option value="">Pilih anggota</option>';
  });

  // reset multi-select
  $('useMembers').innerHTML = '';

  snapshot.forEach(doc=>{
    const d = doc.data();

    // render table
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.name}</td>
      <td>${d.phone || '-'}</td>
      <td id="saldo-${doc.id}">-</td>
      <td><button class="del-member" data-id="${doc.id}">Hapus</button></td>
    `;
    membersTableBody.appendChild(tr);

    // add to multi-select (usages)
    const multi = document.createElement('option');
    multi.value = doc.id;
    multi.textContent = d.name;
    $('useMembers').appendChild(multi);

    // add ke select pembayaran
    memberSelects.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      s.appendChild(opt);
    });
  });
}

membersTableBody.addEventListener('click', async e=>{
  if (e.target.classList.contains('del-member')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus anggota?')) {
      await db.collection('members').doc(id).delete();
    }
  }
});

// subscribe
db.collection('members').orderBy('name').onSnapshot(renderMembers);


// ---------- STOCKS ----------
const stocksTableBody = $('stocksTable').querySelector('tbody');

function resetStockForm() {
  $('editingStockId').value = '';
  $('stockDate').value = '';
  $('stockType').value = '';
  $('stockCans').value = '';
  $('stockPerCan').value = '';
  $('stockPricePerCan').value = '';
  $('addStockBtn').textContent = 'Tambah Stok';
}

$('addStockBtn').addEventListener('click', async ()=> {
  const id = $('editingStockId').value;

  const tanggal = $('stockDate').value || new Date().toISOString().slice(0,10);
  const jenis = $('stockType').value || 'standard';
  const tabung = Number($('stockCans').value) || 0;
  const isiPerTabung = Number($('stockPerCan').value) || 0;
  const hargaPerTabung = Number($('stockPricePerCan').value) || 0;

  if (!tabung || !isiPerTabung || !hargaPerTabung) {
    return alert('Isi semua kolom stok dengan angka > 0');
  }

  const payload = {
    tanggal,
    jenis,
    tabung,
    isiPerTabung,
    hargaPerTabung,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (id && typeof id === 'string') {
    // 🔄 UPDATE
    console.log('UPDATE ID:', id);
    await db.collection('stocks').doc(id).update(payload);
  } else {
    // ➕ ADD
    await db.collection('stocks').add({
      ...payload,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  resetStockForm();
});

let totalStockAwal = 0;
let totalCockTerpakai = 0;

function renderUsages(snapshot) {
  usagesTableBody.innerHTML = '';
  totalCockTerpakai = 0;

  snapshot.forEach(doc=>{
    const d = doc.data();

    totalCockTerpakai += d.cock || 0;

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

  updateStockSummary();

  // mapping member name (tetap)
  db.collection('members').get().then(snap=>{
    const map = {};
    snap.forEach(m => map[m.id] = m.data().name);
    document.querySelectorAll('.usage-membername').forEach(td=>{
      td.textContent = map[td.dataset.id] || '-';
    });
  });
}

function updateStockSummary() {
  const stockSisa = totalStockAwal - totalCockTerpakai;

  $('totalStockAwal').textContent = totalStockAwal;
  $('totalStockTerpakai').textContent = totalCockTerpakai;
  $('totalStockSisa').textContent = stockSisa;

  // opsional: warning jika stok menipis
  if (stockSisa < 20) {
    $('totalStockSisa').style.color = 'red';
  } else {
    $('totalStockSisa').style.color = '';
  }
}



stocksTableBody.addEventListener('click', async (e)=> {
  const id = e.target.dataset.id;

  // 📝 EDIT
  if (e.target.classList.contains('edit-stock')) {
    const doc = await db.collection('stocks').doc(id).get();
    if (!doc.exists) return;

    const d = doc.data();
    $('editingStockId').value = id;
    $('stockDate').value = d.tanggal;
    $('stockType').value = d.jenis;
    $('stockCans').value = d.tabung;
    $('stockPerCan').value = d.isiPerTabung;
    $('stockPricePerCan').value = d.hargaPerTabung;
    $('addStockBtn').textContent = 'Update Stok';
  }

  // 🗑 DELETE
  if (e.target.classList.contains('del-stock')) {
    if (confirm('Hapus data stok?')) {
      await db.collection('stocks').doc(id).delete();
    
      // reset hanya jika yang dihapus sedang diedit
      if ($('editingStockId').value === id) {
        resetStockForm();
      }
    }
  }
});


// listen stocks ordered newest-first
db.collection('stocks').orderBy('createdAt','desc').onSnapshot(renderStocks);

// ---------- USAGES ----------
const usagesTableBody = $('usagesTable').querySelector('tbody');

$('addUsageBtn').addEventListener('click', async ()=>{
  const tanggal = $('useDate').value || new Date().toISOString().slice(0,10);
  const cock = Number($('useCocks').value) || 0;
  const playersTotal = Number($('usePlayers').value) || 1;

  // ambil multiple selected members
  const selected = Array.from($('useMembers').selectedOptions).map(o => o.value);

  if (cock <= 0) return alert("Jumlah cock harus > 0");
  if (selected.length === 0)
    return alert("Pilih minimal satu pemain dari daftar anggota");

  // ambil harga per cock terbaru
  const q = await db.collection('stocks').orderBy('createdAt','desc').limit(1).get();
  let hargaPerCock = 0;
  if (!q.empty) {
    const s = q.docs[0].data();
    hargaPerCock = s.hargaPerTabung / s.isiPerTabung;
  }

  const totalBiaya = Math.round(cock * hargaPerCock);
  const biayaPerOrang = Math.round(totalBiaya / playersTotal);

  // insert record per anggota
  const batch = db.batch();
  selected.forEach(memberId=>{
    const ref = db.collection('usages').doc();
    batch.set(ref, {
      tanggal,
      memberId,
      cock,
      players: playersTotal,
      hargaPerCock,
      totalBiaya,
      biayaPerOrang,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();

  $('useCocks').value='';
  $('usePlayers').value='';
  $('useMembers').selectedIndex = -1;
});

function renderUsages(snapshot) {
  usagesTableBody.innerHTML = '';

  snapshot.forEach(doc=>{
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

  // replace memberId → memberName
  db.collection('members').get().then(snap=>{
    const map = {};
    snap.forEach(m => map[m.id] = m.data().name);

    document.querySelectorAll('.usage-membername').forEach(td=>{
      const id = td.dataset.id;
      td.textContent = map[id] || '-';
    });
  });
}

usagesTableBody.addEventListener('click', async e=>{
  if (e.target.classList.contains('del-usage')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pemakaian?')) {
      await db.collection('usages').doc(id).delete();
    }
  }
});

db.collection('usages').orderBy('createdAt','desc').onSnapshot(renderUsages);


// ---------- PAYMENTS ----------
const paymentsTableBody = $('paymentsTable').querySelector('tbody');

$('addPaymentBtn').addEventListener('click', async ()=>{
  const memberId = $('payMember').value;
  const date = $('payDate').value || new Date().toISOString().slice(0,10);
  const amount = Number($('payAmount').value) || 0;
  if (!memberId) return alert('Pilih anggota');
  if (!amount || amount <= 0) return alert('Masukkan jumlah pembayaran > 0');
  await db.collection('payments').add({
    memberId, date, amount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  $('payAmount').value=''; $('payMember').value='';
});

function renderPayments(snapshot) {
  paymentsTableBody.innerHTML = '';
  snapshot.forEach(doc=>{
    const d = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.date}</td><td>${d.memberId || '-'}</td><td>${formatRp(d.amount)}</td>
      <td><button class="del-payment" data-id="${doc.id}">Hapus</button></td>`;
    paymentsTableBody.appendChild(tr);
  });
}

paymentsTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-payment')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pembayaran?')) await db.collection('payments').doc(id).delete();
  }
});

db.collection('payments').orderBy('createdAt','desc').onSnapshot(renderPayments);

// ---------- BALANCE / AGGREGATE ----------
async function computeBalances() {
  // get members
  const membersSnap = await db.collection('members').get();
  const members = {};
  membersSnap.forEach(m=> members[m.id] = { id: m.id, name: m.data().name, pay:0, use:0 });

  // sum usages per member
  const usagesSnap = await db.collection('usages').get();
  usagesSnap.forEach(u=>{
    const data = u.data();
    const id = data.memberId;
    if (id && members[id]) members[id].use += (data.biayaPerOrang  || 0);
  });

  // sum payments per member
  const paymentsSnap = await db.collection('payments').get();
  paymentsSnap.forEach(p=>{
    const data = p.data();
    const id = data.memberId;
    if (id && members[id]) members[id].pay += (data.amount || 0);
  });

  // render table
  const tbody = $('balanceTable').querySelector('tbody');
  tbody.innerHTML = '';
  
  let rows = [];
  
  // ubah members object → array berisi {id, name, use, pay, saldo, absSaldo}
  for (const id in members) {
    const m = members[id];
    const saldo = m.pay - m.use;
    rows.push({
      id,
      name: m.name,
      use: m.use,
      pay: m.pay,
      // pay: Number(m.pay) || 0,
      // use: Number(m.use) || 0,
      saldo,
      absSaldo: Math.abs(saldo)
    });
  }
  
  // SORT DESC ABSOLUTE SALDO
  rows.sort((a, b) => {
    // urutan 1: absSaldo DESC
    if (b.absSaldo !== a.absSaldo) return b.absSaldo - a.absSaldo;
  
    // urutan 2: pay DESC
    return b.pay - a.pay;
  });
  
  let totalDebt = 0;
  let totalCredit = 0;     // ← TAMBAHAN
  let totalMembers = rows.length;
  
  // render hasil urutan
rows.forEach(r => {
  const tr = document.createElement('tr');

  // tentukan style saldo
  let saldoClass = '';
  if (r.saldo < 0) {
    saldoClass = 'saldo-minus';      // merah
  } else if (r.saldo > 0) {
    saldoClass = 'saldo-plus';       // putih + hijau
  }

  tr.innerHTML = `
    <td>${r.name}</td>
    <td>${formatRp(r.use)}</td>
    <td>${formatRp(r.pay)}</td>
    <td class="${saldoClass}">${formatRp(r.saldo)}</td>
  `;

  tbody.appendChild(tr);

  if (r.saldo < 0) totalDebt += Math.abs(r.saldo);

  // hitung total credit
  totalCredit += r.pay;     // ← TAMBAHKAN INI
  
  // update saldo pada elemen lain bila ada
  const sdEl = document.getElementById(`saldo-${r.id}`);
  if (sdEl) sdEl.textContent = formatRp(r.saldo);
});

  $('totalDebt').textContent = formatRp(totalDebt);
  $('totalMembers').textContent = totalMembers;
  $('totalCredit').textContent = formatRp(totalCredit);   // ← TAMBAHKAN INI
}

// recompute balances whenever changes happen (simple approach: on any collection change)
db.collection('members').onSnapshot(computeBalances);
db.collection('usages').onSnapshot(computeBalances);
db.collection('payments').onSnapshot(computeBalances);

// also compute on load
computeBalances();

// ---------- small helper: replace memberId with name in usages & payments tables
// For better UX: fetch members map and patch tables (naive approach)
async function attachNamesToTables() {
  const membersSnap = await db.collection('members').get();
  const map = {};
  membersSnap.forEach(m=> map[m.id] = m.data().name);

  // replace memberId cell texts in usages table
  document.querySelectorAll('#usagesTable tbody tr').forEach(tr=>{
    const cell = tr.children[1]; // member cell
    if (cell && map[cell.textContent]) cell.textContent = map[cell.textContent];
  });
  document.querySelectorAll('#paymentsTable tbody tr').forEach(tr=>{
    const cell = tr.children[1];
    if (cell && map[cell.textContent]) cell.textContent = map[cell.textContent];
  });
}

// call attach periodically (simple)
setInterval(attachNamesToTables, 2000);
