# API Documentation (Frontend Integration Guide)

Base URL: `http://localhost:4000/api`  
All requests/response bodies are JSON unless otherwise stated.

**Headers**

- `Content-Type: application/json`
- Protected routes require: `Authorization: Bearer <JWT>`

**Standard Error Response**

```json
{
  "success": false,
  "message": "Error message",
  "details": null
}
```

---

## Health

**GET `/health`**  
Purpose: Server health check  
Payload: none  
Response:

```json
{ "success": true, "status": "ok", "timestamp": "2026-04-03T12:00:00.000Z" }
```

---

## Auth

**POST `/auth/register`**  
Purpose: Register a user and send OTP  
Payload:

```json
{ "name": "test", "email": "test@example.com", "password": "secret123" }
```

Response (201):

```json
{
  "success": true,
  "data": {
    "user": {
      "name": "test",
      "email": "test@example.com",
      "isEmailVerified": false,
      "isPremium": false
    },
    "requiresOtp": true
  }
}
```

**POST `/auth/login`**  
Purpose: Login verified users  
Payload:

```json
{ "email": "test@example.com", "password": "secret123" }
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "test",
      "email": "test@example.com",
      "isPremium": false
    },
    "token": "JWT_TOKEN_HERE"
  }
}
```

**POST `/auth/verify-otp`**  
Purpose: Verify OTP and activate account  
Payload:

```json
{ "email": "test@example.com", "otp": "123456" }
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "test",
      "email": "test@example.com",
      "isPremium": false
    },
    "token": "JWT_TOKEN_HERE"
  }
}
```

**POST `/auth/resend-otp`**  
Purpose: Resend OTP to email  
Payload:

```json
{ "email": "test@example.com" }
```

Response:

```json
{ "success": true, "data": { "message": "OTP sent to email" } }
```

---

## User (Protected)

**GET `/users/me`**  
Purpose: Get user basic profile  
Payload: none  
Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "test",
    "email": "test@example.com",
    "isEmailVerified": true,
    "isPremium": false,
    "isActive": true,
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

**PATCH `/users/me`**  
Purpose: Update name/password  
Payload:

```json
{ "name": "test", "password": "newpass123" }
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "test",
    "email": "test@example.com",
    "isEmailVerified": true,
    "isPremium": false,
    "isActive": true,
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T11:00:00.000Z"
  }
}
```

<!--
**PATCH `/users/status`**
Purpose: Activate/inactivate user
Payload:

```json
{ "isActive": false }
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "test",
    "email": "test@example.com",
    "isEmailVerified": true,
    "isPremium": false,
    "isActive": false,
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T11:10:00.000Z"
  }
}
```
-->

---

## Unified Health (Protected)

**GET `/users/health`**  
Purpose: Get combined health profile + stats  
Payload: none  
Response:

```json
{
  "success": true,
  "data": {
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "loss",
    "heightCm": 178,
    "weightKg": 74,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"]
  }
}
```

**POST `/users/health`**  
Purpose: Create combined health data (profile + stats)  
Payload:

```json
{
  "age": 28,
  "gender": "male",
  "activityLevel": "moderate",
  "goal": "loss",
  "heightCm": 178,
  "weightKg": 74,
  "mealPreferences": ["high-protein"],
  "mealAllergies": ["peanuts"]
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "loss",
    "heightCm": 178,
    "weightKg": 74,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"]
  }
}
```

**PATCH `/users/health`**  
Purpose: Update combined health data  
Payload:

```json
{ "goal": "maintain", "weightKg": 72 }
```

Response:

```json
{
  "success": true,
  "data": {
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "maintain",
    "heightCm": 178,
    "weightKg": 72,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"]
  }
}
```

---

## Health Profile (Protected)

Deprecated: Use `/users/health`.

**GET `/users/profile`**  
Purpose: Get the full nutrition profile  
Payload: none  
Response:

```json
{
  "success": true,
  "data": {
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "loss",
    "heightCm": 178,
    "weightKg": 72,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"]
  }
}
```

**POST `/users/profile`**  
Purpose: Create the full nutrition profile  
Payload:

