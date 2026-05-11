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

  return {
    collectAllowedLoginDomains: collectAllowedLoginDomains,
    extractEmailDomain: extractEmailDomain,
    getLoginHostedDomain: getLoginHostedDomain,
    getLoginSubtext: getLoginSubtext
  };
});
