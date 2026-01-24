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
let totalStockAwal = 0;
let totalCockTerpakai = 0;

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


function renderStocks(snapshot) {
  stocksTableBody.innerHTML = '';
  totalStockAwal = 0;

  snapshot.forEach(doc => {
    const d = doc.data();

    totalStockAwal += (d.tabung || 0) * (d.isiPerTabung || 0);

    const hargaPerCock = d.hargaPerTabung && d.isiPerTabung
      ? d.hargaPerTabung / d.isiPerTabung
      : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.tanggal || '-'}</td>
      <td>${d.jenis}</td>
      <td>${d.tabung}</td>
      <td>${d.isiPerTabung}</td>
      <td>${formatRp(d.hargaPerTabung)}</td>
      <td>${formatRp(Math.round(hargaPerCock))}</td>
      <td>
        <button class="edit-stock" data-id="${doc.id}">Edit</button>
        <button class="del-stock" data-id="${doc.id}">Hapus</button>
      </td>
    `;
    stocksTableBody.appendChild(tr);
  });

  updateStockSummary();
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

// Populate Dropdown Jenis Shuttlecock
const stockSelect = $('useStock');

function populateStockSelect(snapshot) {
  stockSelect.innerHTML = '<option value="">Pilih jenis shuttlecock</option>';

  snapshot.forEach(doc => {
    const d = doc.data();
    const hargaPerCock = d.hargaPerTabung / d.isiPerTabung;

    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = `${d.jenis} - ${formatRp(Math.round(hargaPerCock))}/cock`;
    opt.dataset.harga = hargaPerCock;
    opt.dataset.jenis = d.jenis;

    stockSelect.appendChild(opt);
  });
}


// listen stocks ordered newest-first
// db.collection('stocks').orderBy('createdAt','desc').onSnapshot(renderStocks);
db.collection('stocks')
  .orderBy('createdAt', 'desc')
  .onSnapshot(snap => {
    renderStocks(snap);
    populateStockSelect(snap);
  });


// ---------- USAGES ----------
// ---------- USAGES ----------
const usagesTableBody = $('usagesTable').querySelector('tbody');
let totalCockTerpakai = 0;

// ================= ADD USAGE =================
$('addUsageBtn').addEventListener('click', async () => {
  const tanggal = $('useDate').value || new Date().toISOString().slice(0,10);
  const cock = Number($('useCocks').value);
  const players = Number($('usePlayers').value);
  const stockId = $('useStock').value;
  const members = Array.from($('useMembers').selectedOptions).map(o => o.value);

  if (!stockId) return alert('Pilih jenis shuttlecock');
  if (!cock || cock <= 0) return alert('Jumlah cock harus > 0');
  if (!players || players <= 0) return alert('Jumlah pemain harus > 0');
  if (!members.length) return alert('Pilih minimal satu anggota');

  const stockDoc = await db.collection('stocks').doc(stockId).get();
  if (!stockDoc.exists) return alert('Data stok tidak ditemukan');

  const stock = stockDoc.data();
  const hargaPerCock = stock.hargaPerTabung / stock.isiPerTabung;
  const totalBiaya = Math.round(cock * hargaPerCock);
  const biayaPerOrang = Math.round(totalBiaya / players);

  const batch = db.batch();

  // 🔥 1 EVENT PEMAKAIAN
  const usageRef = db.collection('usages').doc();
  batch.set(usageRef, {
    tanggal,
    stockId,
    jenis: stock.jenis,
    cock,
    players,
    hargaPerCock,
    totalBiaya,
    biayaPerOrang,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // 👥 RELASI ANGGOTA
  members.forEach(memberId => {
    const ref = db.collection('usage_members').doc();
    batch.set(ref, {
      usageId: usageRef.id,
      memberId
    });
  });

  await batch.commit();

  // reset form
  $('useCocks').value = '';
  $('usePlayers').value = '';
  $('useMembers').selectedIndex = -1;
  $('useStock').value = '';
});

// ================= RENDER USAGES =================
function renderUsages(snapshot) {
  usagesTableBody.innerHTML = '';
  totalCockTerpakai = 0;

  snapshot.forEach(doc => {



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
