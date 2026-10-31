#!/usr/bin/env python3
"""Provision this project's free Cloudflare resources. Never logs credential values."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://api.cloudflare.com/client/v4'

class SetupError(Exception):
    pass

class Cloudflare:
    def __init__(self, token):
        self.headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

    def call(self, path, method='GET', body=None, missing_ok=False):
        req = urllib.request.Request(BASE + path, method=method, headers=self.headers,
            data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as error:
            if missing_ok and error.code == 404:
                return None
            try:
                codes = [item.get('code') for item in json.load(error).get('errors', [])]
            except Exception:
                codes = []
            raise SetupError(f'Cloudflare operation {method} {path} failed: HTTP {error.code}, codes={codes}') from None
        if not payload.get('success'):
            raise SetupError(f'Cloudflare operation {method} {path} failed')
        return payload.get('result')


def run(*command, capture=False, extra_env=None):
    environment = dict(os.environ)
    environment.update({'WRANGLER_SEND_METRICS': 'false', 'XDG_CONFIG_HOME': '/tmp/family-cf-config',
                        'WRANGLER_LOG_PATH': '/tmp/family-cf-wrangler.log'})
    environment.update(extra_env or {})
    result = subprocess.run(command, cwd=ROOT, env=environment, text=True, capture_output=capture)
    if result.returncode:
        raise SetupError('Command failed: ' + ' '.join(command[:3]))
    return result.stdout if capture else None


def family_code(required=True):
    value = os.environ.get('FAMILY_ACCESS_CODE', '')
    if not value and (ROOT / '.env').exists():
        for line in (ROOT / '.env').read_text().splitlines():
            if line.startswith('FAMILY_ACCESS_CODE='):
                value = line.split('=', 1)[1].strip().strip('\"\'')
                break
    if len(value) < 16 and required:
        raise SetupError('A private FAMILY_ACCESS_CODE of at least 16 characters is required.')
    return value if len(value) >= 16 else None


def seed_defaults(api, account, database):
    # Generated SQL is private, create-only, and validated by application code.
    with tempfile.TemporaryDirectory(prefix='family-cloudflare-import-') as folder:
        output = str(Path(folder) / 'defaults.sql')
        checked = run('node', 'scripts/prepare-backup.mjs', 'public/meal-plan.json', output, capture=True)
        metadata = json.loads(next(line for line in reversed(checked.splitlines()) if line.startswith('{')))
        query_path = f'/accounts/{account}/d1/database/{database}/query'
        result = api.call(query_path, 'POST', {'sql': Path(output).read_text()})
        modified = sum(item.get('meta', {}).get('changes', 0) for item in result)
        rows = api.call(query_path, 'POST', {'sql': "SELECT value FROM documents WHERE namespace='planner' AND key='state.json'"})
        value = rows[0]['results'][0]['value']
        checksum = hashlib.sha256(value.encode()).hexdigest()
        if modified and checksum != metadata['sha256']:
            raise SetupError('Imported state checksum mismatch; do not cut over.')
        print(json.dumps({'planner': 'defaults-imported-and-verified' if modified else 'existing-destination-preserved'}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email', action='append', required=True, help='Approved Access email; repeat for family members.')
    parser.add_argument('--account-id', default=os.environ.get('CLOUDFLARE_ACCOUNT_ID'))
    parser.add_argument('--seed-defaults', action='store_true', help='Initialize an empty destination with validated defaults.')
    parser.add_argument('--provision-without-secrets', action='store_true', help='Create a private deployment even if runtime keys still need owner entry.')
    parser.add_argument('--report', help='Write a sanitized setup report (contains no credentials).')
    args = parser.parse_args()
    emails = list(dict.fromkeys(value.strip().lower() for value in args.email))
    if not emails or any(not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value) for value in emails):
        raise SetupError('Approved email addresses are required.')
    token = os.environ.get('CLOUDFLARE_API_TOKEN')
    if not token:
        raise SetupError('CLOUDFLARE_API_TOKEN is not available in this runtime. Configure the secure binding first.')
    code = family_code(required=not args.provision_without_secrets)
    api = Cloudflare(token)
    accounts = api.call('/accounts')
    account = args.account_id
    if not account:
        if len(accounts) != 1:
            raise SetupError('Multiple/no Cloudflare accounts returned; select --account-id explicitly.')
        account = accounts[0]['id']
    if not any(item['id'] == account for item in accounts):
        raise SetupError('The selected account is not authorized by this token.')

    try:
        verified = api.call('/user/tokens/verify')
    except SetupError:
        verified = api.call(f'/accounts/{account}/tokens/verify')
    if verified.get('status') != 'active':
        raise SetupError('Cloudflare token is not active.')
    config_path = ROOT / 'wrangler.jsonc'
    config = json.loads(config_path.read_text())
    name = config['name']
    subdomain = api.call(f'/accounts/{account}/workers/subdomain', missing_ok=True)
    if not subdomain or not subdomain.get('subdomain'):
        subdomain = api.call(f'/accounts/{account}/workers/subdomain', 'PUT', {'subdomain': 'family-' + account[:12]})
    hostname = f"{name}.{subdomain['subdomain']}.workers.dev"
    databases = api.call(f'/accounts/{account}/d1/database')
    database = next((item for item in databases if item['name'] == config['d1_databases'][0]['database_name']), None)
    if database is None:
        database = api.call(f'/accounts/{account}/d1/database', 'POST', {'name': config['d1_databases'][0]['database_name']})
    config['d1_databases'][0]['database_id'] = database['uuid']
    config['account_id'] = account
    config_path.write_text(json.dumps(config, indent=2) + '\n')
    run('./node_modules/.bin/wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote')
    if args.seed_defaults:
        seed_defaults(api, account, database['uuid'])
    commit = run('git', 'rev-parse', 'HEAD', capture=True).strip()
    run('npm', 'run', 'build', extra_env={'COMMIT_REF': commit})
    run('./node_modules/.bin/wrangler', 'deploy')  # initially denies traffic if Access is not configured
    organization = api.call(f'/accounts/{account}/access/organizations', missing_ok=True)
    if organization is None:
        organization = api.call(f'/accounts/{account}/access/organizations', 'POST',
            {'name': 'Family meal planning', 'auth_domain': 'family-' + account[:12] + '.cloudflareaccess.com'})
    providers = api.call(f'/accounts/{account}/access/identity_providers')
    otp = next((item for item in providers if item.get('type') == 'onetimepin'), None)
    if otp is None:
        otp = api.call(f'/accounts/{account}/access/identity_providers', 'POST',
            {'name': 'Family email OTP', 'type': 'onetimepin', 'config': {}})
    applications = api.call(f'/accounts/{account}/access/apps')
    application = next((item for item in applications if item.get('domain') == hostname), None)
    if application is None:
        application = api.call(f'/accounts/{account}/access/apps', 'POST', {
            'name': 'Family meal planning', 'type': 'self_hosted', 'domain': hostname,
            'session_duration': '24h', 'allowed_idps': [otp['id']], 'auto_redirect_to_identity': True,
            'policies': [{'name': 'Approved family emails', 'decision': 'allow',
                          'include': [{'email': {'email': email}} for email in emails]}],
        })
    else:
        # Never silently broaden or replace an existing application's policy.
        policies = api.call(f"/accounts/{account}/access/apps/{application['id']}/policies")
        allow_emails = {rule.get('email', {}).get('email', '').lower()
                        for policy in policies if policy.get('decision') == 'allow'
                        for rule in policy.get('include', []) if 'email' in rule}
        unexpected_rules = any(set(rule) != {'email'} for policy in policies if policy.get('decision') == 'allow' for rule in policy.get('include', []))
        if allow_emails != set(emails) or unexpected_rules or any(policy.get('decision') in ('bypass', 'non_identity') for policy in policies):
            raise SetupError('An existing Access policy differs from the requested emails; review before updating.')
    config['vars']['CF_ACCESS_TEAM_DOMAIN'] = organization['auth_domain']
    config['vars']['CF_ACCESS_AUD'] = application['aud']
    config_path.write_text(json.dumps(config, indent=2) + '\n')
    run('./node_modules/.bin/wrangler', 'deploy')
    if code:
        api.call(f'/accounts/{account}/workers/scripts/{name}/secrets', 'PUT',
                 {'name': 'FAMILY_ACCESS_CODE', 'type': 'secret_text', 'text': code})
    secret_names = {entry['name'] for entry in api.call(f'/accounts/{account}/workers/scripts/{name}/secrets')}
    report = {'url': 'https://' + hostname, 'accessConfigured': True,
              'familyCodeConfigured': 'FAMILY_ACCESS_CODE' in secret_names,
              'geminiKeyConfigured': 'GEMINI_API_KEY' in secret_names,
              'commit': commit, 'publicReadinessVerified': False}
    print(json.dumps(report))
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2)+'\n')
        report_path.chmod(0o600)
    if 'FAMILY_ACCESS_CODE' not in secret_names:
        print('Owner action: set FAMILY_ACCESS_CODE in Cloudflare Worker Secrets; private APIs remain disabled until configured.')
    if 'GEMINI_API_KEY' not in secret_names:
        print('Owner action: add the existing GEMINI_API_KEY in Cloudflare Worker Secrets, then verify a live job.')


if __name__ == '__main__':
    try:
        main()
    except SetupError as error:
        raise SystemExit(str(error))
