import fs from 'node:fs';

function patchFile(path, fn) {
  let s = fs.readFileSync(path, 'utf8');
  const before = s;
  const replaceOnce = (oldText, newText) => {
    const n = s.split(oldText).length - 1;
    if (n !== 1) throw new Error(`${path}: expected 1 match, got ${n}: ${oldText.slice(0,120)}`);
    s = s.replace(oldText, newText);
  };
  fn({replaceOnce, get:()=>s, set:v=>{s=v;}});
  if (s === before) throw new Error(`${path}: no change`);
  fs.writeFileSync(path, s);
}

patchFile('miniapp-v2/backend/develop-service-message.js', ({replaceOnce}) => {
  replaceOnce("VERSION: '2.3.dev6'", "VERSION: '2.4.dev7'");
  replaceOnce(
    "    serviceMessageReusableUnboundToken: true,\n",
    "    serviceMessageReusableUnboundToken: true,\n    serviceMessageFreshActionReopenRequired: true,\n"
  );
  replaceOnce(
`  if (usage && String(usage.request_id || '') !== requestId) {
    const adopted = await adoptReusableNotificationClaim(env, tokenHash, usage, requestId, businessDate, waitTypeId);
    if (adopted) return publicClaim(adopted, true);
    throw apiError('LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP', 409, true);
  }`,
`  if (usage && String(usage.request_id || '') !== requestId) {
    const adopted = await adoptReusableNotificationClaim(env, tokenHash, usage, requestId, businessDate, waitTypeId);
    if (adopted) return publicClaim(adopted, true);
    const definitiveBound = String(usage.status || '') === 'BOUND';
    throw apiError('LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP', 409, !definitiveBound);
  }`
  );
});

