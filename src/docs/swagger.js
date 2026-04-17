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
    { name: "Auth" },
    { name: "Users" },
    { name: "Meals" },
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
      SavedMealPlan: {
        type: "object",
        properties: {
          id: { type: "integer", example: 18 },
          userId: { type: "integer", example: 27 },
          createdAt: { type: "string", format: "date-time" },
          plan: { $ref: "#/components/schemas/MealPlan" },
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
      PasswordResetRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", example: "jane@example.com" },
        },
      },
      PasswordResetConfirm: {
        type: "object",
        required: ["email", "otp", "newPassword"],
        properties: {
          email: { type: "string", example: "jane@example.com" },
          otp: { type: "string", example: "123456" },
          newPassword: { type: "string", example: "newpass123" },
        },
      },
    },
  },
  paths: {
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
    "/auth/password/reset/request": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset OTP",
        requestBody: {
          required: true,
          content: jsonContent(ref("PasswordResetRequest")),
        },
        responses: {
          200: {
            description: "Reset code sent if the account exists",
            content: jsonContent(ref("MessageResponse")),
          },
          429: {
            description: "Reset code requested too recently",
            content: jsonContent(ref("Error")),
          },
        },
      },
    },
    "/auth/password/reset/confirm": {
      post: {
        tags: ["Auth"],
        summary: "Confirm password reset with OTP",
        requestBody: {
          required: true,
          content: jsonContent(ref("PasswordResetConfirm")),
        },
        responses: {
          200: {
            description: "Password reset successfully",
            content: jsonContent(ref("MessageResponse")),
          },
          400: {
            description: "Invalid or expired reset code",
            content: jsonContent(ref("Error")),
          },
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
        summary: "Create user stats and auto-generate a daily meal plan",
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
        summary: "Update user stats and auto-regenerate the daily meal plan",
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
    "/users/data/export": {
      get: {
        tags: ["Users"],
        summary: "Export all user data",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Exported data" },
        },
      },
    },
    "/users/status": {
      delete: {
        tags: ["Users"],
        summary: "Deactivate user account",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Account deactivated" },
        },
      },
    },
    "/users/account": {
      delete: {
        tags: ["Users"],
        summary: "Delete user account",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Account deleted" },
        },
      },
    },
    "/users/weight-history": {
      get: {
        tags: ["Users"],
        summary: "Get weight history",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Weight history" },
        },
      },
    },
    "/meals/latest": {
      get: {
        tags: ["Meals"],
        summary: "Get the latest generated meal plan",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Latest meal plan",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: ref("SavedMealPlan"),
                  },
                },
              },
            },
          },
          404: {
            description: "Meal plan not found",
            content: jsonContent(ref("Error")),
          },
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
