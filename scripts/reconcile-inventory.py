#!/usr/bin/env python3
"""Read-only inventory comparison; never prints codes or recipients.
Input schema: {"inventory":[{"code":"...","family":"...","assigned_email":null,"assigned_at":null}]}
This is a protected export format, not a public API. No code allocation is performed.
"""
import argparse,json,hashlib,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('before');p.add_argument('after');p.add_argument('--report',required=True);a=p.parse_args()
def load(path):
 data=json.loads(Path(path).read_text())['inventory'];result={};errors=[]
 for i,row in enumerate(data):
  code=row.get('code');family=row.get('family')
  if not isinstance(code,str) or not code or not family:errors.append({'row':i,'reason':'missing code or family'});continue
  key=hashlib.sha256(code.encode()).hexdigest()
  if key in result:errors.append({'code_hash':key,'reason':'duplicate code'})
  result[key]=row
 return result,errors
before,errors1=load(a.before);after,errors2=load(a.after);problems=errors1+errors2
for key,row in before.items():
 other=after.get(key)
 if other is None:problems.append({'code_hash':key,'reason':'missing inventory'});continue
 if other.get('family')!=row.get('family'):problems.append({'code_hash':key,'reason':'changed reward family'})
 if row.get('assigned_email') and (other.get('assigned_email','').strip().lower()!=row['assigned_email'].strip().lower() or other.get('assigned_at')!=row.get('assigned_at')):problems.append({'code_hash':key,'reason':'existing assignment changed'})
seen={}
for key,row in after.items():
 email=(row.get('assigned_email') or '').strip().lower()
 if not email:continue
 local,_,domain=email.partition('@')
 if domain in ('gmail.com','googlemail.com'):email=local.split('+')[0].replace('.','')+'@gmail.com'
 identity=(row['family'],email)
 if identity in seen:problems.append({'code_hash':key,'reason':'multiple allocations to email identity'})
 seen[identity]=key
report={'passed':not problems,'before_count':len(before),'after_count':len(after),'before_assigned':sum(bool(x.get('assigned_email')) for x in before.values()),'after_assigned':sum(bool(x.get('assigned_email')) for x in after.values()),'problems':problems}
out=Path(a.report);out.parent.mkdir(parents=True,exist_ok=True);fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:json.dump(report,f,indent=2)
print(('PASS' if report['passed'] else 'FAIL')+f": {len(before)} prior codes; {len(after)} current codes; {len(problems)} discrepancies. Protected report written.")
raise SystemExit(0 if report['passed'] else 1)
