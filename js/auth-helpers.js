(function(root, factory){
  var api = factory();
  root.AuthHelpers = api;
  if(typeof module === 'object' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  function normalizeEntries(source){
    if(Array.isArray(source)) return source;
    if(!source || typeof source !== 'object') return [];
    return Object.keys(source).map(function(key){ return source[key]; });
  }

  function extractEmailDomain(email){
    var normalized = String(email || '').trim().toLowerCase();
    var at = normalized.lastIndexOf('@');
    return at > -1 ? normalized.slice(at + 1) : '';
  }

  function collectAllowedLoginDomains(source){
    var seen = {};
    normalizeEntries(source).forEach(function(entry){
      var domain = extractEmailDomain(entry && entry.email);
      if(domain) seen[domain] = true;
    });
    return Object.keys(seen).sort();
  }

  function getLoginHostedDomain(domains){
    domains = Array.isArray(domains) ? domains.filter(Boolean) : [];
    return domains.length === 1 ? domains[0] : '';
  }

  function getLoginSubtext(domains){
    var hostedDomain = getLoginHostedDomain(domains);
    if(hostedDomain){
      return 'Sign in with your approved ' + hostedDomain + ' Google account to continue.';
    }
    return 'Sign in with your approved Google account to continue.';
  }

  function findWhitelistedUser(source, email){
    var normalizedEmail = String(email || '').trim().toLowerCase();
    var match = null;
    normalizeEntries(source).forEach(function(entry){
      if(match) return;
      if(String(entry && entry.email || '').trim().toLowerCase() === normalizedEmail){
        match = entry;
      }
    });
    return match;
  }

  function withTimeout(promise, timeoutMs, message){
    return new Promise(function(resolve, reject){
      var settled = false;
      var timer = setTimeout(function(){
        if(settled) return;
        settled = true;
        reject(new Error(message || 'Operation timed out.'));
      }, timeoutMs);

      promise.then(function(value){
        if(settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, function(err){
        if(settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function getWhitelistReadErrorMessage(err){
    var code = err && err.code;
    if(code === 'PERMISSION_DENIED'){
      return 'Sign in succeeded, but app access data could not be read. Check Firebase Database rules for /whitelist.';
    }
    if(err && /timed out/i.test(err.message || '')){
      return 'Sign in succeeded, but loading your access timed out. Check the database connection and /whitelist access.';
    }
    return 'Sign in succeeded, but the app could not verify your access. Check the browser console and Firebase /whitelist read access.';
  }

  return {
    collectAllowedLoginDomains: collectAllowedLoginDomains,
    extractEmailDomain: extractEmailDomain,
    getLoginHostedDomain: getLoginHostedDomain,
    getLoginSubtext: getLoginSubtext,
    findWhitelistedUser: findWhitelistedUser,
    withTimeout: withTimeout,
    getWhitelistReadErrorMessage: getWhitelistReadErrorMessage
  };
});
