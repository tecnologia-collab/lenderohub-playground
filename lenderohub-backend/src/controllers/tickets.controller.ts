import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  Ticket,
  BugTicket,
  FeatureTicket,
  QuestionTicket,
  TicketType,
} from '../models/tickets.model';
import mongoose from 'mongoose';

const ticketModels: Record<string, any> = {
  [TicketType.Bug]: BugTicket,
  [TicketType.Feature]: FeatureTicket,
  [TicketType.Question]: QuestionTicket,
};

export const ticketsController = {

  async createTicket(req: AuthRequest, res: Response) {
    try {
      const { ticketType } = req.body;

      if (!ticketType || !ticketModels[ticketType]) {
        return res.status(400).json({
          success: false,
          error: `ticketType inválido. Debe ser: ${Object.values(TicketType).join(', ')}`,
        });
      }

      // Type-specific validations
      if (ticketType === TicketType.Bug) {
        if (!req.body.severity) return res.status(400).json({ success: false, error: 'severity es requerido para bug tickets' });
        if (!req.body.stepsToReproduce?.length) return res.status(400).json({ success: false, error: 'stepsToReproduce es requerido para bug tickets' });
        if (!req.body.affectedModule) return res.status(400).json({ success: false, error: 'affectedModule es requerido para bug tickets' });
      }

      if (ticketType === TicketType.Feature) {
        if (!req.body.businessJustification) return res.status(400).json({ success: false, error: 'businessJustification es requerido para feature tickets' });
        if (!req.body.estimatedEffort) return res.status(400).json({ success: false, error: 'estimatedEffort es requerido para feature tickets' });
      }

      if (ticketType === TicketType.Question) {
        if (!req.body.topic) return res.status(400).json({ success: false, error: 'topic es requerido para question tickets' });
      }

      const Model = ticketModels[ticketType];
      const ticket = await Model.create({ ...req.body, createdBy: req.user._id });

      return res.status(201).json({ success: true, data: ticket });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async getTickets(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};
      if (req.query.ticketType) filter.ticketType = req.query.ticketType;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.priority) filter.priority = req.query.priority;

      const [data, total] = await Promise.all([
        Ticket.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .populate('assignedTo', 'name email'),
        Ticket.countDocuments(filter),
      ]);

      return res.json({ success: true, data, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async getTicketById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'ID inválido' });
      }

      const ticket = await Ticket.findById(id)
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email');

      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket no encontrado' });

      return res.json({ success: true, data: ticket });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) return res.status(400).json({ success: false, error: 'status es requerido' });
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'ID inválido' });

      const ticket = await Ticket.findByIdAndUpdate(id, { status }, { new: true });
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket no encontrado' });

      return res.json({ success: true, data: ticket });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async assignTicket(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) return res.status(400).json({ success: false, error: 'userId es requerido' });
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'ID inválido' });

      const ticket = await Ticket.findByIdAndUpdate(id, { assignedTo: userId }, { new: true })
        .populate('assignedTo', 'name email');

      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket no encontrado' });

      return res.json({ success: true, data: ticket });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default ticketsController;