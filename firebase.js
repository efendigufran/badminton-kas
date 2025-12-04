// didapatkan dari Firebase Console -> Project settings -> Your apps (web)
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyT5p35LgWdtEG0aybT2OKbhxpuuJcUwk",
  authDomain: "kas-badminton.firebaseapp.com",
  projectId: "kas-badminton",
  storageBucket: "kas-badminton.firebasestorage.app",
  messagingSenderId: "229120749558",
  appId: "1:229120749558:web:aeb33e8ea295088aace1d7"
};


// Init
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