```json
{
  "age": 28,
  "gender": "male",
  "activityLevel": "moderate",
  "goal": "loss",
  "heightCm": 178,
  "weightKg": 72,
  "mealPreferences": ["high-protein"],
  "mealAllergies": ["peanuts"],
  "mealDislikes": ["okra"]
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "loss",
    "heightCm": 178,
    "weightKg": 72,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"],
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

**PATCH `/users/profile`**  
Purpose: Update the full nutrition profile  
Payload:

```json
{
  "goal": "maintain",
  "weightKg": 70
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "maintain",
    "heightCm": 178,
    "weightKg": 70,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"]
  }
}
```

---

## User Stats (Protected)

Deprecated: Use `/users/health`.

**GET `/users/stats`**  
Purpose: Get the full nutrition profile  
Payload: none  
Response:

```json
{
  "success": true,
  "data": {
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "maintain",
    "heightCm": 178,
    "weightKg": 74,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"]
  }
}
```

**POST `/users/stats`**  
Purpose: Create the full nutrition profile (first time)  
Payload:

```json
{
  "age": 28,
  "gender": "male",
  "activityLevel": "moderate",
  "goal": "maintain",
  "heightCm": 178,
  "weightKg": 74,
  "mealPreferences": ["high-protein"],
  "mealAllergies": ["peanuts"],
  "mealDislikes": ["okra"]
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "maintain",
    "heightCm": 178,
    "weightKg": 74,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"],
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

**PATCH `/users/stats`**  
Purpose: Update the full nutrition profile  
Payload:

```json
{
  "age": 28,
  "goal": "maintain",
  "weightKg": 72
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "age": 28,
    "gender": "male",
    "activityLevel": "moderate",
    "goal": "maintain",
    "heightCm": 178,
    "weightKg": 72,
    "mealPreferences": ["high-protein"],
    "mealAllergies": ["peanuts"],
    "mealDislikes": ["okra"]
  }
}
```

**GET `/users/weight-history`**  
Purpose: Weight trend history  
Query params: `?start=YYYY-MM-DD&end=YYYY-MM-DD` (optional)  
Response:

```json
{
  "success": true,
  "data": [
    { "id": 1, "weightKg": 74, "loggedAt": "2026-04-03T10:00:00.000Z" },
    { "id": 2, "weightKg": 72, "loggedAt": "2026-04-10T10:00:00.000Z" }
  ]
}
```

---

## GDPR / Data (Protected)

**GET `/users/data/export`**  
Purpose: Export all user data  
Payload: none  
Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "test",
      "email": "test@example.com",
      "isPremium": false
    },
    "stats": { "heightCm": 178, "weightKg": 72 },
    "profile": { "age": 28, "goal": "maintain" },
    "nutritionLogs": [],
    "nutritionProgress": [],
    "reminders": [],
    "consultations": [],
    "dietPlans": [],
    "weightLogs": []
  }
}
```

**DELETE `/users/status`**  
Purpose: Deactivate user account  
Payload: none  
Response:

```json
{
  "success": true,
  "data": {
    "message": "Account is deactivated"
  }
}
```

---

## Diet

**POST `/diet/calculate`**  
Purpose: Calculate BMR/TDEE/macros  
Payload:

```json
{
  "age": 28,
  "gender": "male",
  "weight": 74,
  "height": 178,
  "activityLevel": "moderate",
  "goal": "loss"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "bmr": 1700,
    "tdee": 2635,
    "targetCalories": 2200,
    "macros": { "protein": 193, "carbs": 220, "fats": 61 }
  }
}
```

**POST `/diet/plan`** _(Premium)_  
Purpose: Save long-term plan  
Payload:

```json
{ "planName": "8 Week Cut", "weeks": 8, "notes": "High protein focus" }
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "plan": {
      "planName": "8 Week Cut",
      "weeks": 8,
      "notes": "High protein focus"
    }
  }
}
```

**GET `/diet/plan/latest`** _(Premium)_  
Purpose: Fetch latest saved plan  
Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "plan": {
      "planName": "8 Week Cut",
      "weeks": 8,
      "notes": "High protein focus"
    }
  }
}
```

---

## Meals (Protected)

**POST `/meals/generate`**  
Purpose: Generate daily meal plan  
Payload:

```json
{
  "calories": 2000,
  "dietType": "any",
  "allergies": ["peanuts"],
  "mealsCount": 3
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "Meal plan generated successfully."
  }
}
```

**POST `/meals/alternatives`**  
Purpose: Get replacement options  
Payload:

```json
{ "calories": 2000, "dietType": "any", "allergies": [], "mealType": "lunch" }
```

Response:

```json
{
  "success": true,
  "data": [
    /* foods */
  ]
}
```

---

## Nutrition (Protected)

**POST `/nutrition/log`**  
Purpose: Log meal + update calorie progress  
Payload:

