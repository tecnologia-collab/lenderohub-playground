import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Announcement, AnnouncementRead } from '../models/announcements.model';
import mongoose from 'mongoose';

const isAdmin = (req: AuthRequest) =>
  ['corporate', 'administrator'].includes(req.user?.profileType);

const activeFilter = () => ({
  $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

export const announcementsController = {

  // GET /api/v1/announcements
  async getAnnouncements(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = { ...activeFilter() };
      if (req.query.priority) filter.priority = req.query.priority;
      if (req.query.search) filter.$text = { $search: req.query.search as string };

      const [announcements, total, reads] = await Promise.all([
        Announcement.find(filter)
          .sort({ isPinned: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email'),
        Announcement.countDocuments(filter),
        AnnouncementRead.find({ userId: req.user._id }).select('announcementId'),
      ]);

      const readIds = new Set(reads.map((r) => r.announcementId.toString()));
      const data = announcements.map((a) => ({
        ...a.toObject(),
        isRead: readIds.has(a._id.toString()),
      }));

      // Filter unread if requested
      const filtered = req.query.unreadOnly === 'true' ? data.filter((a) => !a.isRead) : data;

      return res.json({ success: true, data: filtered, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // GET /api/v1/announcements/unread-count
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const [total, readCount] = await Promise.all([
        Announcement.countDocuments(activeFilter()),
        AnnouncementRead.countDocuments({ userId: req.user._id }),
      ]);
      return res.json({ success: true, count: Math.max(0, total - readCount) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // GET /api/v1/announcements/:id
  async getAnnouncementById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'ID inválido' });
      }

      const [announcement, read] = await Promise.all([
        Announcement.findById(id).populate('createdBy', 'name email'),
        AnnouncementRead.findOne({ announcementId: id, userId: req.user._id }),
      ]);

      if (!announcement) return res.status(404).json({ success: false, error: 'Anuncio no encontrado' });

      return res.json({ success: true, data: { ...announcement.toObject(), isRead: !!read } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // POST /api/v1/announcements
  async createAnnouncement(req: AuthRequest, res: Response) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Solo admins pueden crear anuncios' });

      const { title, content, priority, expiresAt, imageUrl } = req.body;
      if (!title || !content) return res.status(400).json({ success: false, error: 'title y content son requeridos' });

      const announcement = await Announcement.create({
        title, content,
        priority: priority || 'normal',
        expiresAt: expiresAt || undefined,
        imageUrl: imageUrl || undefined,
        createdBy: req.user._id,
      });

      return res.status(201).json({ success: true, data: announcement });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // PUT /api/v1/announcements/:id
  async updateAnnouncement(req: AuthRequest, res: Response) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Solo admins pueden editar anuncios' });

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'ID inválido' });

      const { title, content, priority, expiresAt, imageUrl } = req.body;
      const announcement = await Announcement.findByIdAndUpdate(
        id,
        { title, content, priority, expiresAt, imageUrl, updatedBy: req.user._id },
        { new: true, runValidators: true }
      );

      if (!announcement) return res.status(404).json({ success: false, error: 'Anuncio no encontrado' });
      return res.json({ success: true, data: announcement });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // DELETE /api/v1/announcements/:id
  async deleteAnnouncement(req: AuthRequest, res: Response) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Solo admins pueden eliminar anuncios' });

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'ID inválido' });

      await Promise.all([
        Announcement.findByIdAndDelete(id),
        AnnouncementRead.deleteMany({ announcementId: id }),
      ]);

      return res.json({ success: true, message: 'Anuncio eliminado' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // PUT /api/v1/announcements/:id/pin
  async pinAnnouncement(req: AuthRequest, res: Response) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Solo admins pueden fijar anuncios' });

      const { id } = req.params;
      const announcement = await Announcement.findById(id);
      if (!announcement) return res.status(404).json({ success: false, error: 'Anuncio no encontrado' });

      announcement.isPinned = !announcement.isPinned;
      await announcement.save();

      return res.json({ success: true, data: announcement });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // PUT /api/v1/announcements/:id/read
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'ID inválido' });

      await AnnouncementRead.findOneAndUpdate(
        { announcementId: id, userId: req.user._id },
        { readAt: new Date() },
        { upsert: true, new: true }
      );

      return res.json({ success: true, message: 'Marcado como leído' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // GET /api/v1/announcements/:id/stats
  async getStats(req: AuthRequest, res: Response) {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Solo admins pueden ver stats' });

      const { id } = req.params;
      const readCount = await AnnouncementRead.countDocuments({ announcementId: id });

      return res.json({ success: true, data: { readCount } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default announcementsController;