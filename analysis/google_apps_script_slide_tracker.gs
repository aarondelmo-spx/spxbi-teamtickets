const SLIDE_TRACKER_CONFIG = {
  databaseUrl: 'https://spxbi-teamtickets-default-rtdb.asia-southeast1.firebasedatabase.app',
  outputSheetName: 'Raw',
  timeZone: 'Asia/Singapore',
  propertyKeys: {
    serviceAccountEmail: 'FIREBASE_SERVICE_ACCOUNT_EMAIL',
    serviceAccountPrivateKey: 'FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY'
  }
};

const SLIDE_TRACKER_HEADERS = [
  'SnapshotDate',
  'RowType',
  'InitiativeId',
  'Title',
  'Team',
  'Subteam',
  'Owner',
  'Status',
  'Stage',
  'Confidence',
  'Priority',
  'TeamCurrentHC',
  'SubteamCurrentHC',
  'ScopedForAutomationHC',
  'ActualizedHC',
  'ExcessCapacityKeptHC',
  'CompletionOutcomeHC',
  'TargetDate',
  'TargetMonth',
  'TargetMonthSort',
  'IsActive',
  'IsDone',
  'IsInProgress',
  'HasTargetDate',
  'IsUnassigned',
  'NextAction',
  'SupportingTeams'
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SPXBI Tracker')
    .addItem('Sync Raw From Firebase', 'syncSlideTrackerRaw')
    .addItem('Create Daily 8AM Trigger', 'createDailySyncTrigger')
    .addToUi();
}

function syncSlideTrackerRaw() {
  const root = fetchFirebaseRoot_();
  const rows = buildSlideTrackerRows_(root);
  writeSheetRows_(SLIDE_TRACKER_CONFIG.outputSheetName, rows);
}

function createDailySyncTrigger() {
  const handler = 'syncSlideTrackerRaw';
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .inTimezone(SLIDE_TRACKER_CONFIG.timeZone)
    .create();
}

function testFirebaseConnection() {
  const root = fetchFirebaseRoot_();
  Logger.log(Object.keys(root || {}));
}

function fetchFirebaseRoot_() {
  const token = getServiceAccountAccessToken_();
  const url = SLIDE_TRACKER_CONFIG.databaseUrl + '/.json';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + token
    }
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Firebase fetch failed: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
  return JSON.parse(response.getContentText() || '{}');
}

