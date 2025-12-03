// Tambah anggota
function addMember() {
  const name = document.getElementById("nameInput").value;

  db.collection("members").add({
    name: name,
    saldo: 0
  });

  loadMembers(); 
}

// Tampilkan anggota
function loadMembers() {
  db.collection("members").onSnapshot(snapshot => {
    const list = document.getElementById("memberList");
    list.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();
      list.innerHTML += `<li>${data.name} — Saldo: Rp ${data.saldo}</li>`;
    });
  });
}

loadMembers();
