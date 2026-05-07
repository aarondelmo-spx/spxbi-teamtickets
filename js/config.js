firebase.initializeApp({
  apiKey: "AIzaSyD-NDTU5Ofkq8cxdU29TIL0J-5n4oPPlg0",
  authDomain: "spxbi-teamtickets.firebaseapp.com",
  databaseURL: "https://spxbi-teamtickets-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "spxbi-teamtickets",
  storageBucket: "spxbi-teamtickets.firebasestorage.app",
  messagingSenderId: "527260288738",
  appId: "1:527260288738:web:c94bb1db3e4b70873a00bb"
});

App.db = firebase.database();
App.auth = firebase.auth();
App.mainTicketsRef = App.db.ref('tickets');
App.sprintTicketsRef = App.db.ref('sprintProjects');
App.ticketsRef = App.mainTicketsRef;
App.teamRef = App.db.ref('team');
App.activityRef = App.db.ref('activity');
App.whitelistRef = App.db.ref('whitelist');
