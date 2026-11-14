#!/usr/bin/env python3
"""Normalize an owner-supplied CSV/XLSX without importing it or retaining extra fields.
Usage: python scripts/prepare-registrations.py INPUT --event EVENT --output private/import.json
For XLSX install openpyxl locally and specify --sheet to avoid overlapping sheets.
"""
import argparse,csv,hashlib,json,re,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--event',required=True);p.add_argument('--sheet');p.add_argument('--output',required=True);args=p.parse_args()
path=Path(args.input)
if path.suffix.lower()=='.xlsx':
 import openpyxl
 wb=openpyxl.load_workbook(path,read_only=True,data_only=True)
 if not args.sheet:p.error('--sheet is required for XLSX; select one authoritative sheet')
 values=iter(wb[args.sheet].values);headers=[str(x or '').strip().lower() for x in next(values)];rows=(dict(zip(headers,row)) for row in values)
else:
 f=path.open(encoding='utf-8-sig',newline='');rows=({k.strip().lower():v for k,v in row.items() if k} for row in csv.DictReader(f))
result=[];quarantine=[]
for index,row in enumerate(rows,2):
 address=str(row.get('email') or row.get('email address') or row.get('guest email') or '').strip().lower()
 if not address or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',address):
  if any(row.values()):quarantine.append({'row':index,'reason':'Missing or invalid email'})
  continue
 record=str(row.get('api_id') or row.get('guest id') or row.get('id') or hashlib.sha256((args.event+'\0'+address).encode()).hexdigest())
 result.append({'email':address,'event':args.event,'record':record,'status':str(row.get('approval_status') or row.get('approval status') or row.get('status') or 'unknown')})
out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
for target,value in [(out,result),(out.with_suffix('.quarantine.json'),quarantine)]:
 fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f,indent=2)
print(f'Prepared {len(result)} rows; quarantined {len(quarantine)}. No remote changes.')
