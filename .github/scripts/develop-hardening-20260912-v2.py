from pathlib import Path

patch = Path('.github/scripts/develop-hardening-20260912.py')
src = patch.read_text(encoding='utf-8')

old_wrong = '''old_wrapper_ticket = """function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}

function rebuildCreateRequest"""'''
old_fixed = '''old_wrapper_ticket = """function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}

async function sha256Hex(value) {
  const b = new TextEncoder().encode(String(value || ''));
  const h = await crypto.subtle.digest('SHA-256', b);
  return Array.from(new Uint8Array(h), x=>x.toString(16).padStart(2,'0')).join('');
}

function rebuildCreateRequest"""'''

new_wrong = '''new_wrapper_ticket = """function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}
function selectTicketMatch(rows, receiptNo) {
  const list=Array.isArray(rows)?rows:[];
  const target=ticketIdentity(receiptNo);
  const exact=target?list.filter(r=>ticketIdentity(r?.number)===target):[];
  if(exact.length===1)return{row:exact[0],ambiguous:false,count:1,mode:'exact'};
  if(exact.length>1)return{row:null,ambiguous:true,count:exact.length,mode:'exact'};
  const loose=list.filter(r=>sameTicket(r?.number,receiptNo));
  if(loose.length===1)return{row:loose[0],ambiguous:false,count:1,mode:'compatible'};
  return{row:null,ambiguous:loose.length>1,count:loose.length,mode:'compatible'};
}

function rebuildCreateRequest"""'''
new_fixed = '''new_wrapper_ticket = """function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}
function selectTicketMatch(rows, receiptNo) {
  const list=Array.isArray(rows)?rows:[];
  const target=ticketIdentity(receiptNo);
  const exact=target?list.filter(r=>ticketIdentity(r?.number)===target):[];
  if(exact.length===1)return{row:exact[0],ambiguous:false,count:1,mode:'exact'};
  if(exact.length>1)return{row:null,ambiguous:true,count:exact.length,mode:'exact'};
  const loose=list.filter(r=>sameTicket(r?.number,receiptNo));
  if(loose.length===1)return{row:loose[0],ambiguous:false,count:1,mode:'compatible'};
  return{row:null,ambiguous:loose.length>1,count:loose.length,mode:'compatible'};
}

async function sha256Hex(value) {
  const b = new TextEncoder().encode(String(value || ''));
  const h = await crypto.subtle.digest('SHA-256', b);
  return Array.from(new Uint8Array(h), x=>x.toString(16).padStart(2,'0')).join('');
}

function rebuildCreateRequest"""'''

if src.count(old_wrong) != 1 or src.count(new_wrong) != 1:
    raise SystemExit(f'patch-driver precondition failed old={src.count(old_wrong)} new={src.count(new_wrong)}')
src = src.replace(old_wrong, old_fixed, 1).replace(new_wrong, new_fixed, 1)
exec(compile(src, str(patch), 'exec'), {'__name__':'__main__'})
