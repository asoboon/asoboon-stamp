/**
 * ASOBooN PURPLE Gateway v2.1 marker/date isolation patch.
 *
 * Why this exists:
 * - purple call-status polls `snapshot` frequently.
 * - the notification worker polls once per minute.
 * - if both share one last-update marker, the UI can consume an AirWAIT change before
 *   the worker sees it, causing a missed LINE notification.
 * - the browser's calendar date changes at midnight, while ASOBooN's operational date
 *   changes at 18:00. During the 18:00-23:59 test window, a browser may still submit the
 *   calendar date even though the Gateway/AirWAIT is already on the next operational day.
 *
 * This patch gives the notification worker its own marker and safely canonicalizes only
 * the current JST calendar date to the current operational date during the cutoff window.
 * Deploy together with ASOBooN_PURPLE_GATEWAY_V2_Code.gs and run
 * setupPurpleGatewayV21() instead of setupPurpleGatewayV2().
 */
const PG21_WORKER_MARKER_PROP = 'PURPLE_V21_WORKER_LAST_MARKER';

function setupPurpleGatewayV21() {
  setupPurpleGatewayV2();
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PG21_WORKER_MARKER_PROP);
  props.setProperty(PG2.RETRY_PENDING_PROP, 'FALSE');
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (!t.getHandlerFunction) return;
    const h = t.getHandlerFunction();
    if (h === 'purpleGatewayWorkerV2' || h === 'purpleGatewayWorkerV21') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('purpleGatewayWorkerV21').timeBased().everyMinutes(1).create();
  pg2Log_('INFO','SETUP_V21','','','', 'READY', 'separate worker marker + operational-date normalization enabled');
  return pg2Health_();
}