function getServiceAccountAccessToken_() {
  const props = PropertiesService.getScriptProperties();
  const email = (props.getProperty(SLIDE_TRACKER_CONFIG.propertyKeys.serviceAccountEmail) || '').trim();
  const privateKey = normalizePrivateKey_(
    props.getProperty(SLIDE_TRACKER_CONFIG.propertyKeys.serviceAccountPrivateKey) || ''
  );
  if (!email || !privateKey) {
    throw new Error(
      'Missing script properties. Set ' +
      SLIDE_TRACKER_CONFIG.propertyKeys.serviceAccountEmail +
      ' and ' +
      SLIDE_TRACKER_CONFIG.propertyKeys.serviceAccountPrivateKey +
      '.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const claimSet = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode_(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode_(JSON.stringify(claimSet));
  const signatureInput = encodedHeader + '.' + encodedClaimSet;
  const signatureBytes = Utilities.computeRsaSha256Signature(signatureInput, privateKey);
  const jwt = signatureInput + '.' + base64UrlEncode_(signatureBytes);

  const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  if (tokenResponse.getResponseCode() !== 200) {
    throw new Error('OAuth token fetch failed: ' + tokenResponse.getResponseCode() + ' ' + tokenResponse.getContentText());
  }
  const body = JSON.parse(tokenResponse.getContentText());
  return body.access_token;
}

function normalizePrivateKey_(rawValue) {
  let value = String(rawValue || '').trim();
  if (!value) return '';

  if (value.endsWith(',')) {
    value = value.slice(0, -1).trim();
  }

  if (value.indexOf('"') === 0 && value.lastIndexOf('"') === value.length - 1) {
    try {
      value = JSON.parse(value);
    } catch (_err) {
      value = value.slice(1, -1);
    }
  }

  value = value.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  value = value.replace(/\r\n/g, '\n');

  if (value.indexOf('-----BEGIN PRIVATE KEY-----') === -1) {
    throw new Error('Private key property is malformed. Paste only the private key value, without "private_key": or trailing comma.');
  }

  return value.trim();
}

function base64UrlEncode_(value) {
  const bytes = typeof value === 'string' ? Utilities.newBlob(value).getBytes() : value;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function buildSlideTrackerRows_(root) {
  const snapshotDate = Utilities.formatDate(new Date(), SLIDE_TRACKER_CONFIG.timeZone, 'yyyy-MM-dd');
  const teamState = buildTeamState_(root);
  const initiatives = buildInitiativeEntries_(root, teamState);
  const rows = [];

  teamState.allSubteams
    .slice()
    .sort(compareSubteams_)
    .forEach((parts, index, items) => {
      const previous = index > 0 ? items[index - 1] : null;
      const showTeamCurrentHC = !previous || previous.team !== parts.team;
      rows.push(toRowArray_({
        SnapshotDate: snapshotDate,
        RowType: 'SUBTEAM',
        InitiativeId: '',
        Title: '',
        Team: parts.team,
        Subteam: parts.subteam,
        Owner: '',
        Status: '',
        Stage: '',
        Confidence: '',
        Priority: '',
        TeamCurrentHC: showTeamCurrentHC ? getTeamCurrentHc_(teamState, parts.team) : '',
        SubteamCurrentHC: getSubteamCurrentHc_(teamState, parts.team, parts.subteam),
        ScopedForAutomationHC: 0,
        ActualizedHC: 0,
        ExcessCapacityKeptHC: 0,
        CompletionOutcomeHC: 0,
        TargetDate: '',
        TargetMonth: '',
        TargetMonthSort: '',
        IsActive: 0,
        IsDone: 0,
        IsInProgress: 0,
        HasTargetDate: 0,
        IsUnassigned: 0,
        NextAction: '',
        SupportingTeams: ''
      }));
    });

  initiatives
    .slice()
    .sort(compareInitiatives_)
    .forEach(item => {
      rows.push(toRowArray_({
        SnapshotDate: snapshotDate,
        RowType: 'INITIATIVE',
        InitiativeId: item.id,
        Title: item.title,
        Team: item.team,
        Subteam: item.subteam,
        Owner: item.owner,
        Status: item.status,
        Stage: item.stage,
        Confidence: item.confidence,
        Priority: item.priority,
        TeamCurrentHC: '',
        SubteamCurrentHC: '',
        ScopedForAutomationHC: item.scopedHC,
        ActualizedHC: item.actualizedHC,
        ExcessCapacityKeptHC: item.excessHC,
        CompletionOutcomeHC: item.completionOutcomeHC,
        TargetDate: item.targetDate,
        TargetMonth: item.goLiveMonth,
        TargetMonthSort: item.targetDate ? item.targetDate.slice(0, 7) : '',
        IsActive: item.status !== 'done' ? 1 : 0,
        IsDone: item.status === 'done' ? 1 : 0,
        IsInProgress: item.status === 'in progress' ? 1 : 0,
        HasTargetDate: item.targetDate ? 1 : 0,
        IsUnassigned: !item.owner || item.owner === 'Unassigned' ? 1 : 0,
        NextAction: item.nextAction,
        SupportingTeams: item.supportingTeams
      }));
    });

  return [SLIDE_TRACKER_HEADERS].concat(rows);
}

function buildTeamState_(root) {
  const state = {
    subteamSizes: {},
    teamFallbackSizes: {},
    teamHasExplicitSize: {},
    allTeams: [],
    allSubteams: [],
    subteamDisplayMap: {}
  };
  const teamSet = {};

  forEachObjectValue_(root.automationSubteams, sub => {
    if (toBoolean_(getField_(sub, 'deleted', false))) return;
    const teamName = normalizeTeamName_(getField_(sub, 'teamName', ''));
    const subteamName = normalizeName_(getField_(sub, 'name', ''), 'Other');
    if (!teamName) return;
    const key = teamName.toLowerCase() + '|' + subteamName.toLowerCase();
    let size = getField_(sub, 'subteamSizeHc', null);
    if (size === null || size === '') size = getField_(sub, 'currentHc', 0);
    state.subteamSizes[key] = num_(size);
    teamSet[teamName] = true;
    state.subteamDisplayMap[key] = {
      team: teamName,
      subteam: subteamName
    };
  });

  forEachObjectValue_(root.automationTeams, team => {
    if (toBoolean_(getField_(team, 'deleted', false))) return;
    const name = normalizeTeamName_(getField_(team, 'name', ''));
    if (!name) return;
    let size = getField_(team, 'teamSizeHc', null);
    if (size === null || size === '') size = getField_(team, 'currentHc', null);
    const hasExplicitSize = !(size === null || size === '');
    state.teamFallbackSizes[name] = hasExplicitSize ? num_(size) : 0;
    state.teamHasExplicitSize[name] = hasExplicitSize;
    teamSet[name] = true;
  });

  state.allTeams = Object.keys(teamSet);
  state.allSubteams = Object.keys(state.subteamDisplayMap).map(key => state.subteamDisplayMap[key]);
  return state;
}

function buildInitiativeEntries_(root, teamState) {
  const entries = [];
  forEachObjectEntry_(root.sprintProjects, (id, ticket) => {
    const scoped = num_(getField_(ticket, 'automationScopedHc', 0));
    const actual = num_(getField_(ticket, 'actualHcSavings', 0));
    const excess = num_(getField_(ticket, 'excessCapacityHc', 0));
    const targetDate = getTargetDate_(ticket);
    const team = normalizeTeamName_(getField_(ticket, 'teamArea', ''));
    const subteam = normalizeName_(getField_(ticket, 'subteam', ''), 'Other');

    if (team && teamState.allTeams.indexOf(team) === -1) {
      teamState.allTeams.push(team);
    }

    entries.push({
      id: id,
      title: String(getField_(ticket, 'title', '') || ''),
      team: team,
      subteam: subteam,
      owner: String(getField_(ticket, 'assignee', '') || ''),
      status: normalizeStatus_(getField_(ticket, 'status', 'open')),
      stage: String(getField_(ticket, 'stage', '') || ''),
      confidence: String(getField_(ticket, 'confidence', '') || ''),
      priority: String(getField_(ticket, 'priority', '') || ''),
      scopedHC: scoped,
      actualizedHC: actual,
      excessHC: excess,
      completionOutcomeHC: actual + excess,
      targetDate: targetDate,
      goLiveMonth: getGoLiveMonth_(targetDate),
      nextAction: String(getField_(ticket, 'nextAction', '') || ''),
      supportingTeams: getSupportingTeams_(ticket)
    });
  });
  return entries;
}

function compareInitiatives_(a, b) {
  const aDate = a.targetDate || '9999-12-31';
  const bDate = b.targetDate || '9999-12-31';
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;
  if (a.scopedHC !== b.scopedHC) return b.scopedHC - a.scopedHC;
  return a.title.localeCompare(b.title);
}

function compareSubteams_(a, b) {
  if (a.team !== b.team) return a.team.localeCompare(b.team);
  return a.subteam.localeCompare(b.subteam);
}

function writeSheetRows_(sheetName, rows) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  if (sheet.getMaxColumns() > rows[0].length) {
    sheet.deleteColumns(rows[0].length + 1, sheet.getMaxColumns() - rows[0].length);
  }
  sheet.autoResizeColumns(1, rows[0].length);
}

function toRowArray_(record) {
  return SLIDE_TRACKER_HEADERS.map(header => record[header]);
}

function getTeamCurrentHc_(state, team) {
  const teamName = normalizeTeamName_(team);
  if (!teamName) return '';
  if (state.teamHasExplicitSize[teamName]) {
    return state.teamFallbackSizes[teamName] || 0;
  }
  const prefix = teamName.toLowerCase() + '|';
  let sum = 0;
  Object.keys(state.subteamSizes).forEach(key => {
    if (key.indexOf(prefix) === 0) sum += state.subteamSizes[key];
  });
  if (!sum && state.teamFallbackSizes[teamName]) return state.teamFallbackSizes[teamName];
  return sum;
}

function getSubteamCurrentHc_(state, team, subteam) {
  const key = makeSubteamKey_(team, subteam);
  return state.subteamSizes[key] || 0;
}

function makeSubteamKey_(team, subteam) {
  return normalizeTeamName_(team).toLowerCase() + '|' + normalizeName_(subteam, 'Other').toLowerCase();
}

function normalizeTeamName_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.toLowerCase() === 'other' ? '' : text;
}

function getTargetDate_(ticket) {
  const timelineEnd = String(getField_(ticket, 'timelineEnd', '') || '');
  if (timelineEnd.trim()) return timelineEnd;
  const deadline = String(getField_(ticket, 'deadline', '') || '');
  if (deadline.trim()) return deadline;
  return '';
}

function getGoLiveMonth_(targetDate) {
  if (!targetDate) return '';
  const parts = targetDate.split('-');
  if (parts.length !== 3) return '';
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return Utilities.formatDate(date, SLIDE_TRACKER_CONFIG.timeZone, "MMM ''yy");
}

function getSupportingTeams_(ticket) {
  const items = getField_(ticket, 'supportingTeams', []);
  if (!Array.isArray(items)) return '';
  return items
    .filter(item => String(item || '').trim())
    .map(item => String(item))
    .join('; ');
}

function normalizeStatus_(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'open';
  switch (value) {
    case 'inprogress':
    case 'in-progress':
    case 'in_progress':
    case 'progress':
    case 'wip':
      return 'in progress';
    case 'complete':
    case 'completed':
    case 'closed':
    case 'finished':
    case 'resolved':
      return 'done';
    default:
      return value;
  }
}

function normalizeName_(value, defaultValue) {
  const text = String(value || '').trim();
  return text || defaultValue;
}

function getField_(object, name, defaultValue) {
  if (!object || typeof object !== 'object' || !(name in object)) return defaultValue;
  return object[name];
}

function num_(value) {
  if (value === null || value === '') return 0;
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function toBoolean_(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function forEachObjectValue_(object, callback) {
  if (!object || typeof object !== 'object') return;
  Object.keys(object).forEach(key => callback(object[key], key));
}

function forEachObjectEntry_(object, callback) {
  if (!object || typeof object !== 'object') return;
  Object.keys(object).forEach(key => callback(key, object[key]));
}
