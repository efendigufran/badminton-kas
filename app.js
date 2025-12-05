// app.js
// Pastikan firebase.js sudah diload (db, auth tersedia)

// ---------- Utility ----------
const $ = (id) => document.getElementById(id);
const formatRp = (n) => {
  if (!n && n !== 0) return "Rp 0";
  return "Rp " + Number(n).toLocaleString('id-ID');
};

// ========== MODE MULTI INPUT ==========
let useMultiMode = false;
$('toggleMultiBtn')?.addEventListener('click', () => {
  useMultiMode = !useMultiMode;
  $('singleInputGroup').style.display = useMultiMode ? 'none' : 'flex';
  $('multiInputGroup').style.display = useMultiMode ? 'flex' : 'none';
});

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
const memberSelects = [ $('useMember'), $('payMember') ];
const multiSelect = $('useMembersMulti');

$('addMemberBtn').addEventListener('click', async ()=>{
  const name = $('memberName').value.trim();
  const phone = $('memberPhone').value.trim();
  if (!name) return alert('Masukkan nama anggota');
  await db.collection('members').add({ name, phone, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  $('memberName').value=''; $('memberPhone').value='';
});

function renderMembers(snapshot) {
  membersTableBody.innerHTML = '';

  memberSelects.forEach(s=> s.innerHTML = '<option value="">Pilih anggota</option>');
  multiSelect.innerHTML = ''; // MULTI SELECT

  snapshot.forEach(doc=>{
    const d = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.name}</td>
      <td>${d.phone||'-'}</td>
      <td id="saldo-${doc.id}">-</td>
      <td><button class="del-member" data-id="${doc.id}">Hapus</button></td>
    `;
    membersTableBody.appendChild(tr);

    // add to single-select
    memberSelects.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      s.appendChild(opt);
    });

    // add to MULTI-SELECT
    const opt2 = document.createElement('option');
    opt2.value = doc.id;
    opt2.textContent = d.name;
    multiSelect.appendChild(opt2);
  });
}

membersTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-member')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus anggota?')) {
      await db.collection('members').doc(id).delete();
    }
  }
});

// subscribe members
db.collection('members').orderBy('name').onSnapshot(renderMembers);

// ---------- STOCKS ----------
const stocksTableBody = $('stocksTable').querySelector('tbody');

$('addStockBtn').addEventListener('click', async ()=>{
  const tanggal = $('stockDate').value || new Date().toISOString().slice(0,10);
  const jenis = $('stockType').value || 'standard';
  const tabung = Number($('stockCans').value) || 0;
  const isiPerTabung = Number($('stockPerCan').value) || 0;
  const hargaPerTabung = Number($('stockPricePerCan').value) || 0;
  if (!tabung || !isiPerTabung || !hargaPerTabung) return alert('Isi semua kolom stok dengan angka > 0');
  await db.collection('stocks').add({
    tanggal,
    jenis,
    tabung,
    isiPerTabung,
    hargaPerTabung,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  $('stockType').value=''; $('stockCans').value=''; $('stockPerCan').value=''; $('stockPricePerCan').value='';
});

function renderStocks(snapshot) {
  stocksTableBody.innerHTML = '';
  let totalCock = 0;
  snapshot.forEach(doc=>{
    const d = doc.data();
    const hargaPerCock = d.hargaPerTabung && d.isiPerTabung ? (d.hargaPerTabung / d.isiPerTabung) : 0;
    totalCock += (d.tabung||0) * (d.isiPerTabung||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.tanggal || '-'}</td>
      <td>${d.jenis}</td>
      <td>${d.tabung}</td>
      <td>${d.isiPerTabung}</td>
      <td>${formatRp(d.hargaPerTabung)}</td>
      <td>${formatRp(Math.round(hargaPerCock))}</td>
      <td><button class="del-stock" data-id="${doc.id}">Hapus</button></td>`;
    stocksTableBody.appendChild(tr);
  });
  $('totalStock').textContent = totalCock;
}

stocksTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-stock')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus data stok?')) await db.collection('stocks').doc(id).delete();
  }
});

// listen stocks ordered newest-first
db.collection('stocks').orderBy('createdAt','desc').onSnapshot(renderStocks);

// ---------- USAGES ----------
const usagesTableBody = $('usagesTable').querySelector('tbody');