```json
{
  "name": "Chicken Salad",
  "calories": 350,
  "protein": 30,
  "carbs": 20,
  "fats": 10,
  "targetCalories": 2000,
  "date": "2026-04-03T12:00:00.000Z"
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "name": "Chicken Salad",
        "calories": 350,
        "protein": 30,
        "carbs": 20,
        "fats": 10,
        "loggedAt": "2026-04-03T12:00:00.000Z"
      }
    ],
    "progress": {
      "date": "2026-04-03",
      "targetCalories": 2000,
      "consumedCalories": 350
    }
  }
}
```

**GET `/nutrition/daily`**  
Purpose: Daily summary  
Query: `?date=YYYY-MM-DD`  
Response:

```json
{
  "success": true,
  "data": {
    "date": "2026-04-03",
    "consumedCalories": 900,
    "targetCalories": 2000,
    "logs": []
  }
}
```

**GET `/nutrition/analysis`**  
Purpose: Daily status (under/over/on track)  
Query: `?date=YYYY-MM-DD`  
Response:

```json
{
  "success": true,
  "data": {
    "date": "2026-04-03",
    "status": "on_track",
    "consumedCalories": 1900,
    "targetCalories": 2000
  }
}
```

**GET `/nutrition/summary`**  
Purpose: Weekly/monthly/yearly summary  
Query: `?period=weekly|monthly|yearly&date=YYYY-MM-DD`  
Response:

```json
{
  "success": true,
  "data": {
    "period": "weekly",
    "start": "2026-04-01",
    "end": "2026-04-07",
    "consumedCalories": 12000,
    "targetCalories": 14000,
    "logs": []
  }
}
```

**GET `/nutrition/analysis-range`**  
Purpose: Range analysis status  
Query: `?period=weekly|monthly|yearly&date=YYYY-MM-DD`  
Response:

```json
{
  "success": true,
  "data": {
    "period": "weekly",
    "start": "2026-04-01",
    "end": "2026-04-07",
    "status": "under_eating",
    "consumedCalories": 9000,
    "targetCalories": 14000
  }
}
```

**GET `/nutrition/missed-targets`**  
Purpose: Missed calorie goals in range  
Query: `?period=weekly|monthly|yearly&date=YYYY-MM-DD`  
Response:

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-04-03",
      "consumedCalories": 1500,
      "targetCalories": 2000,
      "deficit": 500
    }
  ]
}
```

---

## Chatbot

**POST `/ai/chat`**  
Purpose: AI nutrition assistant  
Payload:

```json
{ "message": "Give me a high protein meal plan" }
```

Response:

```json
{
  "success": true,
  "data": {
    "intent": "meal_generation",
    "response": {
      /* varies */
    }
  }
}
```

Rate limit response:

```json
{
  "success": false,
  "message": "Chat limit reached for today.",
  "details": { "limit": 5 }
}
```

---

## Reminders (Protected)

**GET `/reminders`**  
Purpose: List reminders  
Payload: none  
Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "nutrition",
      "message": "Log dinner",
      "scheduledAt": "2026-04-03T20:00:00.000Z",
      "enabled": true
    }
  ]
}
```

**POST `/reminders`**  
Purpose: Create reminder  
Payload:

```json
{
  "type": "nutrition",
  "message": "Log your dinner",
  "scheduledAt": "2026-04-03T20:00:00.000Z",
  "enabled": true
}
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "nutrition",
    "message": "Log your dinner",
    "scheduledAt": "2026-04-03T20:00:00.000Z",
    "enabled": true
  }
}
```

**PATCH `/reminders/:id`**  
Purpose: Update reminder  
Payload:

```json
{ "enabled": false }
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "nutrition",
    "message": "Log your dinner",
    "scheduledAt": "2026-04-03T20:00:00.000Z",
    "enabled": false
  }
}
```

**DELETE `/reminders/:id`**  
Purpose: Delete reminder  
Payload: none  
Response:

```json
{ "success": true, "data": { "message": "Reminder deleted" } }
```

---

## Consultations (Premium)

**POST `/consultations/request`**  
Purpose: Request expert consultation  
Payload:

```json
{ "topic": "Weight loss plan", "notes": "Need help with macros" }
```

Response (201):

```json
{
  "success": true,
  "data": { "id": 1, "topic": "Weight loss plan", "status": "pending" }
}
```

**GET `/consultations/mine`**  
Purpose: List user consultations  
Payload: none  
Response:

```json
{
  "success": true,
  "data": [{ "id": 1, "topic": "Weight loss plan", "status": "pending" }]
}
```