patchFile('miniapp-v2/backend/develop-worker.mjs', ({replaceOnce}) => {
  replaceOnce(
`      } catch (e) {
        return json(request, {
          ok:false,
          stored:false,
          notificationRequired:true,
          notificationReady:false,
          ambiguous:false,
          notificationAmbiguous:Boolean(e?.ambiguous),
          error:'LINE呼出通知を準備できないため、受付は作成されていません。もう一度お試しください。',
          errorCode:'LINE_NOTIFICATION_NOT_READY',
          notificationError:safeError(e),
        }, Number(e?.status || 503));
      }`,
`      } catch (e) {
        const notificationError = safeError(e);
        const reopenRequired = String(e?.code || '') === 'LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP' && !e?.ambiguous;
        return json(request, {
          ok:false,
          stored:false,
          notificationRequired:true,
          notificationReady:false,
          ambiguous:false,
          notificationAmbiguous:Boolean(e?.ambiguous),
          error:reopenRequired
            ? '同じ日にもう一度受付できます。新しい受付のLINE通知を準備するため、ミニアプリをいったん完全に閉じて、開き直してから受付してください。'
            : 'LINE呼出通知を準備できないため、受付は作成されていません。もう一度お試しください。',
          errorCode:reopenRequired ? 'LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP' : 'LINE_NOTIFICATION_NOT_READY',
          notificationError,
        }, Number(e?.status || 503));
      }`
  );
  replaceOnce(
`      body?.alreadyExists === true &&
      String(createPayload.waitTypeId || '') === DEVELOP_TEST_WAIT_TYPE_ID &&
      String(body.waitTypeId || '') === DEVELOP_TEST_WAIT_TYPE_ID &&
      await releaseCanceledDevelopTestClaim(env, createPayload, body)`,
`      body?.alreadyExists === true &&
      await releaseTerminalPreviousClaim(env, createPayload, body)`
  );
  replaceOnce(
`async function releaseCanceledDevelopTestClaim(env, createPayload, existing) {
  if (!env?.DB || !env?.AIRWAIT_API_KEY) return false;
  try {
    const activeRows = await fetchDevelopTestReservations(env, { isEnabledStatus:'1' });
    if (activeRows.some(r => sameTicket(r.number, existing.receiptNo))) return false;

    const canceledRows = await fetchDevelopTestReservations(env, { status:'3' });
    const own = canceledRows.find(r => sameTicket(r.number, existing.receiptNo));
    if (!own) return false;

    const claim = await env.DB.prepare(\`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id
      FROM v2_user_day_claims
      WHERE business_date=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'
      LIMIT 1\`)
      .bind(
        String(existing.businessDate || createPayload.operationalDate || ''),
        String(existing.reserveId || ''),
        String(existing.receiptNo || ''),
        DEVELOP_TEST_WAIT_TYPE_ID,
      ).first();
    if (!claim?.user_hash || !claim?.request_id) return false;

    const del = await env.DB.prepare(\`DELETE FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND request_id=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'\`)
      .bind(
        String(claim.user_hash),
        String(claim.business_date),
        String(claim.request_id),
        String(claim.reserve_id),
        String(claim.receipt_no),
        DEVELOP_TEST_WAIT_TYPE_ID,
      ).run();
    if (Number(del?.meta?.changes || 0) !== 1) return false;

    await env.DB.batch([
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(createPayload.requestId || '')),
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(claim.request_id || '')),
    ]);

    return true;
  } catch (e) {
    console.warn('DEVELOP_TEST_CANCELED_CLAIM_RELEASE_FAILED', safeError(e));
    return false;
  }
}`,
`async function releaseTerminalPreviousClaim(env, createPayload, existing) {
  if (!env?.DB || !env?.AIRWAIT_API_KEY) return false;
  try {
    const rows = await fetchAllReservationsForReconcile(env);
    const match = selectTicketMatch(rows, existing.receiptNo);
    const own = match.row;
    if (!own || !['2','3'].includes(String(own.status || ''))) return false;

    const claim = await env.DB.prepare(\`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id
      FROM v2_user_day_claims
      WHERE business_date=? AND reserve_id=? AND receipt_no=? AND state='CONFIRMED'
      LIMIT 1\`)
      .bind(
        String(existing.businessDate || createPayload.operationalDate || ''),
        String(existing.reserveId || ''),
        String(existing.receiptNo || ''),
      ).first();
    if (!claim?.user_hash || !claim?.request_id) return false;

    const del = await env.DB.prepare(\`DELETE FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND request_id=? AND reserve_id=? AND receipt_no=? AND state='CONFIRMED'\`)
      .bind(
        String(claim.user_hash),
        String(claim.business_date),
        String(claim.request_id),
        String(claim.reserve_id),
        String(claim.receipt_no),
      ).run();
    if (Number(del?.meta?.changes || 0) !== 1) return false;

    await env.DB.batch([
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(createPayload.requestId || '')),
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(claim.request_id || '')),
    ]);
    return true;
  } catch (e) {
    console.warn('TERMINAL_PREVIOUS_CLAIM_RELEASE_FAILED', safeError(e));
    return false;
  }
}`
  );
});

patchFile('miniapp-v2/shared/reception.js', ({replaceOnce}) => {
  replaceOnce(
`  try{
    const r=await fetchWithTimeout(E.backendUrl,options,POST_TIMEOUT_MS,'受付送信の応答がタイムアウトしました。結果を確認します。');
    let d=null;try{d=await r.json()}catch{}
    if(d&&r.status!==202)return{...d,_requestId:id};
    return await pollRequest(id);
  }catch{
    return await pollRequest(id);
  }`,
`  let r;
  try{
    r=await fetchWithTimeout(E.backendUrl,options,POST_TIMEOUT_MS,'受付送信の応答がタイムアウトしました。結果を確認します。');
  }catch{
    return await pollRequest(id);
  }
  let d=null;try{d=await r.json()}catch{}
  if(d&&r.status!==202)return{...d,_requestId:id};
  return await pollRequest(id);`
  );
});

patchFile('miniapp-v2/develop/index.html', ({get,set}) => {
  const s=get();
  const count=(s.match(/20260912-09/g)||[]).length;
  if(count<1) throw new Error(`develop index: old cache version not found`);
  set(s.replaceAll('20260912-09','20260913-01'));
});

console.log('multi-entry patch applied');
