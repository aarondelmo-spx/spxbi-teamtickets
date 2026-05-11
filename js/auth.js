function syncLoginAccessMessaging(source){
  App.allowedLoginDomains = AuthHelpers.collectAllowedLoginDomains(source);
  var sub = document.querySelector('.login-sub');
  if(sub) sub.textContent = AuthHelpers.getLoginSubtext(App.allowedLoginDomains);
}

function buildGoogleProvider(){
  var provider = new firebase.auth.GoogleAuthProvider();
  var hostedDomain = AuthHelpers.getLoginHostedDomain(App.allowedLoginDomains || []);
  var params = {prompt: 'select_account'};
  if(hostedDomain) params.hd = hostedDomain;
  provider.setCustomParameters(params);
  return provider;
}

function shouldUseRedirectFallback(err){
  var code = err && err.code;
  return code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported';
}

function showLoginError(message){
  var error = document.getElementById('login-error');
  if(error){
    error.textContent = message;
    error.style.display = 'block';
  }
}

function seedWhitelistIfEmpty(){
  App.whitelistRef.once('value', function(snap){
    if(snap.val()){
      syncLoginAccessMessaging(snap.val());
      return;
    }
    var initialList = [
      {email:'karl.kue@spxexpress.com', name:'Karl', role:'admin'},
      {email:'aaron.delmo@spxexpress.com', name:'Will', role:'admin'},
      {email:'aliya.galang@spxexpress.com', name:'Aliya', role:'admin'},
      {email:'charlie.dimaala@spxexpress.com', name:'Chao', role:'admin'},
      {email:'ryandrei.garcia@spxexpress.com', name:'RD', role:'admin'}
    ];
    initialList.forEach(function(entry){ App.whitelistRef.push(entry); });
    syncLoginAccessMessaging(initialList);
  });
}
seedWhitelistIfEmpty();
window.syncLoginAccessMessaging = syncLoginAccessMessaging;

window.signInWithGoogle = function(){
  var btn = document.querySelector('.google-btn');
  var loading = document.getElementById('login-loading');
  if(btn) btn.style.display = 'none';
  if(loading) loading.style.display = 'block';
  var error = document.getElementById('login-error');
  if(error) error.style.display = 'none';
  var provider = buildGoogleProvider();
  App.auth.signInWithPopup(provider).catch(function(err){
    if(shouldUseRedirectFallback(err)){
      showLoginError('Popup sign-in was blocked. Redirecting to Google...');
      return App.auth.signInWithRedirect(provider).catch(function(redirectErr){
        if(btn) btn.style.display = 'flex';
        if(loading) loading.style.display = 'none';
        showLoginError('Sign in failed: ' + redirectErr.message);
      });
    }
    if(btn) btn.style.display = 'flex';
    if(loading) loading.style.display = 'none';
    showLoginError('Sign in failed: ' + err.message);
  });
};

window.signOut = function(){
  if(!confirm('Sign out?')) return;
  App.auth.signOut();
};

function updateWho(){
  var c=colorFor(App.currentUser);
  document.getElementById('who-name').textContent=App.currentUser||'...';
  var av=document.getElementById('who-avatar');
  av.style.cssText='width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;flex-shrink:0;background:'+c+'22;color:'+c;
  av.textContent=initials(App.currentUser);
  var da=document.getElementById('d-my-avatar');
  if(da) da.innerHTML=avatarHtml(App.currentUser,22);
}

App.auth.onAuthStateChanged(function(user){
  if(!user){
    document.getElementById('login-screen').style.display = 'flex';
    document.querySelector('.app') && (document.querySelector('.app').style.display = 'none');
    var btn = document.querySelector('.google-btn');
    var loading = document.getElementById('login-loading');
    if(btn) btn.style.display = 'flex';
    if(loading) loading.style.display = 'none';
    return;
  }
  if(!user.email){
    App.auth.signOut();
    showLoginError('Sign in failed: your Google account did not provide an email address.');
    return;
  }
  var email = user.email.toLowerCase();
  App.currentUserEmail = email;
  App.whitelistRef.once('value', function(snap){
    var wl = snap.val()||{};
    syncLoginAccessMessaging(wl);
    var mappedUser = null;
    Object.entries(wl).forEach(function(entry){
      var normalized = normalizeWhitelistUserRecord(entry[0], entry[1]);
      if(normalized.email === email) mappedUser = normalized;
    });
    if(!mappedUser){
      App.auth.signOut();
      var btn = document.querySelector('.google-btn');
      showLoginError('Access denied. Your email (' + email + ') is not authorized. Contact your admin.');
      if(btn) btn.style.display = 'flex';
      document.getElementById('login-loading').style.display = 'none';
      return;
    }
    App.currentUser = mappedUser.name || mappedUser.email;
    App.currentUserRole = mappedUser.role;
    document.getElementById('login-screen').style.display = 'none';
    document.querySelector('.app').style.display = 'grid';
    updateWho();
    startApp();
  });
});
