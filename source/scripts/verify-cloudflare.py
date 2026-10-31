#!/usr/bin/env python3
"""Verify the private deployed site using a short-lived Access service identity.

Credentials stay in memory. Temporary authentication rules are removed in finally.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cloudflare_setup',ROOT/'scripts/cloudflare-setup.py')
setup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',required=True)
    parser.add_argument('--generate-menu',action='store_true',help='Use one application generation allowance for a synthetic weekly menu.')
    parser.add_argument('--report',default='/workspace/scratch/cloudflare-live-verification.json')
    args=parser.parse_args()
    target=urllib.parse.urlsplit(args.url)
    if target.scheme!='https' or not target.hostname or not target.hostname.endswith('.workers.dev') or target.path not in ('','/'):
        raise setup.SetupError('Expected this project’s HTTPS workers.dev URL.')
    token=os.environ.get('CLOUDFLARE_API_TOKEN')
    if not token:raise setup.SetupError('CLOUDFLARE_API_TOKEN is unavailable.')
    api=setup.Cloudflare(token)
    config=json.loads(setup.run('node','--input-type=module','-e',"import{parse}from'jsonc-parser';import{readFileSync}from'node:fs';process.stdout.write(JSON.stringify(parse(readFileSync('wrangler.jsonc','utf8'))));",capture=True))
    account=config['account_id'];name=config['name'];base=f'/accounts/{account}'
    applications=api.call(base+'/access/apps')
    app=next((a for a in applications if a.get('domain')==target.hostname),None)
    if not app:raise setup.SetupError('Access application does not match the requested deployment.')
    code=setup.family_code()
    service=None;policy=None;job_id=None;old_latest=None;old_latest_captured=False
    result={'url':args.url,'completed':False,'checks':{},'temporaryAccessRemoved':False}
    opener=urllib.request.build_opener(NoRedirect())
    auth_headers={}
    def call(path,body=None,method=None,anonymous=False,family=True):
        headers={} if anonymous else dict(auth_headers)
        if not family:headers.pop('Authorization',None)
        if body is not None:headers['Content-Type']='application/json'
        req=urllib.request.Request(args.url.rstrip('/')+path,headers=headers,method=method or ('POST' if body is not None else 'GET'),data=json.dumps(body).encode() if body is not None else None)
        try:
            with opener.open(req,timeout=30) as response:
                return response.status,response.headers,response.read()
        except urllib.error.HTTPError as error:
            return error.code,error.headers,error.read()
    def database(sql,params=None):return api.call(base+f"/d1/database/{config['d1_databases'][0]['database_id']}/query",'POST',{'sql':sql,'params':params or []})
    try:
        # Confirm egress before creating any temporary credentials or policies.
        status,headers,_=call('/',anonymous=True)
        assert status in (302,401,403),'Anonymous traffic must be blocked by Access'
        result['checks']['anonymousBlocked']=True
        service=api.call(base+'/access/service_tokens','POST',{'name':'Temporary migration verification '+str(uuid.uuid4())[:8],'duration':'1h'})
        policy=api.call(base+f"/access/apps/{app['id']}/policies",'POST',{'name':'Temporary migration verification','decision':'non_identity','include':[{'service_token':{'token_id':service['id']}}]})
        auth_headers={'CF-Access-Client-Id':service['client_id'],'CF-Access-Client-Secret':service['client_secret'],'Authorization':'Bearer '+code}
        status,_,html=call('/')
        assert status==200 and b'/assets/' in html,'Authenticated frontend failed'
        result['checks']['frontend']=True
        status,_,_=call('/api/health',family=False)
        assert status==401,'Access sign-in must not replace the family code'
        result['checks']['familyCodeRequired']=True
        status,_,raw=call('/api/health');health=json.loads(raw)
        assert status==200 and health.get('database')=='ok','Database health failed'
        result['checks']['database']=True
        status,_,raw=call('/api/family-plan');state=json.loads(raw)
        assert status==200 and state.get('state',{}).get('plan',{}).get('meals'),'Shared planner read failed'
        result['checks']['sharedPlanner']=True
        status,_,raw=call('/api/family-plan',{'state':state['state'],'revision':state['revision']},'PUT')
        assert status==200,'Shared planner same-content save failed'
        saved=json.loads(raw)
        status,_,raw=call('/api/family-plan');readback=json.loads(raw)
        assert status==200 and readback.get('revision')==saved.get('revision') and readback['state']['plan']==state['state']['plan'],'Shared planner readback failed'
        status,_,_=call('/api/family-plan',{'state':state['state'],'revision':state['revision']},'PUT')
        assert status==409,'Stale planner writes must be rejected'
        result['checks']['saveAndConflict']=True
        status,_,raw=call('/api/translate',{'text':'Fresh vegetables','target':'vi'})
        assert status==200 and json.loads(raw).get('translation'),'English–Vietnamese content translation failed'
        result['checks']['contentTranslation']=True
        status,_,raw=call('/api/ai-menu');settings=json.loads(raw)
        assert status==200,'AI settings failed'
        result['checks']['geminiConfigured']=bool(settings.get('configured'))
        if args.generate_menu:
            assert settings.get('configured'),'GEMINI_API_KEY is not configured on the Worker'
            old_latest=database("SELECT value FROM documents WHERE namespace='ai' AND key='latest'")[0]['results']
            old_latest_captured=True
            job_id=str(uuid.uuid4())
            input={'weekStart':state['state']['weekStart'],'servings':2,'days':['Monday','Tuesday','Wednesday','Thursday','Friday'],'mealTypes':['Lunch','Dinner'],'cuisines':['Vietnamese'],'equipment':['Gas stove'],'diet':'Balanced','avoid':'','maxMinutes':30,'budget':'','pantry':'','customPrompt':'Synthetic migration test: simple family meals with concise instructions, basic ingredients and no personal data.'}
            status,_,_=call('/api/ai-menu',{'action':'generate','id':job_id,'input':input,'masterPrompt':settings['masterPrompt'],'recentMeals':[]})
            assert status==202,'AI job was not accepted'
            started=time.monotonic()
            while time.monotonic()-started<600:
                status,_,raw=call('/api/ai-menu?job='+job_id);job=json.loads(raw)
                if status!=200:raise setup.SetupError('AI polling failed: HTTP '+str(status))
                if job.get('status')=='failed':raise setup.SetupError('AI generation failed: '+str(job.get('errorCode')))
                if job.get('status')=='ready':
                    assert len(job.get('plan',{}).get('meals',[]))==10,'AI did not generate a complete week'
                    assert job['plan'].get('translations',{}).get('vi'),'Vietnamese translations missing'
                    result['checks']['weeklyGeminiGeneration']=True
                    break
                print(json.dumps({'stage':'gemini','status':job.get('status')}),flush=True)
                time.sleep(5)
            assert result['checks'].get('weeklyGeminiGeneration'),'AI generation timed out'
        result['completed']=True
    finally:
        cleanup_errors=[]
        # Always revoke both credentials and policy, even when data cleanup fails.
        try:
            if job_id and old_latest_captured:
                if old_latest:
                    database("UPDATE documents SET value=?,revision=? WHERE namespace='ai' AND key='latest' AND json_extract(value,'$.id')=?",[old_latest[0]['value'],str(uuid.uuid4()),job_id])
                else:
                    database("DELETE FROM documents WHERE namespace='ai' AND key='latest' AND json_extract(value,'$.id')=?",[job_id])
                database("DELETE FROM documents WHERE namespace='ai' AND key=?",['jobs/'+job_id])
        except Exception:
            cleanup_errors.append('synthetic-job')
        for label,path in [
            ('temporary-policy',base+f"/access/apps/{app['id']}/policies/{policy['id']}" if policy else None),
            ('temporary-token',base+f"/access/service_tokens/{service['id']}" if service else None),
        ]:
            if path:
                try:api.call(path,'DELETE')
                except Exception:cleanup_errors.append(label)
        result['temporaryAccessRemoved']=not any(item.startswith('temporary-') for item in cleanup_errors)
        if cleanup_errors:
            result['completed']=False
            result['cleanupErrors']=cleanup_errors
        destination=Path(args.report);destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(result,indent=2)+'\n');destination.chmod(0o600)
        print(json.dumps(result),flush=True)
        if cleanup_errors:raise setup.SetupError('Verification cleanup requires attention: '+', '.join(cleanup_errors))

if __name__=='__main__':
    try:main()
    except (setup.SetupError,AssertionError,urllib.error.URLError) as error:raise SystemExit(str(error))
