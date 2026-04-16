const swaggerJSDoc = require("swagger-jsdoc");

const jsonContent = (schema) => ({
  "application/json": {
    schema,
  },
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AI Diet Planner API",
    version: "1.0.0",
    description: "API documentation for the diet planner backend",
  },
  servers: [
    {
      url: "/api",
      description: "API base path",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Diet" },
    { name: "Meals" },
    { name: "Nutrition" },
    { name: "Chatbot" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Validation failed" },
          details: { type: "array", nullable: true, items: {} },
        },
      },
      MessageResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Jane Doe" },
          email: { type: "string", example: "jane@example.com" },
          isEmailVerified: { type: "boolean", example: true },
          isPremium: { type: "boolean", example: false },
          isActive: { type: "boolean", example: true },
          profileImageUrl: {
            type: "string",
            nullable: true,
            example: "/uploads/profile-images/example.jpg",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      NutritionProfile: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          userId: { type: "integer", example: 27 },
          age: { type: "integer", nullable: true, example: 28 },
          gender: { type: "string", nullable: true, example: "female" },
          activityLevel: {
            type: "string",
            nullable: true,
            example: "moderate",
          },
          goal: { type: "string", nullable: true, example: "maintain" },
          heightCm: { type: "number", nullable: true, example: 168 },
          weightKg: { type: "number", nullable: true, example: 65 },
          mealPreferences: {
            type: "array",
            items: { type: "string" },
            example: ["high-protein"],
          },
          mealAllergies: {
            type: "array",
            items: { type: "string" },
            example: ["peanuts"],
          },
          mealDislikes: {
            type: "array",
            items: { type: "string" },
            example: ["okra"],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      DietCalcInput: {
        type: "object",
        required: [
          "age",
          "gender",
          "weight",
          "height",
          "activityLevel",
          "goal",
        ],
        properties: {
          age: { type: "integer", example: 28 },
          gender: {
            type: "string",
            enum: ["male", "female"],
            example: "female",
          },
          weight: { type: "number", example: 65 },
          height: { type: "number", example: 168 },
          activityLevel: {
            type: "string",
            enum: ["sedentary", "light", "moderate", "active", "very_active"],
            example: "moderate",
          },
          goal: {
            type: "string",
            enum: ["loss", "gain", "maintain"],
            example: "maintain",
          },
        },
      },
      DietCalcResult: {
        type: "object",
        properties: {
          bmr: { type: "integer", example: 1424 },
          tdee: { type: "integer", example: 2200 },
          targetCalories: { type: "integer", example: 2000 },
          macros: {
            type: "object",
            properties: {
              protein: { type: "integer", example: 150 },
              carbs: { type: "integer", example: 225 },
              fats: { type: "integer", example: 67 },
            },
          },
        },
      },
      MealFoodItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 11 },
          name: { type: "string", example: "Chicken Salad Bowl" },
          calories: { type: "integer", example: 420 },
          protein: { type: "integer", example: 35 },
          carbs: { type: "integer", example: 20 },
          fats: { type: "integer", example: 18 },
          category: { type: "string", example: "lunch" },
          dietType: { type: "string", example: "balanced" },
          ingredients: { type: "array", items: { type: "string" } },
          instructions: { type: "array", items: { type: "string" } },
        },
      },
      MealSelection: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: ref("MealFoodItem"),
          },
          totals: {
            type: "object",
            properties: {
              calories: { type: "integer", example: 420 },
              protein: { type: "integer", example: 35 },
              carbs: { type: "integer", example: 20 },
              fats: { type: "integer", example: 18 },
            },
          },
        },
      },
      MealTargets: {
        type: "object",
        properties: {
          breakfast: { type: "number", example: 600 },
          lunch: { type: "number", example: 700 },
          dinner: { type: "number", example: 700 },
          snacks: {
            type: "array",
            items: { type: "number" },
            example: [300],
          },
        },
      },
      MealPlan: {
        type: "object",
        properties: {
          nutrition: {
            type: "object",
            properties: {
              source: { type: "string", example: "user_profile" },
              targetCalories: { type: "integer", example: 2000 },
              macros: {
                type: "object",
                properties: {
                  protein: { type: "integer", example: 150 },
                  carbs: { type: "integer", example: 225 },
                  fats: { type: "integer", example: 67 },
                },
              },
              mealPreferences: { type: "array", items: { type: "string" } },
              mealAllergies: { type: "array", items: { type: "string" } },
              mealDislikes: { type: "array", items: { type: "string" } },
              mealsCount: { type: "integer", example: 3 },
            },
          },
          mealTargets: { $ref: "#/components/schemas/MealTargets" },
          breakfast: { $ref: "#/components/schemas/MealSelection" },
          lunch: { $ref: "#/components/schemas/MealSelection" },
          dinner: { $ref: "#/components/schemas/MealSelection" },
          snacks: {
            type: "array",
            items: ref("MealSelection"),
          },
          alternatives: {
            type: "object",
            properties: {
              breakfast: { type: "array", items: ref("MealFoodItem") },
              lunch: { type: "array", items: ref("MealFoodItem") },
              dinner: { type: "array", items: ref("MealFoodItem") },
              snacks: { type: "array", items: ref("MealFoodItem") },
            },
          },
          aiSuggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                calories: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fats: { type: "number" },
              },
            },
          },
          cached: { type: "boolean", example: false },
        },
      },
      HealthPayload: {
        type: "object",
        properties: {
          age: { type: "integer", nullable: true, example: 28 },
          gender: { type: "string", nullable: true, example: "female" },
          activityLevel: {
            type: "string",
            nullable: true,
            example: "moderate",
          },
          goal: { type: "string", nullable: true, example: "maintain" },
          heightCm: { type: "number", nullable: true, example: 168 },
          weightKg: { type: "number", nullable: true, example: 65 },
          mealPreferences: {
            type: "array",
            items: { type: "string" },
            example: ["balanced"],
          },
          mealAllergies: {
            type: "array",
            items: { type: "string" },
            example: ["peanut"],
          },
          mealDislikes: {
            type: "array",
            items: { type: "string" },
            example: ["okra"],
          },
        },
      },
      MealGenerationInput: {
        type: "object",
        properties: {
          calories: {
            type: "number",
            minimum: 800,
            maximum: 6000,
            example: 2000,
          },
          targetCalories: {
            type: "number",
            minimum: 800,
            maximum: 6000,
            example: 2000,
          },
          dietType: { type: "string", example: "balanced" },
          allergies: {
            type: "array",
            items: { type: "string" },
            example: ["peanut"],
          },
          mealDislikes: {
            type: "array",
            items: { type: "string" },
            example: ["okra"],
          },
          mealsCount: { type: "integer", enum: [3, 4, 5], example: 3 },
        },
      },
      MealAlternativesInput: {
        type: "object",
        required: ["mealType"],
        properties: {
          calories: {
            type: "number",
            minimum: 800,
            maximum: 6000,
            example: 2000,
          },
          targetCalories: {
            type: "number",
            minimum: 800,
            maximum: 6000,
            example: 2000,
          },
          dietType: { type: "string", example: "any" },
          allergies: { type: "array", items: { type: "string" }, example: [] },
          mealDislikes: {
            type: "array",
            items: { type: "string" },
            example: [],
          },
          mealType: {
            type: "string",
            enum: ["breakfast", "lunch", "dinner", "snack"],
            example: "lunch",
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register and send OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", example: "Jane Doe" },
                  email: { type: "string", example: "jane@example.com" },
                  password: { type: "string", example: "secret123" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "OTP sent",
            content: jsonContent(ref("MessageResponse")),
          },
        },
      },
    },
    "/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify registration OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp"],
                properties: {
                  email: { type: "string", example: "jane@example.com" },
                  otp: { type: "string", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Account created",
            content: jsonContent(ref("MessageResponse")),
          },
        },
      },
    },
    "/auth/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Resend verification OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", example: "jane@example.com" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "OTP sent",
            content: jsonContent(ref("MessageResponse")),
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "jane@example.com" },
                  password: { type: "string", example: "secret123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "JWT issued" },
        },
      },
    },
    "/auth/password/update": {
      put: {
        tags: ["Auth"],
        summary: "Update password",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string", example: "secret123" },
                  newPassword: { type: "string", example: "newpass123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password updated" },
        },
      },
    },
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: ref("User"),
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update user profile",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Jane Doe" },
                  profileImage: { type: "string", format: "binary" },
                },
              },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Jane Doe" },
                  profileImageUrl: {
                    type: "string",
                    example: "/uploads/profile-images/example.jpg",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "User updated",
            content: {
              "application/json": {
                schema: ref("MessageResponse"),
              },
            },
          },
        },
      },
    },
    "/users/profile": {
      get: {
        tags: ["Users"],
        summary: "Get nutrition profile",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Nutrition profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: ref("NutritionProfile"),
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create nutrition profile",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("HealthPayload")),
        },
        responses: {
          201: {
            description: "Profile created",
            content: jsonContent(ref("NutritionProfile")),
          },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update nutrition profile",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("HealthPayload")),
        },
        responses: {
          200: {
            description: "Profile updated",
            content: jsonContent(ref("NutritionProfile")),
          },
        },
      },
    },
    "/users/stats": {
      get: {
        tags: ["Users"],
        summary: "Get user stats",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: ref("NutritionProfile"),
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create user stats",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("HealthPayload")),
        },
        responses: {
          201: {
            description: "Stats created",
            content: jsonContent(ref("NutritionProfile")),
          },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update user stats",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("HealthPayload")),
        },
        responses: {
          200: {
            description: "Stats updated",
            content: jsonContent(ref("NutritionProfile")),
          },
        },
      },
    },
    "/diet/calculate": {
      post: {
        tags: ["Diet"],
        summary: "Calculate BMR, TDEE, target calories, and macros",
        requestBody: {
          required: true,
          content: jsonContent(ref("DietCalcInput")),
        },
        responses: {
          200: {
            description: "Calculation result",
            content: jsonContent(ref("DietCalcResult")),
          },
        },
      },
    },
    "/diet/plan": {
      post: {
        tags: ["Diet"],
        summary: "Save long-term diet plan",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                example: {
                  planName: "8 Week Cut",
                  weeks: 8,
                  notes: "High protein focus",
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Plan saved" },
        },
      },
    },
    "/diet/plan/latest": {
      get: {
        tags: ["Diet"],
        summary: "Get latest saved diet plan",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Latest plan" },
        },
      },
    },
    "/meals/generate": {
      post: {
        tags: ["Meals"],
        summary: "Generate a daily meal plan from user stats and MySQL foods",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: jsonContent(ref("MealGenerationInput")),
        },
        responses: {
          201: {
            description: "Meal plan generated",
            content: jsonContent(ref("MealPlan")),
          },
          422: {
            description: "Incomplete nutrition profile",
            content: jsonContent(ref("Error")),
          },
        },
      },
    },
    "/meals/alternatives": {
      post: {
        tags: ["Meals"],
        summary: "Get alternative foods for a meal type",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("MealAlternativesInput")),
        },
        responses: {
          200: {
            description: "Alternative foods",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: ref("MealFoodItem"),
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/nutrition/log": {
      post: {
        tags: ["Nutrition"],
        summary: "Log a meal and update calorie progress",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "targetCalories"],
                properties: {
                  name: { type: "string", example: "Chicken Salad" },
                  calories: { type: "number", example: 350 },
                  protein: { type: "number", example: 30 },
                  carbs: { type: "number", example: 20 },
                  fats: { type: "number", example: 10 },
                  targetCalories: { type: "number", example: 2000 },
                  date: { type: "string", example: "2026-04-03T12:00:00.000Z" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Meal logged" },
        },
      },
    },
    "/nutrition/daily": {
      get: {
        tags: ["Nutrition"],
        summary: "Get daily summary",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Daily summary" },
        },
      },
    },
    "/ai/chat": {
      post: {
        tags: ["Chatbot"],
        summary: "AI nutrition assistant",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: { type: "string", example: "Generate a meal plan" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "AI response" },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [],
});

module.exports = { swaggerSpec };
