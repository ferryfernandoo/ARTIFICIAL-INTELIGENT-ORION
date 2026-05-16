# ⚡ Quick Commands - Free Tier API

## Create Free Tier Customer
```powershell
$headers = @{
  "x-admin-key" = "admin_deepernova_secret_key_12345"
  "Content-Type" = "application/json"
}
$body = @{
  email = "user@example.com"
  name = "Free User"
  plan = "free"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/admin/customer/create" `
  -Method POST -Headers $headers -Body $body

$customer = $response.Content | ConvertFrom-Json
$customer.customer | ConvertTo-Json
```

## Make API Call (Free Tier)
```powershell
$apiKey = "deepernova_cust_XXXXX_YYYYY"  # From customer creation

$headers = @{
  "x-api-key" = $apiKey
  "Content-Type" = "application/json"
}

$body = @{
  model = "deepernova-full"
  messages = @(
    @{ role = "user"; content = "Halo!" }
  )
} | ConvertTo-Json

try {
  $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/chat/completions" `
    -Method POST -Headers $headers -Body $body
  $response.Content | ConvertFrom-Json | ConvertTo-Json
} catch {
  $_.Exception.Response.StatusCode
  $_.Exception.Message
}
```

## Check Free Tier Status
```powershell
$apiKey = "deepernova_cust_XXXXX_YYYYY"

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/billing/dashboard" `
  -Headers @{ "x-api-key" = $apiKey }

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

## View Admin Revenue
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/admin/revenue" `
  -Headers @{ "x-admin-key" = "admin_deepernova_secret_key_12345" }

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

---

## Test Responses

### Successful Request (Within Free Limit)
```json
{
  "model": "deepernova-full",
  "choices": [
    {
      "message": {
        "content": "Halo! Saya adalah Orion, asisten dari DeepernNova..."
      }
    }
  ],
  "usage": {
    "total_tokens": 17
  }
}
```

### Daily Limit Exceeded Error
```json
{
  "error": "Daily request limit (5/day) exceeded",
  "error_code": "DAILY_LIMIT_EXCEEDED"
}
```

### Dashboard Response (Free Tier)
```json
{
  "customer": {
    "id": "cust_276e2bed-351",
    "name": "Free User",
    "plan": "free",
    "status": "active"
  },
  "billing": {
    "plan": "free",
    "costThisMonth": "$0.00",
    "requestsToday": 5,
    "dailyLimit": 5,
    "dailyLimitRemaining": 0,
    "dailyWarning": true,
    "requestsThisMonth": 5,
    "status": "active"
  }
}
```

---

## Tier Plans

### Free (5 requests/day)
- Create with: `plan: "free"`
- No billing
- 5 requests per day
- Daily reset

### Starter ($9.99/month)
- Create with: `plan: "starter"`
- 100,000 tokens per month
- Unlimited daily requests
- Billed monthly

### Pro ($49.99/month)
- Create with: `plan: "pro"`
- 1,000,000 tokens per month
- Unlimited daily requests
- Billed monthly
