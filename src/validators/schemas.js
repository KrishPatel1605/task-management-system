const { z } = require('zod');

const TASK_STATUSES = ['Pending', 'In Progress', 'Testing', 'Completed'];

const email = z.string().trim().toLowerCase().email().max(255);

const register = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
}).strict(); // strict: a client cannot sneak in `role`

const login = z.object({
  email,
  password: z.string().min(1),
}).strict();

// `status` is intentionally NOT accepted here: status changes go through the admin-only endpoint.
const createTask = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
}).strict();

const updateTask = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const updateStatus = z.object({
  status: z.enum(TASK_STATUSES),
}).strict();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const listTasks = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

module.exports = { TASK_STATUSES, register, login, createTask, updateTask, updateStatus, idParam, listTasks };
