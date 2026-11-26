const { z } = require('zod');
const env = require('../config/env');

const gsuiteEmail = z
  .string()
  .trim()
  .min(1, 'Email address is required.')
  .email('Please enter a valid email address.')
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => value.endsWith(env.gsuiteDomain),
    `ArtiFile uses Batangas State University Google Workspace accounts. Please use your GSuite email (e.g. student${env.gsuiteDomain}).`
  );

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.');

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Complete name is required.').max(120),
    email: gsuiteEmail,
    password: strongPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    phone: z.string().trim().min(7, 'Please enter a valid phone number.').max(20),
    yearLevel: z.string().trim().max(50).optional().default('1st Year'),
    program: z.string().trim().max(150).optional().default('Not Specified'),
    campus: z.string().trim().max(150).optional().default('Alangilan Campus'),
    academicYear: z.string().trim().max(20).optional(),
    culturalGroupId: z.string().uuid('Select a valid cultural group.').optional().nullable(),
    srCode: z.string().trim().max(30).optional().nullable()
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.'
  });

const loginSchema = z.object({
  email: gsuiteEmail,
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional().default(false)
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  yearLevel: z.string().trim().min(1).max(50).optional(),
  program: z.string().trim().min(1).max(150).optional(),
  campus: z.string().trim().min(1).max(150).optional(),
  academicYear: z.string().trim().min(4).max(20).optional(),
  culturalGroupId: z.string().uuid('Select a valid cultural group.').optional(),
  srCode: z.string().trim().max(30).optional().nullable()
});

module.exports = { registerSchema, loginSchema, updateProfileSchema, gsuiteEmail, strongPassword };
