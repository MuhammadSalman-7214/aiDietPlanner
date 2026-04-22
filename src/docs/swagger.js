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
    // { name: "Diet" },
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
      MealItemAlternativeChoice: {
        type: "object",
        properties: {
          id: { type: "integer", example: 295 },
          name: { type: "string", example: "Tofu, firm, prepared with calcium sulfate" },
          calories: { type: "number", example: 76 },
          protein: { type: "number", example: 8 },
          carbs: { type: "number", example: 2 },
          fats: { type: "number", example: 4 },
          matchScore: { type: "number", example: 79.7 },
          macroDelta: {
            type: "object",
            properties: {
              calories: { type: "number", example: -14 },
              protein: { type: "number", example: 2 },
              carbs: { type: "number", example: 0 },
              fats: { type: "number", example: -2 },
            },
          },
        },
      },
      MealPreviewDelta: {
        type: "object",
        properties: {
          calories: { type: "number", example: -14 },
          protein: { type: "number", example: 2 },
          carbs: { type: "number", example: 0 },
          fats: { type: "number", example: -2 },
        },
      },
      MealMacroTotals: {
        type: "object",
        properties: {
          calories: { type: "number", example: 711 },
          protein: { type: "number", example: 18 },
          carbs: { type: "number", example: 59 },
          fats: { type: "number", example: 45 },
        },
      },
      MealAlternativePreviewImpact: {
        type: "object",
        properties: {
          itemDelta: { $ref: "#/components/schemas/MealPreviewDelta" },
          mealDelta: { $ref: "#/components/schemas/MealPreviewDelta" },
          dayDelta: { $ref: "#/components/schemas/MealPreviewDelta" },
        },
      },
      MealAlternativePreviewTotals: {
        type: "object",
        properties: {
          meal: { $ref: "#/components/schemas/MealMacroTotals" },
          day: { $ref: "#/components/schemas/MealMacroTotals" },
        },
      },
      MealComponentAlternative: {
        type: "object",
        properties: {
          originalItemId: { type: "integer", example: 294 },
          originalItemName: { type: "string", example: "Bagels, egg" },
          replaceableComponent: { type: "string", nullable: true, example: "egg" },
          alternatives: {
            type: "array",
            items: ref("MealItemAlternativeChoice"),
          },
          recommended: {
            allOf: [ref("MealItemAlternativeChoice")],
            nullable: true,
          },
          previewImpact: { $ref: "#/components/schemas/MealAlternativePreviewImpact" },
          previewTotals: { $ref: "#/components/schemas/MealAlternativePreviewTotals" },
          reason: { type: "string", nullable: true, example: "no_valid_usda_match" },
        },
      },
      MealItemAlternative: {
        type: "object",
        properties: {
          itemId: { type: "integer", example: 294 },
          itemName: { type: "string", example: "Bagels, egg" },
          category: { type: "string", example: "breakfast" },
          currentItem: { $ref: "#/components/schemas/MealFoodItem" },
          components: {
            type: "array",
            items: ref("MealComponentAlternative"),
          },
        },
      },
      MealItemAlternativeSummary: {
        type: "object",
        properties: {
          itemId: { type: "integer", example: 294 },
          itemName: { type: "string", example: "Bagels, egg" },
          category: { type: "string", example: "breakfast" },
          currentItem: { $ref: "#/components/schemas/MealFoodItem" },
          currentMacros: { $ref: "#/components/schemas/MealMacroTotals" },
          replacementComponents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                component: { type: "string", nullable: true, example: "egg" },
                recommended: {
                  allOf: [ref("MealItemAlternativeChoice")],
                  nullable: true,
                },
                totalMatches: { type: "integer", example: 3 },
                bestMatches: {
                  type: "array",
                  items: {
                    allOf: [ref("MealItemAlternativeChoice")],
                    properties: {
                      rank: { type: "integer", example: 1 },
                    },
                  },
                },
                previewImpact: { $ref: "#/components/schemas/MealAlternativePreviewImpact" },
                previewTotals: { $ref: "#/components/schemas/MealAlternativePreviewTotals" },
                reason: { type: "string", nullable: true, example: null },
              },
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
              breakfast: { type: "array", items: ref("MealItemAlternative") },
              lunch: { type: "array", items: ref("MealItemAlternative") },
              dinner: { type: "array", items: ref("MealItemAlternative") },
              snacks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    mealIndex: { type: "integer", example: 1 },
                    items: { type: "array", items: ref("MealItemAlternative") },
                  },
                },
              },
              generatedAt: { type: "string", format: "date-time" },
              source: { type: "string", example: "user_meal_plan" },
            },
          },
          alternativeSummary: {
            type: "object",
            properties: {
              breakfast: { type: "array", items: ref("MealItemAlternativeSummary") },
              lunch: { type: "array", items: ref("MealItemAlternativeSummary") },
              dinner: { type: "array", items: ref("MealItemAlternativeSummary") },
              snacks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    mealIndex: { type: "integer", example: 1 },
                    items: { type: "array", items: ref("MealItemAlternativeSummary") },
                  },
                },
              },
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
          updatedAt: { type: "string", format: "date-time", nullable: true },
          plan: { $ref: "#/components/schemas/MealPlan" },
        },
      },
      LatestMealPlanResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { $ref: "#/components/schemas/SavedMealPlan" },
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
    // "/diet/calculate": {
    //   post: {
    //     tags: ["Diet"],
    //     summary: "Calculate diet targets from age, gender, weight, height and activity",
    //     requestBody: {
    //       required: true,
    //       content: {
    //         "application/json": {
    //           schema: {
    //             type: "object",
    //             required: ["age", "gender", "weight", "height", "activityLevel", "goal"],
    //             properties: {
    //               age: { type: "integer", example: 28 },
    //               gender: { type: "string", enum: ["male", "female"], example: "female" },
    //               weight: { type: "number", example: 65 },
    //               height: { type: "number", example: 168 },
    //               activityLevel: {
    //                 type: "string",
    //                 enum: ["sedentary", "light", "moderate", "active", "very_active"],
    //                 example: "moderate",
    //               },
    //               goal: { type: "string", enum: ["loss", "gain", "maintain"], example: "maintain" },
    //             },
    //           },
    //         },
    //       },
    //     },
    //     responses: {
    //       200: {
    //         description: "Diet calculation result",
    //         content: {
    //           "application/json": {
    //             schema: {
    //               type: "object",
    //               properties: {
    //                 success: { type: "boolean" },
    //                 data: {
    //                   type: "object",
    //                   properties: {
    //                     bmr: { type: "integer", example: 1450 },
    //                     tdee: { type: "integer", example: 2100 },
    //                     targetCalories: { type: "integer", example: 1800 },
    //                     macros: {
    //                       type: "object",
    //                       properties: {
    //                         protein: { type: "integer", example: 135 },
    //                         carbs: { type: "integer", example: 203 },
    //                         fats: { type: "integer", example: 60 },
    //                       },
    //                     },
    //                   },
    //                 },
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    // },
    // "/diet/plan": {
    //   post: {
    //     tags: ["Diet"],
    //     summary: "Save a diet plan for the current user",
    //     security: [{ BearerAuth: [] }],
    //     requestBody: {
    //       required: true,
    //       content: {
    //         "application/json": {
    //           schema: {
    //             type: "object",
    //             minProperties: 1,
    //             example: {
    //               nutrition: {
    //                 source: "manual_override",
    //                 targetCalories: 2000,
    //                 macros: { protein: 150, carbs: 225, fats: 67 },
    //                 mealsCount: 3,
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //     responses: {
    //       201: {
    //         description: "Plan saved",
    //         content: {
    //           "application/json": {
    //             schema: {
    //               type: "object",
    //               properties: {
    //                 success: { type: "boolean" },
    //                 data: ref("SavedMealPlan"),
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    // },
    // "/diet/plan/latest": {
    //   get: {
    //     tags: ["Diet"],
    //     summary: "Get the latest saved diet plan",
    //     security: [{ BearerAuth: [] }],
    //     responses: {
    //       200: {
    //         description: "Latest diet plan",
    //         content: {
    //           "application/json": {
    //             schema: {
    //               type: "object",
    //               properties: {
    //                 success: { type: "boolean" },
    //                 data: ref("SavedMealPlan"),
    //               },
    //             },
    //           },
    //         },
    //       },
    //       404: {
    //         description: "Diet plan not found",
    //         content: jsonContent(ref("Error")),
    //       },
    //     },
    //   },
    // },
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
        summary: "Fetch the latest saved meal plan",
        description:
          "Returns the most recently stored meal plan for the authenticated user.",
        operationId: "getLatestMealPlan",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Latest meal plan",
            content: {
              "application/json": {
                example: {
                  success: true,
                  data: {
                    id: 18,
                    userId: 1,
                    createdAt: "2026-04-03T10:00:00.000Z",
                    updatedAt: "2026-04-03T12:00:00.000Z",
                    plan: {
                      nutrition: {
                        source: "user_profile",
                        targetCalories: 2000,
                        macros: {
                          protein: 150,
                          carbs: 225,
                          fats: 67,
                        },
                        mealsCount: 3,
                      },
                      mealTargets: {
                        breakfast: 600,
                        lunch: 700,
                        dinner: 700,
                        snacks: [],
                      },
                      breakfast: {
                        items: [],
                        totals: {
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fats: 0,
                        },
                      },
                      lunch: {
                        items: [],
                        totals: {
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fats: 0,
                        },
                      },
                      dinner: {
                        items: [],
                        totals: {
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fats: 0,
                        },
                      },
                      snacks: [],
                      alternatives: {
                        breakfast: [
                          {
                            itemId: 294,
                            itemName: "Bagels, egg",
                            category: "breakfast",
                            currentItem: {
                              id: 294,
                              name: "Bagels, egg",
                              calories: 90,
                              protein: 8,
                              carbs: 2,
                              fats: 6,
                              category: "breakfast",
                              dietType: "balanced",
                              ingredients: [],
                              instructions: [],
                            },
                            components: [
                              {
                                originalItemId: 294,
                                originalItemName: "Bagels, egg",
                                replaceableComponent: "egg",
                                alternatives: [
                                  {
                                    id: 1678,
                                    name: "Tofu, firm, prepared with calcium sulfate",
                                    calories: 76,
                                    protein: 8,
                                    carbs: 2,
                                    fats: 4,
                                    matchScore: 87.2,
                                    macroDelta: {
                                      calories: -14,
                                      protein: 2,
                                      carbs: 0,
                                      fats: -2,
                                    },
                                  },
                                ],
                                recommended: {
                                  id: 1678,
                                  name: "Tofu, firm, prepared with calcium sulfate",
                                  calories: 76,
                                  protein: 8,
                                  carbs: 2,
                                  fats: 4,
                                  matchScore: 87.2,
                                  macroDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                },
                                previewImpact: {
                                  itemDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                  mealDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                  dayDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                },
                                previewTotals: {
                                  meal: {
                                    calories: 586,
                                    protein: 30,
                                    carbs: 45,
                                    fats: 18,
                                  },
                                  day: {
                                    calories: 1986,
                                    protein: 151,
                                    carbs: 221,
                                    fats: 65,
                                  },
                                },
                              },
                            ],
                          },
                        ],
                        lunch: [],
                        dinner: [],
                        snacks: [],
                        generatedAt: "2026-04-03T12:00:00.000Z",
                        source: "user_meal_plan",
                      },
                      alternativeSummary: {
                        breakfast: [
                          {
                            itemId: 294,
                            itemName: "Bagels, egg",
                            category: "breakfast",
                            currentItem: {
                              id: 294,
                              name: "Bagels, egg",
                              calories: 90,
                              protein: 8,
                              carbs: 2,
                              fats: 6,
                              category: "breakfast",
                              dietType: "balanced",
                              ingredients: [],
                              instructions: [],
                            },
                            currentMacros: {
                              calories: 90,
                              protein: 8,
                              carbs: 2,
                              fats: 6,
                            },
                            replacementComponents: [
                              {
                                component: "egg",
                                recommended: {
                                  id: 1678,
                                  name: "Tofu, firm, prepared with calcium sulfate",
                                  calories: 76,
                                  protein: 8,
                                  carbs: 2,
                                  fats: 4,
                                  matchScore: 87.2,
                                  macroDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                },
                                totalMatches: 3,
                                bestMatches: [
                                  {
                                    rank: 1,
                                    id: 1678,
                                    name: "Tofu, firm, prepared with calcium sulfate",
                                    calories: 76,
                                    protein: 8,
                                    carbs: 2,
                                    fats: 4,
                                    matchScore: 87.2,
                                    macroDelta: {
                                      calories: -14,
                                      protein: 2,
                                      carbs: 0,
                                      fats: -2,
                                    },
                                  },
                                ],
                                previewImpact: {
                                  itemDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                  mealDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                  dayDelta: {
                                    calories: -14,
                                    protein: 2,
                                    carbs: 0,
                                    fats: -2,
                                  },
                                },
                                previewTotals: {
                                  meal: {
                                    calories: 586,
                                    protein: 30,
                                    carbs: 45,
                                    fats: 18,
                                  },
                                  day: {
                                    calories: 1986,
                                    protein: 151,
                                    carbs: 221,
                                    fats: 65,
                                  },
                                },
                                reason: null,
                              },
                            ],
                          },
                        ],
                        lunch: [],
                        dinner: [],
                        snacks: [],
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: jsonContent(ref("Error")),
          },
          404: {
            description: "Meal plan not found",
            content: jsonContent(ref("Error")),
          },
        },
      },
      "/meals/alternatives": {
        post: {
          tags: ["Meals"],
          summary: "Get item-level meal alternatives",
          description:
            "Returns ranked alternatives for a single item in the latest meal plan and can optionally simulate a one-item swap without persisting changes.",
          operationId: "getItemAlternatives",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              properties: {
                mealType: {
                  type: "string",
                  enum: ["breakfast", "lunch", "dinner", "snack"],
                },
                itemId: { type: "integer", example: 11 },
                itemName: { type: "string", example: "Egg White Omelette" },
                targetComponent: {
                  oneOf: [
                    { type: "string", example: "egg" },
                    {
                      type: "array",
                      items: { type: "string" },
                      example: ["egg"],
                    },
                  ],
                },
                limit: { type: "integer", example: 4 },
              },
            }),
          },
          responses: {
            200: {
              description: "Ranked item alternatives",
              content: {
                "application/json": {
                  example: {
                    success: true,
                    data: {
                      itemId: 11,
                      itemName: "Egg White Omelette",
                      category: "breakfast",
                      currentItem: {
                        id: 11,
                        name: "Egg White Omelette",
                        calories: 140,
                        protein: 15,
                        carbs: 3,
                        fats: 7,
                        category: "breakfast",
                        dietType: "balanced",
                        ingredients: [],
                        instructions: [],
                      },
                      components: [
                        {
                          originalItemId: 11,
                          originalItemName: "Egg White Omelette",
                          replaceableComponent: "egg",
                          alternatives: [],
                          recommended: null,
                          previewImpact: {
                            itemDelta: {
                              calories: 0,
                              protein: 0,
                              carbs: 0,
                              fats: 0,
                            },
                            mealDelta: {
                              calories: 0,
                              protein: 0,
                              carbs: 0,
                              fats: 0,
                            },
                            dayDelta: {
                              calories: 0,
                              protein: 0,
                              carbs: 0,
                              fats: 0,
                            },
                          },
                          previewTotals: {
                            meal: {
                              calories: 400,
                              protein: 26,
                              carbs: 30,
                              fats: 14,
                            },
                            day: {
                              calories: 2015,
                              protein: 152,
                              carbs: 225,
                              fats: 67,
                            },
                          },
                          reason: "no_valid_usda_match",
                        },
                      ],
                    },
                  },
                },
              },
            },
            400: {
              description: "Validation failed",
              content: jsonContent(ref("Error")),
            },
            401: {
              description: "Unauthorized",
              content: jsonContent(ref("Error")),
            },
            404: {
              description: "Meal item not found",
              content: jsonContent(ref("Error")),
            },
            409: {
              description: "Ambiguous meal item match",
              content: jsonContent(ref("Error")),
            },
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
