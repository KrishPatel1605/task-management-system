const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schemas = require('../validators/schemas');
const ctrl = require('../controllers/taskController');

router.use(authenticate); // every task route requires a valid JWT

router.post('/', validate(schemas.createTask), asyncHandler(ctrl.create));
router.get('/', validate(schemas.listTasks, 'query'), asyncHandler(ctrl.list));
router.get('/:id', validate(schemas.idParam, 'params'), asyncHandler(ctrl.getOne));
router.put('/:id', validate(schemas.idParam, 'params'), validate(schemas.updateTask), asyncHandler(ctrl.update));
router.patch('/:id/status', authorize('admin'), validate(schemas.idParam, 'params'), validate(schemas.updateStatus), asyncHandler(ctrl.updateStatus));

module.exports = router;
