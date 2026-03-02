import { Router } from 'express';
import { notesController } from '../controllers/notes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/playground-permissions.middleware';

const router = Router();

router.use(authMiddleware);

// Bulk routes — ANTES de /:id para evitar conflictos
router.post('/bulk/delete',           requirePermission('notes:delete'), notesController.bulkDelete);
router.post('/bulk/resolve',          requirePermission('notes:update'), notesController.bulkResolve);
router.post('/bulk/update-priority',  requirePermission('notes:update'), notesController.bulkUpdatePriority);
router.post('/bulk/export',           requirePermission('notes:read'),   notesController.bulkExport);

// CRUD routes
router.post('/',    requirePermission('notes:create'), notesController.createNote);
router.get('/',     requirePermission('notes:read'),   notesController.getNotes);
router.get('/:id',  requirePermission('notes:read'),   notesController.getNoteById);
router.put('/:id',  requirePermission('notes:update'), notesController.updateNote);
router.delete('/:id', requirePermission('notes:delete'), notesController.deleteNote);

export default router;