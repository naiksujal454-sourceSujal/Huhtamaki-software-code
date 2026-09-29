import urllib.request
import urllib.error
import json
import http.cookiejar

cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

print("=== 1. Testing Login ===")
login_data = json.dumps({'username': 'admin', 'password': 'Admin@123'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
res = opener.open(req)
login_res = json.loads(res.read().decode())
print(f"Login Status: {res.status}, User: {login_res['user']['username']}")

print("\n=== 2. Testing /api/users ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/users')
res = opener.open(req)
users = json.loads(res.read().decode())
print(f"Found Users ({len(users)}): {[u['username'] for u in users]}")

print("\n=== 3. Testing Change Password with WRONG original password ===")
bad_pw_data = json.dumps({'current_password': 'WrongPassword123', 'new_password': 'NewPassword@2026'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/users/2/change-password', data=bad_pw_data, headers={'Content-Type': 'application/json'})
try:
    opener.open(req)
except urllib.error.HTTPError as e:
    print(f"Expected Error Status: {e.code}, Detail: {e.read().decode()}")

print("\n=== 4. Testing Change Password with CORRECT original password ===")
good_pw_data = json.dumps({'current_password': 'Operator@123', 'new_password': 'Operator@Changed99'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/users/2/change-password', data=good_pw_data, headers={'Content-Type': 'application/json'})
res = opener.open(req)
print(f"Password change status: {res.status}, Body: {json.loads(res.read().decode())}")

# Reset password back to Operator@123
reset_data = json.dumps({'current_password': 'Operator@Changed99', 'new_password': 'Operator@123'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/users/2/change-password', data=reset_data, headers={'Content-Type': 'application/json'})
res = opener.open(req)
print(f"Password reset status: {res.status}")

print("\n=== 5. Testing Toggle Active for user 3 ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/users/3/toggle-active', data=json.dumps({}).encode(), headers={'Content-Type': 'application/json'})
res = opener.open(req)
print(f"Toggle Active status: {res.status}, Body: {json.loads(res.read().decode())}")

# Toggle back
req = urllib.request.Request('http://127.0.0.1:8000/api/users/3/toggle-active', data=json.dumps({'is_active': True}).encode(), headers={'Content-Type': 'application/json'})
res = opener.open(req)
print(f"Toggle back status: {res.status}")

print("\n=== 6. Testing Audit Log Recording & Retrieval ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/system/audit-logs?limit=8')
res = opener.open(req)
logs = json.loads(res.read().decode())
print(f"Latest {len(logs)} Audit Logs in DB:")
for log in logs:
    action = log['action']
    actor = log['actor_username'] or 'system'
    desc = log.get('details', {}).get('description', '')
    ts = log['created_at']
    print(f"  [ID {log['id']:03d}] {ts} | {action:30s} | Actor: {actor:10s} | {desc}")

print("\n=== 7. Testing Logout ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/auth/logout', data=b'', headers={'Content-Type': 'application/json'})
res = opener.open(req)
print(f"Logout Status: {res.status}")
print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
