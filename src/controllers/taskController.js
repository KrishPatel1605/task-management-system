const db = require('../db');
const AppError = require('../utils/AppError');

const isAdmin = (user) => user.role === 'admin';

/**
 * Loads a task the caller is allowed to touch.
 * Admins can access any task; regular users only their own.
 * A foreign task returns 404 (not 403) so task ids of other users are not revealed.
 */
async function findAccessibleTask(id, user) {
  const q = db('tasks').where({ id });
  if (!isAdmin(user)) q.andWhere({ user_id: user.id });
  const task = await q.first();
  if (!task) throw new AppError(404, 'Task not found');
  return task;
}

exports.create = async (req, res) => {
  const { title, description } = req.valid.body;
  const [task] = await db('tasks')
    .insert({ user_id: req.user.id, title, description: description ?? null }) // status defaults to 'Pending'
    .returning('*');
  res.status(201).json({ success: true, message: 'Task created', data: { task } });
};

exports.list = async (req, res) => {
  const { status, page, limit } = req.valid.query;

  const base = db('tasks');
  if (!isAdmin(req.user)) base.where('tasks.user_id', req.user.id);
  if (status) base.where('tasks.status', status);

  const [{ count }] = await base.clone().count({ count: '*' });
  const tasks = await base
    .clone()
    .join('users', 'users.id', 'tasks.user_id')
    .select('tasks.*', 'users.name as owner_name')
    .orderBy('tasks.created_at', 'desc')
    .orderBy('tasks.id', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  const total = Number(count);
  res.json({
    success: true,
    data: { tasks },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

exports.getOne = async (req, res) => {
  const task = await findAccessibleTask(req.valid.params.id, req.user);
  res.json({ success: true, data: { task } });
};

exports.update = async (req, res) => {
  const task = await findAccessibleTask(req.valid.params.id, req.user);
  const changes = req.valid.body;
  const [updated] = await db('tasks')
    .where({ id: task.id })
    .update({ ...changes, updated_at: db.fn.now() })
    .returning('*');
  res.json({ success: true, message: 'Task updated', data: { task: updated } });
};

// Route is guarded by authorize('admin'), so only admins reach this.
exports.updateStatus = async (req, res) => {
  const task = await findAccessibleTask(req.valid.params.id, req.user);
  const [updated] = await db('tasks')
    .where({ id: task.id })
    .update({ status: req.valid.body.status, updated_at: db.fn.now() })
    .returning('*');
  res.json({ success: true, message: 'Task status updated', data: { task: updated } });
};