function purpleGatewayWorkerV21() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return;
  try {
    const ctl = pg2Control_();
    if (!pg2Bool_(ctl.enabled,false) || !pg2Bool_(ctl.workerEnabled,false)) return;

    const props = PropertiesService.getScriptProperties();
    const marker = pg2AirwaitLastUpdate_();
    const previousMarker = props.getProperty(PG21_WORKER_MARKER_PROP) || '';
    const retryPending = props.getProperty(PG2.RETRY_PENDING_PROP) === 'TRUE';
    const snapshotExists = pg2SnapshotExists_();

    // Important: this comparison uses the WORKER marker, never the snapshot/UI marker.
    if (previousMarker && marker === previousMarker && !retryPending && snapshotExists) return;

    let rows;
    if (!snapshotExists || marker !== previousMarker) rows = pg2RefreshSnapshotWithMarker_(marker, true).rows;
    else rows = pg2ReadSnapshot_();

    const businessDate = pg2OperationalDate_(new Date());
    pg2ObserveCalls_(businessDate, rows);
    const maps = pg2MapsForDate_(businessDate);
    const now = Date.now();
    let keepRetryPending = false;

    maps.forEach(function(rec) {
      if (!rec.notificationToken) return;
      const status = String(rec.status || '');
      if (['CALL_MESSAGE_SENT','CALL_SEND_AMBIGUOUS','CALL_SEND_ERROR','CALL_SEND_GAVE_UP','TOKEN_EXPIRED','TOKEN_EXHAUSTED'].indexOf(status) >= 0) return;

      if (status === 'CALL_SEND_PENDING') {
        const age = now - pg2Epoch_(rec.updatedAt);
        if (age >= PG2.PENDING_STALE_MS) {
          rec.status = 'CALL_SEND_AMBIGUOUS';
          rec.lastError = 'stale CALL_SEND_PENDING; delivery outcome unknown';
          rec.nextRetryAt = '';
          rec.updatedAt = new Date();
          pg2UpsertMap_(rec);
        } else keepRetryPending = true;
        return;
      }

      if (pg2Expired_(rec)) {
        rec.status = 'TOKEN_EXPIRED'; rec.lastError = 'service notification token expired';
        rec.updatedAt = new Date(); rec.nextRetryAt = ''; pg2UpsertMap_(rec); return;
      }
      if (Number(rec.remainingCount || 0) <= 0) {
        rec.status = 'TOKEN_EXHAUSTED'; rec.lastError = 'remainingCount=0';
        rec.updatedAt = new Date(); rec.nextRetryAt = ''; pg2UpsertMap_(rec); return;
      }

      const row = rows.find(function(x) {
        return pg2Receipt_(x && (x.number != null ? x.number : x.receiptNo)) === String(rec.receiptNo)
          && String(x && x.waitTypeId || '') === String(rec.waitTypeId);
      });
      if (!row || String(row.status || '') !== '0' || !pg2CallFlag_(row.isCalling)) return;

      if (!rec.callDetectedAt) {
        rec.callDetectedAt = new Date(); rec.updatedAt = new Date(); pg2UpsertMap_(rec);
      }

      const nextAt = pg2Epoch_(rec.nextRetryAt);
      if (status === 'CALL_SEND_RETRY' && nextAt && nextAt > now) {
        keepRetryPending = true;
        return;
      }

      try {
        pg2SendCallMessage_(rec);
      } catch (err) {
        if (err && err.ambiguous === true) return;
        const count = Number(rec.retryCount || 0) + 1;
        rec.retryCount = count;
        rec.lastError = pg2SafeError_(err);
        rec.lastHttpStatus = Number(err && err.httpStatus || 0) || '';
        rec.updatedAt = new Date();
        if (err && err.retryable === true && count <= PG2.MAX_SAFE_RETRIES) {
          const delaySec = [0,60,120,300][Math.min(count,3)] || 300;
          rec.status = 'CALL_SEND_RETRY';
          rec.nextRetryAt = new Date(Date.now() + delaySec * 1000);
          keepRetryPending = true;
        } else {
          rec.status = err && err.retryable === true ? 'CALL_SEND_GAVE_UP' : 'CALL_SEND_ERROR';
          rec.nextRetryAt = '';
        }
        pg2UpsertMap_(rec);
        pg2Log_('ERROR','CALL_NOTIFY',rec.receiptNo,rec.bindingId,rec.lastHttpStatus,rec.status,rec.lastError);
      }
    });

    props.setProperty(PG21_WORKER_MARKER_PROP, marker);
    props.setProperty(PG2.RETRY_PENDING_PROP, keepRetryPending ? 'TRUE' : 'FALSE');
  } catch (err) {
    PropertiesService.getScriptProperties().setProperty(PG2.RETRY_PENDING_PROP, 'TRUE');
    pg2Log_('ERROR','WORKER_V21','','','', 'ERROR', pg2SafeError_(err));
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Canonicalize a browser-supplied date without accepting arbitrary stale/future dates.
 * Before 18:00 JST: calendar date === operational date, so no conversion occurs.
 * From 18:00 JST: only today's calendar date is allowed to roll to tomorrow's operational date.
 */
function pg21CanonicalBusinessDate_(value) {
  const submitted = pg2Date_(value);
  const now = new Date();
  const calendarDate = pg2JstDate_(now);
  const operationalDate = pg2OperationalDate_(now);
  if (!submitted) return operationalDate;
  if (submitted === operationalDate) return operationalDate;
  if (calendarDate !== operationalDate && submitted === calendarDate) return operationalDate;
  return submitted;
}

// Keep the existing hardened v2.1 handlers, but normalize the browser's after-hours date
// before they validate or search the purple map/call ledger.
var PG21_ORIGINAL_ISSUE_SERVICE_TOKEN_ = pg2IssueServiceToken_;
pg2IssueServiceToken_ = function(p) {
  const x = Object.assign({}, p || {});
  const canonical = pg21CanonicalBusinessDate_(x.businessDate || x.day || x.operationalDay);
  x.businessDate = canonical;
  x.day = canonical;
  x.operationalDay = canonical;
  return PG21_ORIGINAL_ISSUE_SERVICE_TOKEN_(x);
};

var PG21_ORIGINAL_RESERVATION_STATUS_ = pg2ReservationStatus_;
pg2ReservationStatus_ = function(p) {
  const x = Object.assign({}, p || {});
  const canonical = pg21CanonicalBusinessDate_(x.businessDate || x.day || x.date);
  x.businessDate = canonical;
  x.day = canonical;
  x.date = canonical;
  return PG21_ORIGINAL_RESERVATION_STATUS_(x);
};

var PG21_ORIGINAL_CALL_INFO_ = pg2CallInfo_;
pg2CallInfo_ = function(p) {
  const x = Object.assign({}, p || {});
  const canonical = pg21CanonicalBusinessDate_(x.businessDate || x.day || x.date);
  x.businessDate = canonical;
  x.day = canonical;
  x.date = canonical;
  return PG21_ORIGINAL_CALL_INFO_(x);
};
