const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AI Diet Planner API',
    version: '1.0.0',
    description: 'Development API documentation',
  },
  servers: [
    {
      url: '/api',
      description: 'Local / reverse-proxy base',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          details: { type: 'array', nullable: true },
        },
      },
      SuccessMessage: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', example: 'jane@example.com' },
          isEmailVerified: { type: 'boolean', example: true },
          isPremium: { type: 'boolean', example: false },
          isActive: { type: 'boolean', example: true },
          profileImageUrl: { type: 'string', nullable: true, example: '/uploads/profile-images/example.jpg' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register and send OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Jane Doe' },
                  email: { type: 'string', example: 'jane@example.com' },
                  password: { type: 'string', example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'OTP sent',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessMessage' },
              },
            },
          },
        },
      },
    },
    '/auth/verify-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify registration OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'otp'],
                properties: {
                  email: { type: 'string', example: 'jane@example.com' },
                  otp: { type: 'string', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessMessage' },
              },
            },
          },
        },
      },
    },
    '/auth/resend-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'jane@example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OTP sent',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessMessage' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'jane@example.com' },
                  password: { type: 'string', example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT issued' },
        },
      },
    },
    '/auth/password/update': {
      put: {
        tags: ['Auth'],
        summary: 'Update password (authenticated)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', example: 'secret123' },
                  newPassword: { type: 'string', example: 'newpass123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Password updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
          },
          401: { description: 'Token expired/invalid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/password/reset/request': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'jane@example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Reset code sent' },
        },
      },
    },
    '/auth/password/reset/confirm': {
      post: {
        tags: ['Auth'],
        summary: 'Confirm reset OTP and set new password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'otp', 'newPassword'],
                properties: {
                  email: { type: 'string', example: 'jane@example.com' },
                  otp: { type: 'string', example: '123456' },
                  newPassword: { type: 'string', example: 'newpass123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset successfully' },
        },
      },
    },
    '/users/me': {
      put: {
        tags: ['Users'],
        summary: 'Update user profile (name and/or profile image)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Jane Doe' },
                  profileImage: { type: 'string', format: 'binary' },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Jane Doe' },
                  profileImageUrl: { type: 'string', example: '/uploads/profile-images/example.jpg' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'User updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
        },
      },
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
        },
      },
    },
    '/users/account': {
      delete: {
        tags: ['Users'],
        summary: 'Delete current user account',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Account deleted' },
        },
      },
    },
    '/users/data': {
      delete: {
        tags: ['Users'],
        summary: 'Deactivate current user account',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Account deactivated' },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerSpec };
