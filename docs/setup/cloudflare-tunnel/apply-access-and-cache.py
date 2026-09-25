#!/usr/bin/env python3
"""Create Cloudflare Access apps + cache bypass for GP .ph hosts."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "aef4eab269dda056de6dd8361e9ca2ab")
ZONE = os.environ.get("CLOUDFLARE_ZONE_ID", "6a09c657d02428d2136f355d397dc268")
EMAIL_DOMAIN = os.environ.get("GP_ACCESS_EMAIL_DOMAIN", "greenpasture.ph")
HOSTS = [
    "hris.greenpasture.ph",
    "csm.greenpasture.ph",
    "timekeep.greenpasture.ph",
]
CACHE_DESC = "GP .ph apps — bypass CDN cache (live HR data)"


def api(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise SystemExit(f"HTTP {e.code} {method} {path}: {err}") from e


def main() -> None:
    ver = api("GET", "/user/tokens/verify")
    if not ver.get("success"):
        raise SystemExit(f"token verify failed: {ver}")
    print("token ok")

    listed = api("GET", f"/accounts/{ACCOUNT}/access/apps")
    existing_domains: set[str] = set()
    for app in listed.get("result") or []:
        if app.get("domain"):
            existing_domains.add(app["domain"])
        for d in app.get("self_hosted_domains") or []:
            existing_domains.add(d)
        for dest in app.get("destinations") or []:
            uri = dest.get("uri") or ""
            if uri:
                existing_domains.add(uri.split("/")[0])

    for host in HOSTS:
        if host in existing_domains:
            print(f"[skip] Access already covers {host}")
            continue
        short = host.split(".")[0]
        body = {
            "name": f"GP {short} .ph",
            "domain": host,
            "type": "self_hosted",
            "session_duration": "24h",
            "auto_redirect_to_identity": False,
            "app_launcher_visible": False,
            "policies": [
                {
                    "name": f"Allow @{EMAIL_DOMAIN}",
                    "decision": "allow",
                    "include": [{"email_domain": {"domain": EMAIL_DOMAIN}}],
                }
            ],
        }
        resp = api("POST", f"/accounts/{ACCOUNT}/access/apps", body)
        if not resp.get("success"):
            raise SystemExit(f"Access create failed for {host}: {resp}")
        print(f"[ok] Access app {host}")

    expr = (
        '(http.host eq "hris.greenpasture.ph") or '
        '(http.host eq "csm.greenpasture.ph") or '
        '(http.host eq "timekeep.greenpasture.ph")'
    )
    new_rule = {
        "action": "set_cache_settings",
        "expression": expr,
        "description": CACHE_DESC,
        "enabled": True,
        "action_parameters": {"cache": False},
    }

    # Ensure phase entrypoint exists, then set rules (preserve others).
    try:
        entry = api(
            "GET",
            f"/zones/{ZONE}/rulesets/phases/http_request_cache_settings/entrypoint",
        )
        rules = list((entry.get("result") or {}).get("rules") or [])
    except SystemExit as e:
        if "404" not in str(e):
            raise
        print("no cache phase entrypoint yet — creating ruleset")
        created = api(
            "POST",
            f"/zones/{ZONE}/rulesets",
            {
                "name": "GP cache settings",
                "kind": "zone",
                "phase": "http_request_cache_settings",
                "rules": [new_rule],
            },
        )
        if not created.get("success"):
            raise SystemExit(f"create ruleset failed: {created}")
        print("[ok] cache bypass ruleset created")
        print("Done.")
        return

    rules = [r for r in rules if r.get("description") != CACHE_DESC]
    rules.insert(0, new_rule)
    put = api(
        "PUT",
        f"/zones/{ZONE}/rulesets/phases/http_request_cache_settings/entrypoint",
        {"rules": rules},
    )
    if not put.get("success"):
        raise SystemExit(f"cache rules PUT failed: {put}")
    print("[ok] cache bypass rule deployed")
    print("Done.")
    print("Verify: incognito https://csm.greenpasture.ph → Access email prompt")
    print("        curl -sSI https://hris.greenpasture.ph/ | grep -i cf-cache-status")


if __name__ == "__main__":
    main()
    sys.exit(0)
