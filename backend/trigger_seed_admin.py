import requests

url = "http://127.0.0.1:5000/api/admin/seed-admin"
response = requests.post(url)

print("Status Code:", response.status_code)
try:
    print("Response JSON:", response.json())
except Exception:
    print("Raw Response:", response.text)
