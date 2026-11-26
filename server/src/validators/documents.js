const { z } = require('zod');

const requirementKeySchema = z.object({
  requirementKey: z.enum(['waiver', 'parent_id', 'performer_profile'], {
    errorMap: () => ({ message: 'Select a valid requirement.' })
  })
});

const documentIdSchema = z.object({
  id: z.string().uuid('Invalid document identifier.')
});

const reviewSchema = z
  .object({
    status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REVISION_REQUIRED', 'REJECTED'], {
      errorMap: () => ({ message: 'Select a valid review status.' })
    }),
    feedback: z.string().trim().max(2000).optional().nullable()
  })
  .refine(
    (data) => !['REVISION_REQUIRED', 'REJECTED'].includes(data.status) || (data.feedback && data.feedback.trim().length > 0),
    { path: ['feedback'], message: 'A reason or feedback is required for revision and rejection.' }
  );

const applicationStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'], {
      errorMap: () => ({ message: 'Select a valid application status.' })
    }),
    feedback: z.string().trim().max(2000).optional().nullable()
  })
  .refine(
    (data) => data.status !== 'REJECTED' || (data.feedback && data.feedback.trim().length > 0),
    { path: ['feedback'], message: 'A rejection reason is required.' }
  );

const applicantIdSchema = z.object({
  id: z.string().uuid('Invalid applicant identifier.')
});

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED']).optional(),
  yearLevel: z.string().trim().optional(),
  culturalGroupId: z.string().uuid().optional(),
  sortBy: z.enum(['fullName', 'yearLevel', 'createdAt', 'status']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10)
});

module.exports = {
  requirementKeySchema,
  documentIdSchema,
  reviewSchema,
  applicationStatusSchema,
  applicantIdSchema,
  listQuerySchema
};
