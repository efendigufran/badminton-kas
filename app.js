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
const memberSelects = [ $('useMembers'), $('payMember') ];

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

function renderMembers(snapshot) {
  membersTableBody.innerHTML = '';
  memberSelects.forEach(s=> {
    if (s.id === "useMembers") {
      s.innerHTML = ''; // multi-select tidak butuh opsi kosong
    } else {
      s.innerHTML = '<option value="">Pilih anggota</option>';
    }
  });

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

    // Add to selects
    memberSelects.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      s.appendChild(opt);
    });
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

db.collection('members').orderBy('name').onSnapshot(renderMembers);

// ---------- STOCKS ----------
const stocksTableBody = $('stocksTable').querySelector('tbody');

$('addStockBtn').addEventListener('click', async ()=>{
  const tanggal = $('stockDate').value || new Date().toISOString().slice(0,10);
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
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('stockType').value=''; 
  $('stockCans').value=''; 
  $('stockPerCan').value=''; 
  $('stockPricePerCan').value='';
});

function renderStocks(snapshot) {
  stocksTableBody.innerHTML = '';
  let totalCock = 0;

  snapshot.forEach(doc=>{
    const d = doc.data();
    const hargaPerCock = d.hargaPerTabung && d.isiPerTabung ? (d.hargaPerTabung / d.isiPerTabung) : 0;

    totalCock += (d.tabung||0) * (d.isiPerTabung||0);

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

stocksTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-stock')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus data stok?')) 
      await db.collection('stocks').doc(id).delete();
  }
});

db.collection('stocks').orderBy('createdAt','desc').onSnapshot(renderStocks);

// ---------- USAGES (Multi Select Version) ----------
const usagesTableBody = $('usagesTable').querySelector('tbody');

$('addUsageBtn').addEventListener('click', async ()=>{
  const tanggal = $('useDate').value || new Date().toISOString().slice(0,10);
  const cock = Number($('useCocks').value) || 0;

  const selectedOptionEls = Array.from($('useMembers').selectedOptions);
  const memberIds = selectedOptionEls.map(o => o.value);

  const players = memberIds.length; // otomatis jumlah pemain dari multi-select

  if (players === 0) return alert("Pilih minimal 1 pemain!");
  if (!cock || cock <= 0) return alert("Masukkan jumlah cock (>0)");

  // ambil harga terbaru
  const q = await db.collection('stocks')
    .orderBy('createdAt','desc')
    .limit(1)
    .get();

  let hargaPerCock = 0;
  if (!q.empty) {
    const s = q.docs[0].data();
    hargaPerCock = s.hargaPerTabung / s.isiPerTabung;
  }

  const totalBiaya = Math.round(cock * hargaPerCock);
  const biayaPerOrang = Math.round(totalBiaya / Math.max(players,1));

  await db.collection('usages').add({
    tanggal,
    memberIds,
    cock,
    players,
    hargaPerCock,
    totalBiaya,
    biayaPerOrang,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('useCocks').value='';
  $('useMembers').value='';
});

function renderUsages(snapshot) {
  usagesTableBody.innerHTML = '';

  snapshot.forEach(doc=>{
    const d = doc.data();

    const names = (d.memberIds || []).join(", ");

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.tanggal}</td>
      <td>${names || '-'}</td>
      <td>${d.cock}</td>
      <td>${d.players}</td>
      <td>${formatRp(d.totalBiaya)}</td>
      <td>${formatRp(d.biayaPerOrang)}</td>
      <td><button class="del-usage" data-id="${doc.id}">Hapus</button></td>
    `;
    usagesTableBody.appendChild(tr);
  });
}

usagesTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-usage')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pemakaian?')) 
      await db.collection('usages').doc(id).delete();
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
  if (!amount || amount <= 0) return alert('Masukkan jumlah pembayaran >0');

  await db.collection('payments').add({
    memberId, 
    date, 
    amount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('payAmount').value=''; 
  $('payMember').value='';
});

function renderPayments(snapshot) {
  paymentsTableBody.innerHTML = '';

  snapshot.forEach(doc=>{
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

paymentsTableBody.addEventListener('click', async (e)=>{
  if (e.target.classList.contains('del-payment')) {
    const id = e.target.dataset.id;
    if (confirm('Hapus pembayaran?')) 
      await db.collection('payments').doc(id).delete();
  }
});

db.collection('payments').orderBy('createdAt','desc').onSnapshot(renderPayments);

// ---------- BALANCE (with multi memberIds) ----------
async function computeBalances() {

  // --- LOAD MEMBERS ---
  const membersSnap = await db.collection('members').get();
  const members = {};
  membersSnap.forEach(m=>{
    members[m.id] = { 
      id: m.id, 
      name: m.data().name,
      pay: 0,
      use: 0
    };
  });

  // --- SUM USAGES ---
  const usagesSnap = await db.collection('usages').get();
  usagesSnap.forEach(u=>{
    const data = u.data();
    const biaya = data.biayaPerOrang || 0;

    (data.memberIds || []).forEach(id=>{
      if (members[id]) {
        members[id].use += biaya;
      }
    });
  });

  // --- SUM PAYMENTS ---
  const paymentsSnap = await db.collection('payments').get();
  paymentsSnap.forEach(p=>{
    const data = p.data();
    if (members[data.memberId]) {
      members[data.memberId].pay += (data.amount || 0);
    }
  });

  // --- RENDER TABLE ---
  const tbody = $('balanceTable').querySelector('tbody');
  tbody.innerHTML = '';

  let totalDebt = 0;
  let totalMembers = 0;

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
  }
}

$('refreshBalanceBtn').addEventListener('click', computeBalances);
