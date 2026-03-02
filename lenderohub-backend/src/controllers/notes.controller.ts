import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Note } from '../models/notes.model';
import mongoose from 'mongoose';

export const notesController = {

  // POST /api/v1/notes
  async createNote(req: AuthRequest, res: Response) {
    try {
      const { content, entityType, entityId, priority, tags } = req.body;

      if (!content || !entityType) {
        return res.status(400).json({
          success: false,
          error: 'content y entityType son requeridos',
        });
      }

      const note = await Note.create({
        content,
        entityType,
        entityId: entityId || undefined,
        priority: priority || 'medium',
        tags: tags || [],
        createdBy: req.user._id,
        isResolved: false,
      });

      return res.status(201).json({ success: true, data: note });
    } catch (error: any) {
      return res.status(error.status || 500).json({
        success: false,
        error: 'Error al crear la nota',
        message: error.message,
      });
    }
  },

  // GET /api/v1/notes
  async getNotes(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = { isDeleted: { $ne: true } };

      if (req.query.entityType) filter.entityType = req.query.entityType;
      if (req.query.priority) filter.priority = req.query.priority;
      if (req.query.isResolved !== undefined) filter.isResolved = req.query.isResolved === 'true';
      if (req.query.search) {
        filter.$text = { $search: req.query.search as string };
      }

      const [data, total] = await Promise.all([
        Note.find(filter)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .populate('createdBy', 'name email'),
        Note.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener las notas',
        message: error.message,
      });
    }
  },

  // GET /api/v1/notes/:id
  async getNoteById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'ID inválido' });
      }

      const note = await Note.findOne({ _id: id, isDeleted: { $ne: true } })
        .populate('createdBy', 'name email')
        .populate('resolvedBy', 'name email');

      if (!note) {
        return res.status(404).json({ success: false, error: 'Nota no encontrada' });
      }

      return res.json({ success: true, data: note });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener la nota',
        message: error.message,
      });
    }
  },

  // PUT /api/v1/notes/:id
  async updateNote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'ID inválido' });
      }

      const note = await Note.findOne({ _id: id, isDeleted: { $ne: true } });

      if (!note) {
        return res.status(404).json({ success: false, error: 'Nota no encontrada' });
      }

      if (note.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Solo el creador puede editar esta nota',
        });
      }

      const { content, priority, tags } = req.body;
      if (content !== undefined) note.content = content;
      if (priority !== undefined) note.priority = priority;
      if (tags !== undefined) note.tags = tags;

      await note.save();

      return res.json({ success: true, data: note });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar la nota',
        message: error.message,
      });
    }
  },

  // DELETE /api/v1/notes/:id
  async deleteNote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'ID inválido' });
      }

      const note = await Note.findOne({ _id: id, isDeleted: { $ne: true } });

      if (!note) {
        return res.status(404).json({ success: false, error: 'Nota no encontrada' });
      }

      const isAdmin = req.user.role === 'admin';
      const isOwner = note.createdBy.toString() === req.user._id.toString();

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Solo el creador o un admin puede eliminar esta nota',
        });
      }

      (note as any).isDeleted = true;
      await note.save();

      return res.json({ success: true, message: 'Nota eliminada correctamente' });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Error al eliminar la nota',
        message: error.message,
      });
    }
  },

  // POST /api/v1/notes/bulk/delete
  async bulkDelete(req: AuthRequest, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids debe ser un array no vacío' });
      }

      const notes = await Note.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
      const foundIds = new Set(notes.map((n) => n._id.toString()));
      const errors: string[] = [];

      const validIds = ids.filter((id) => {
        if (!foundIds.has(id)) { errors.push(`${id}: no encontrado`); return false; }
        const note = notes.find((n) => n._id.toString() === id);
        const isOwner = note?.createdBy.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin) { errors.push(`${id}: sin permiso`); return false; }
        return true;
      });

      const ops = validIds.map((id) => ({
        updateOne: { filter: { _id: id }, update: { $set: { isDeleted: true } } },
      }));

      const result = ops.length > 0 ? await Note.bulkWrite(ops) : { modifiedCount: 0 };

      return res.json({
        success: true,
        data: { success: (result as any).modifiedCount, failed: errors.length, errors },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // POST /api/v1/notes/bulk/resolve
  async bulkResolve(req: AuthRequest, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids debe ser un array no vacío' });
      }

      const notes = await Note.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
      const foundIds = new Set(notes.map((n) => n._id.toString()));
      const errors: string[] = [];

      const validIds = ids.filter((id) => {
        if (!foundIds.has(id)) { errors.push(`${id}: no encontrado`); return false; }
        return true;
      });

      const ops = validIds.map((id) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { isResolved: true, resolvedBy: req.user._id, resolvedAt: new Date() } },
        },
      }));

      const result = ops.length > 0 ? await Note.bulkWrite(ops) : { modifiedCount: 0 };

      return res.json({
        success: true,
        data: { success: (result as any).modifiedCount, failed: errors.length, errors },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // POST /api/v1/notes/bulk/update-priority
  async bulkUpdatePriority(req: AuthRequest, res: Response) {
    try {
      const { ids, priority } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids debe ser un array no vacío' });
      }
      if (!['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({ success: false, error: 'priority debe ser low, medium, o high' });
      }

      const ops = ids.map((id) => ({
        updateOne: { filter: { _id: id, isDeleted: { $ne: true } }, update: { $set: { priority } } },
      }));

      const result = await Note.bulkWrite(ops);

      return res.json({
        success: true,
        data: { success: (result as any).modifiedCount, failed: ids.length - (result as any).modifiedCount, errors: [] },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // POST /api/v1/notes/bulk/export
  async bulkExport(req: AuthRequest, res: Response) {
    try {
      const { ids, format = 'json' } = req.body;

      const filter: Record<string, any> = { isDeleted: { $ne: true } };
      if (Array.isArray(ids) && ids.length > 0) filter._id = { $in: ids };

      const notes = await Note.find(filter).populate('createdBy', 'name email');

      if (format === 'csv') {
        const header = 'id,content,entityType,priority,isResolved,createdAt';
        const rows = notes.map((n) =>
          `${n._id},"${n.content.replace(/"/g, '""')}",${n.entityType},${n.priority},${n.isResolved},${n.createdAt}`
        );
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="notes-export.csv"');
        return res.send([header, ...rows].join('\n'));
      }

      return res.json({ success: true, data: notes, total: notes.length });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default notesController;