$('addUsageBtn').addEventListener('click', async ()=>{
  const tanggal = $('useDate').value || new Date().toISOString().slice(0,10);

  // ambil harga per cock terbaru
  const q = await db.collection('stocks').orderBy('createdAt','desc').limit(1).get();
  let hargaPerCock = 0;
  if (!q.empty) {
    const s = q.docs[0].data();
    hargaPerCock = s.hargaPerTabung / s.isiPerTabung;
  }

  const cock = Number($('useCocks').value) || 0;
  if (!cock || cock <= 0) return alert('Masukkan jumlah cock dipakai (>0)');

  // ========== SINGLE MODE ==========
  if (!useMultiMode) {
    const memberId = $('useMember').value || null;
    const players = Number($('usePlayers').value) || 1;

    const totalBiaya = Math.round(cock * hargaPerCock);
    const biayaPerOrang = Math.round(totalBiaya / Math.max(players,1));

    await db.collection('usages').add({
      tanggal,
      memberId,
      cock,
      players,
      hargaPerCock,
      totalBiaya,
      biayaPerOrang,
      membersList: [],  // kosong
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $('useCocks').value=''; $('usePlayers').value=''; $('useMember').value='';
    return;
  }

  // ========== MULTI MODE ==========
  const selectedIds = Array.from(multiSelect.selectedOptions).map(o=>o.value);
  const players = selectedIds.length;

  if (players === 0) return alert("Pilih minimal 1 pemain");

  const totalBiaya = Math.round(cock * hargaPerCock);
  const biayaPerOrang = Math.round(totalBiaya / players);

  // simpan sebagai 1 record (lebih rapi daripada 4 record terpisah)
  await db.collection('usages').add({
    tanggal,
    cock,
    players,
    memberId: null,
    membersList: selectedIds,
    hargaPerCock,
    totalBiaya,
    biayaPerOrang,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('useCocks').value='';
  multiSelect.value='';
});

function renderUsages(snapshot) {
  usagesTableBody.innerHTML = '';
  snapshot.forEach(doc=>{
    const d = doc.data();
    let nameDisplay = "-";

    if (d.memberId) {
      nameDisplay = d.memberId;
    }
    if (d.membersList && d.membersList.length > 0) {
      nameDisplay = d.membersList.join(", ");
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.tanggal}</td>
      <td>${nameDisplay}</td>
      <td>${d.cock}</td>
      <td>${d.players}</td>
      <td>${formatRp(d.totalBiaya)}</td>
      <td>${formatRp(d.biayaPerOrang)}</td>
      <td><button class="del-usage" data-id="${doc.id}">Hapus</button></td>`;
    usagesTableBody.appendChild(tr);
  });
}

usagesTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-usage')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pemakaian?')) await db.collection('usages').doc(id).delete();
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

// ---------- BALANCE ----------
async function computeBalances() {
  // get members
  const membersSnap = await db.collection('members').get();
  const members = {};
  membersSnap.forEach(m=> members[m.id] = { id: m.id, name: m.data().name, pay:0, use:0 });

  // sum usages per member
  const usagesSnap = await db.collection('usages').get();
  usagesSnap.forEach(u=>{
    const d = u.data();

    // SINGLE MODE
    if (d.memberId && members[d.memberId]) {
      members[d.memberId].use += (d.biayaPerOrang || 0);
    }

    // MULTI MODE
    if (d.membersList && d.membersList.length > 0) {
      d.membersList.forEach(id=>{
        if (members[id]) members[id].use += (d.biayaPerOrang || 0);
      });
    }
  });

  // sum payments
  const paymentsSnap = await db.collection('payments').get();
  paymentsSnap.forEach(p=>{
    const data = p.data();
    const id = data.memberId;
    if (id && members[id]) members[id].pay += (data.amount || 0);
  });

  // render table
  const tbody = $('balanceTable').querySelector('tbody');
  tbody.innerHTML = '';
  for (const id in members) {
    const m = members[id];
    const saldo = m.pay - m.use;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${formatRp(m.use)}</td>
      <td>${formatRp(m.pay)}</td>
      <td>${formatRp(saldo)}</td>`;
    tbody.appendChild(tr);
  }
}

$('reloadBalanceBtn')?.addEventListener('click', computeBalances);
