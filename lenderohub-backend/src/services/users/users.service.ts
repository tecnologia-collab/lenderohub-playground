/**
 * Users Service
 *
 * Handles user CRUD operations with permission checks
 */

import * as dinero from 'dinero.js';
import mongoose from 'mongoose';
import { UserModel, IUser, UserProfileType, CommissionType, ICommissionDocuments } from '../../models/user.model';
import { VirtualBagAccount, AccountStatus } from '../../models/accounts.model';
import { CostCentre } from '../../models/providerAccounts.model';
import { CommissionAgentAssignment } from '../../models/commissionAgentAssignments.model';
import { AdminCostCentreAssignment } from '../../models/adminCostCentreAssignments.model';
import { PasswordSetupToken, generateSetupToken, getSetupTokenExpiration } from '../../models/passwordSetupTokens.model';
import { Permissions } from '../../config/permissions';
import { DEFAULT_TRANSACTION_FEE } from '../../constants';
import { uploadMulterFileRandomizedSubdirectory } from '../../utils/uploads';
import { emailService } from '../email';

const Dinero = (dinero as any).default || dinero;

// ============================================
// Types
// ============================================
export interface CreateUserDTO {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  phone?: string;
  profileType: UserProfileType;
  clientId?: string;
  readOnly?: boolean;
  costCentreIds?: string[];
  costCentreId?: string;
  virtualBagIds?: string[];
  commissionType?: CommissionType;
  rfc?: string;
  commissionTransferOutFee?: number;
  transferInCommissionPercentage?: number;
  commissionDocuments?: ICommissionDocuments;
  commissionDocumentFiles?: {
    identificationDocumentFile?: Express.Multer.File;
    financialStatementFile?: Express.Multer.File;
    proofOfAddressFile?: Express.Multer.File;
  };
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  phone?: string;
  profileType?: UserProfileType;
  isActive?: boolean;
  readOnly?: boolean;
}

export interface AssignRoleDTO {
  profileType: UserProfileType;
  reactivate?: boolean;
  readOnly?: boolean;
  costCentreIds?: string[];
  costCentreId?: string;
  virtualBagIds?: string[];
  commissionType?: CommissionType;
  rfc?: string;
  commissionTransferOutFee?: number;
  transferInCommissionPercentage?: number;
  commissionDocuments?: ICommissionDocuments;
  commissionDocumentFiles?: {
    identificationDocumentFile?: Express.Multer.File;
    financialStatementFile?: Express.Multer.File;
    proofOfAddressFile?: Express.Multer.File;
  };
}

export interface UserFilters {
  clientId?: string;
  profileType?: UserProfileType;
  isActive?: boolean;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ============================================
// Service Class
// ============================================
export class UsersService {
  private toMoney(amount: number): dinero.Dinero {
    return Dinero({ amount: Math.round(amount * 100), precision: 2, currency: 'MXN' });
  }

  private async getAccessibleCostCentres(requester: IUser): Promise<mongoose.Types.ObjectId[]> {
    console.log(`[getAccessibleCostCentres] Usuario: ${requester.email}, profileType: ${requester.profileType}, clientId: ${requester.clientId}`);

    // Para usuarios corporate: devolver todos los CECOs de su client
    if (requester.profileType === 'corporate') {
      if (!requester.clientId) {
        console.log('[getAccessibleCostCentres] Corporate sin clientId, devolviendo []');
        return [];
      }
      const costCentres = await CostCentre.find({
        client: requester.clientId,
        disabled: { $ne: true }
      }).select('_id');
      console.log(`[getAccessibleCostCentres] Corporate: ${costCentres.length} CECOs encontrados`);
      return costCentres.map((cc) => cc._id);
    }

    // Para usuarios administrator: buscar asignaciones específicas
    if (requester.profileType === 'administrator') {
      const assignments = await AdminCostCentreAssignment.find({
        administrator: requester._id,
        isActive: true,
      }).select('costCentre');
      
      if (assignments.length > 0) {
        console.log(`[getAccessibleCostCentres] Admin con ${assignments.length} asignaciones`);
        return assignments.map((assignment) => assignment.costCentre as mongoose.Types.ObjectId);
      }
      
      // Si no hay asignaciones específicas pero tiene clientId, devolver todos los CECOs del client
      if (requester.clientId) {
        console.log('[getAccessibleCostCentres] Admin sin asignaciones, usando clientId');
        const costCentres = await CostCentre.find({
          client: requester.clientId,
          disabled: { $ne: true }
        }).select('_id');
        console.log(`[getAccessibleCostCentres] Admin: ${costCentres.length} CECOs del client`);
        return costCentres.map((cc) => cc._id);
      }
      
      console.log('[getAccessibleCostCentres] Admin sin asignaciones ni clientId');
      return [];
    }

    // Para otros perfiles (subaccount, commissionAgent): usar clientId si existe
    if (requester.clientId) {
      const costCentres = await CostCentre.find({
        client: requester.clientId,
        disabled: { $ne: true }
      }).select('_id');
      console.log(`[getAccessibleCostCentres] Otros: ${costCentres.length} CECOs del client`);
      return costCentres.map((cc) => cc._id);
    }

    console.log('[getAccessibleCostCentres] Sin clientId, devolviendo []');
    return [];
  }

  private async ensureCostCentreAccess(requester: IUser, costCentreId: string): Promise<void> {
    const accessibleCostCentres = await this.getAccessibleCostCentres(requester);
    if (!accessibleCostCentres.some((id) => id.toString() === costCentreId)) {
      throw new Error('No tienes permiso para usar el CECO seleccionado');
    }
  }

  private async clearAssignmentsForUser(userId: string): Promise<void> {
    await Promise.all([
      AdminCostCentreAssignment.updateMany(
        { administrator: userId, isActive: true },
        { isActive: false }
      ),
      CommissionAgentAssignment.updateMany(
        { commissionAgent: userId, active: true },
        { active: false }
      ),
      VirtualBagAccount.updateMany(
        { assignedUsers: userId },
        { $pull: { assignedUsers: userId } }
      ),
    ]);
  }

  private async uploadCommissionDocuments(
    userId: string,
    files: CreateUserDTO['commissionDocumentFiles']
  ): Promise<ICommissionDocuments> {
    if (!files?.identificationDocumentFile || !files.financialStatementFile || !files.proofOfAddressFile) {
      throw new Error('Faltan documentos de comisionista');
    }

    const environment = process.env.NODE_ENV ?? 'development';
    const destinationPath = `${environment}/userProfiles/${userId}`;

    const [identificationDocument, financialStatement, proofOfAddress] = await Promise.all([
      uploadMulterFileRandomizedSubdirectory(
        files.identificationDocumentFile,
        destinationPath,
        'ine',
        true
      ),
      uploadMulterFileRandomizedSubdirectory(
        files.financialStatementFile,
        destinationPath,
        'constanciaDeSituacionFiscal',
        true
      ),
      uploadMulterFileRandomizedSubdirectory(
        files.proofOfAddressFile,
        destinationPath,
        'comprobanteDeDomicilio',
        true
      ),
    ]);

    return {
      identificationDocument,
      financialStatement,
      proofOfAddress,
    };
  }

  /**
   * Get all users for a client with filters
   */
  async getUsers(
    requesterId: string,
    filters: UserFilters = {},
    pagination: PaginationParams = {}
  ): Promise<{ users: IUser[]; total: number; page: number; totalPages: number }> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    // Check permission
    if (!Permissions.userHas(requester, 'users:read')) {
      throw new Error('No tienes permiso para ver usuarios');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};

    // Filter by client (users can only see users from their own client)
    if (requester.clientId) {
      query.clientId = requester.clientId;
    }

    // Additional filters
    if (filters.profileType) {
      query.profileType = filters.profileType;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { secondLastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(query),
    ]);

    return {
      users: users as IUser[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get form options for user creation
   */
  async getFormOptions(requesterId: string, options?: { costCentreId?: string }) {
    console.log(`[getFormOptions] requesterId: ${requesterId}, options:`, options);
    
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    console.log(`[getFormOptions] requester: ${requester.email}, profileType: ${requester.profileType}`);

    if (!Permissions.userHas(requester, 'users:create')) {
      throw new Error('No tienes permiso para crear usuarios');
    }

    const accessibleCostCentres = await this.getAccessibleCostCentres(requester);
    console.log(`[getFormOptions] accessibleCostCentres: ${accessibleCostCentres.length} IDs`);

    const costCentres = await CostCentre.find({
      _id: { $in: accessibleCostCentres },
      disabled: { $ne: true },
    }).select('_id alias shortName code');
    console.log(`[getFormOptions] costCentres encontrados: ${costCentres.length}`);

    let virtualBags: { id: string; name: string; description?: string }[] = [];

    if (options?.costCentreId) {
      await this.ensureCostCentreAccess(requester, options.costCentreId);
      const bags = await VirtualBagAccount.find({
        costCentre: options.costCentreId,
        status: AccountStatus.Active,
      }).select('_id alias description');

      virtualBags = bags.map((bag) => ({
        id: bag._id.toString(),
        name: bag.alias || '',
        description: bag.description,
      }));
      console.log(`[getFormOptions] virtualBags para CECO ${options.costCentreId}: ${virtualBags.length}`);
    }

    const result = {
      costCentres: costCentres.map((cc) => ({
        id: cc._id.toString(),
        alias: cc.alias,
        shortName: cc.shortName,
        code: cc.code,
      })),
      virtualBags,
    };
    console.log(`[getFormOptions] Resultado: ${result.costCentres.length} CECOs, ${result.virtualBags.length} bolsas virtuales`);
    return result;
  }

  /**
   * Get a single user by ID
   */
  async getUserById(requesterId: string, userId: string): Promise<IUser> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:read')) {
      throw new Error('No tienes permiso para ver usuarios');
    }

    const user = await UserModel.findById(userId)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Check same client
    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      throw new Error('No tienes permiso para ver este usuario');
    }

    return user;
  }

  /**
   * Create a new user
   * 
   * Nuevo flujo:
   * 1. Crea usuario con contraseña placeholder
   * 2. Genera token de setup de contraseña
   * 3. Envía email con enlace para establecer contraseña
   */
  async createUser(requesterId: string, data: CreateUserDTO): Promise<{ user: IUser; emailSent: boolean }> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    // Check create permission
    if (!Permissions.userHas(requester, 'users:create')) {
      throw new Error('No tienes permiso para crear usuarios');
    }

    // Check if can create this role
    if (!Permissions.canCreateRoleForUser(requester, data.profileType)) {
      throw new Error(`No tienes permiso para crear usuarios con rol "${data.profileType}"`);
    }

    if (data.profileType === 'administrator') {
      const costCentreIds = Array.from(new Set(data.costCentreIds || [])).filter(Boolean);
      if (costCentreIds.length === 0) {
        throw new Error('Selecciona al menos un CECO');
      }
      await Promise.all(costCentreIds.map((id) => this.ensureCostCentreAccess(requester, id)));
      const existingAssignments = await AdminCostCentreAssignment.find({
        costCentre: { $in: costCentreIds },
        isActive: true,
      });
      if (existingAssignments.length > 0) {
        throw new Error('Algún CECO ya tiene administrador asignado');
      }
    }

    if (data.profileType === 'subaccount') {
      if (!data.costCentreId) {
        throw new Error('Selecciona un CECO para la subcuenta');
      }
      const virtualBagIds = Array.from(new Set(data.virtualBagIds || [])).filter(Boolean);
      if (virtualBagIds.length === 0) {
        throw new Error('Selecciona al menos una bolsa virtual');
      }
      await this.ensureCostCentreAccess(requester, data.costCentreId);
      const virtualBags = await VirtualBagAccount.find({
        _id: { $in: virtualBagIds },
        costCentre: data.costCentreId,
        status: AccountStatus.Active,
      }).select('_id');
      if (virtualBags.length !== virtualBagIds.length) {
        throw new Error('Las bolsas virtuales seleccionadas no son válidas');
      }
    }

    if (data.profileType === 'commissionAgent') {
      if (!data.costCentreId) {
        throw new Error('Selecciona un CECO para el comisionista');
      }
      if (!data.commissionType || !data.rfc) {
        throw new Error('Régimen y RFC son requeridos');
      }
      const rfcPattern = /^[A-Z]{3}[A-Z]?[0-9]{6}[0-9A-Z]{3}$/;
      if (!rfcPattern.test(data.rfc.toUpperCase())) {
        throw new Error('RFC inválido');
      }
      if (data.commissionTransferOutFee == null) {
        throw new Error('El cobro de SPEI OUT es requerido');
      }
      if (data.transferInCommissionPercentage == null) {
        throw new Error('La comisión SPEI IN es requerida');
      }
      const transferInCommissionPercentage = Number(data.transferInCommissionPercentage);
      if (Number.isNaN(transferInCommissionPercentage) || transferInCommissionPercentage < 0 || transferInCommissionPercentage > 100) {
        throw new Error('Comisión SPEI IN inválida');
      }
      await this.ensureCostCentreAccess(requester, data.costCentreId);
      const existingAssignment = await CommissionAgentAssignment.findOne({
        costCentre: data.costCentreId,
        active: true,
      });
      if (existingAssignment) {
        throw new Error('El CECO ya tiene un comisionista asignado');
      }
      const fee = this.toMoney(Number(data.commissionTransferOutFee));
      if (fee.lessThan(this.toMoney(DEFAULT_TRANSACTION_FEE))) {
        throw new Error('Cobro de SPEI OUT inválido');
      }
    }

    // Check email not exists
    const existingUser = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new Error('Ya existe un usuario con este correo electrónico');
    }

    const normalizedEmail = data.email.toLowerCase();

    // Generar contraseña placeholder (no usable directamente)
    // El usuario establecerá su contraseña real mediante el token de setup
    const placeholderPassword = `PENDING_SETUP_${generateSetupToken()}`;

    const user = new UserModel({
      email: normalizedEmail,
      passwordHash: placeholderPassword, // Contraseña placeholder, será reemplazada
      firstName: data.firstName,
      lastName: data.lastName,
      secondLastName: data.secondLastName,
      phone: data.phone,
      profileType: data.profileType,
      clientId: data.clientId || requester.clientId,
      readOnly: data.readOnly ?? false,
      createdBy: requester._id,
      isActive: true,
      twoFactorEnabled: false,
    });

    await user.save();

    try {
      if (data.profileType === 'administrator') {
        const costCentreIds = Array.from(new Set(data.costCentreIds || [])).filter(Boolean);
        await AdminCostCentreAssignment.insertMany(costCentreIds.map((costCentre) => ({
          administrator: user._id,
          costCentre,
          isActive: true,
          createdBy: requester._id,
        })));
      }

      if (data.profileType === 'subaccount') {
        const virtualBagIds = Array.from(new Set(data.virtualBagIds || [])).filter(Boolean);
        await VirtualBagAccount.updateMany(
          { _id: { $in: virtualBagIds } },
          { $addToSet: { assignedUsers: user._id } }
        );
      }

      if (data.profileType === 'commissionAgent') {
        const commissionDocuments = data.commissionDocuments
          ?? await this.uploadCommissionDocuments(user._id.toString(), data.commissionDocumentFiles);

        user.commissionType = data.commissionType;
        user.rfc = data.rfc?.toUpperCase();
        user.commissionTransferOutFee = this.toMoney(Number(data.commissionTransferOutFee));
        user.commissionDocuments = commissionDocuments;
        await user.save();

        await CommissionAgentAssignment.create({
          commissionAgent: user._id,
          costCentre: data.costCentreId,
          transferInCommissionPercentage: Number(data.transferInCommissionPercentage),
          active: true,
        });
      }

      // Generar token de setup de contraseña
      const setupToken = generateSetupToken();
      await PasswordSetupToken.create({
        user: user._id,
        token: setupToken,
        expiresAt: getSetupTokenExpiration(),
      });

      // Enviar email con enlace para establecer contraseña
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      const emailSent = await emailService.sendPasswordSetupEmail(
        user.email,
        setupToken,
        userName
      );

      if (!emailSent) {
        console.warn(`[createUser] No se pudo enviar email de setup a ${user.email}`);
      }

      // Return without sensitive data
      const savedUser = await UserModel.findById(user._id)
        .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

      return { user: savedUser!, emailSent };
    } catch (error) {
      // Limpiar usuario y token si algo falla
      await UserModel.deleteOne({ _id: user._id });
      await PasswordSetupToken.deleteMany({ user: user._id });
      throw error;
    }
  }

  /**
   * Find user by email (for onboarding flow)
   */
  async findByEmail(requesterId: string, email: string): Promise<IUser | null> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:create')) {
      throw new Error('No tienes permiso para crear usuarios');
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() })
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

    if (!user) return null;

    // Check same client
    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      return null;
    }

    return user;
  }

  /**
   * Assign role to an existing user
   */
  async assignRole(
    requesterId: string,
    userId: string,
    data: AssignRoleDTO
  ): Promise<IUser> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:update')) {
      throw new Error('No tienes permiso para editar usuarios');
    }

    if (!Permissions.canCreateRoleForUser(requester, data.profileType)) {
      throw new Error(`No tienes permiso para asignar rol "${data.profileType}"`);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      throw new Error('No tienes permiso para editar este usuario');
    }

    if (data.profileType === 'administrator' && user.profileType !== 'administrator') {
      if (!Permissions.userHas(requester, 'users:manage_admins')) {
        throw new Error('No tienes permiso para asignar rol de administrador');
      }
    }

    if (data.profileType === 'administrator') {
      const costCentreIds = Array.from(new Set(data.costCentreIds || [])).filter(Boolean);
      if (costCentreIds.length === 0) {
        throw new Error('Selecciona al menos un CECO');
      }
      await Promise.all(costCentreIds.map((id) => this.ensureCostCentreAccess(requester, id)));
      const existingAssignments = await AdminCostCentreAssignment.find({
        costCentre: { $in: costCentreIds },
        isActive: true,
      });
      if (existingAssignments.length > 0) {
        throw new Error('Algún CECO ya tiene administrador asignado');
      }
    }

    if (data.profileType === 'subaccount') {
      if (!data.costCentreId) {
        throw new Error('Selecciona un CECO para la subcuenta');
      }
      const virtualBagIds = Array.from(new Set(data.virtualBagIds || [])).filter(Boolean);
      if (virtualBagIds.length === 0) {
        throw new Error('Selecciona al menos una bolsa virtual');
      }
      await this.ensureCostCentreAccess(requester, data.costCentreId);
      const virtualBags = await VirtualBagAccount.find({
        _id: { $in: virtualBagIds },
        costCentre: data.costCentreId,
        status: AccountStatus.Active,
      }).select('_id');
      if (virtualBags.length !== virtualBagIds.length) {
        throw new Error('Las bolsas virtuales seleccionadas no son válidas');
      }
    }

    if (data.profileType === 'commissionAgent') {
      if (!data.costCentreId) {
        throw new Error('Selecciona un CECO para el comisionista');
      }
      if (!data.commissionType || !data.rfc) {
        throw new Error('Régimen y RFC son requeridos');
      }
      const rfcPattern = /^[A-Z]{3}[A-Z]?[0-9]{6}[0-9A-Z]{3}$/;
      if (!rfcPattern.test(data.rfc.toUpperCase())) {
        throw new Error('RFC inválido');
      }
      if (data.commissionTransferOutFee == null) {
        throw new Error('El cobro de SPEI OUT es requerido');
      }
      if (data.transferInCommissionPercentage == null) {
        throw new Error('La comisión SPEI IN es requerida');
      }
      const transferInCommissionPercentage = Number(data.transferInCommissionPercentage);
      if (Number.isNaN(transferInCommissionPercentage) || transferInCommissionPercentage < 0 || transferInCommissionPercentage > 100) {
        throw new Error('Comisión SPEI IN inválida');
      }
      await this.ensureCostCentreAccess(requester, data.costCentreId);
      const existingAssignment = await CommissionAgentAssignment.findOne({
        costCentre: data.costCentreId,
        active: true,
      });
      if (existingAssignment) {
        throw new Error('El CECO ya tiene un comisionista asignado');
      }
      const fee = this.toMoney(Number(data.commissionTransferOutFee));
      if (fee.lessThan(this.toMoney(DEFAULT_TRANSACTION_FEE))) {
        throw new Error('Cobro de SPEI OUT inválido');
      }
    }

    await this.clearAssignmentsForUser(user._id.toString());

    user.profileType = data.profileType;
    if (data.reactivate) {
      user.isActive = true;
    }
    if (data.readOnly !== undefined) {
      user.readOnly = data.readOnly;
    }
    if (data.profileType !== 'commissionAgent') {
      user.commissionType = undefined;
      user.rfc = undefined;
      user.commissionTransferOutFee = undefined;
      user.commissionDocuments = undefined;
    }
    await user.save();

    if (data.profileType === 'administrator') {
      const costCentreIds = Array.from(new Set(data.costCentreIds || [])).filter(Boolean);
      await AdminCostCentreAssignment.insertMany(costCentreIds.map((costCentre) => ({
        administrator: user._id,
        costCentre,
        isActive: true,
        createdBy: requester._id,
      })));
    }

    if (data.profileType === 'subaccount') {
      const virtualBagIds = Array.from(new Set(data.virtualBagIds || [])).filter(Boolean);
      await VirtualBagAccount.updateMany(
        { _id: { $in: virtualBagIds } },
        { $addToSet: { assignedUsers: user._id } }
      );
    }

    if (data.profileType === 'commissionAgent') {
      const commissionDocuments = data.commissionDocuments
        ?? await this.uploadCommissionDocuments(user._id.toString(), data.commissionDocumentFiles);

      user.commissionType = data.commissionType;
      user.rfc = data.rfc?.toUpperCase();
      user.commissionTransferOutFee = this.toMoney(Number(data.commissionTransferOutFee));
      user.commissionDocuments = commissionDocuments;
      await user.save();

      await CommissionAgentAssignment.create({
        commissionAgent: user._id,
        costCentre: data.costCentreId,
        transferInCommissionPercentage: Number(data.transferInCommissionPercentage),
        active: true,
      });
    }

    const updatedUser = await UserModel.findById(user._id)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

    return updatedUser!;
  }

  /**
   * Update a user
   */
  async updateUser(requesterId: string, userId: string, data: UpdateUserDTO): Promise<IUser> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:update')) {
      throw new Error('No tienes permiso para editar usuarios');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Check same client
    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      throw new Error('No tienes permiso para editar este usuario');
    }

    // Check if changing to admin role
    if (data.profileType === 'administrator' && user.profileType !== 'administrator') {
      if (!Permissions.userHas(requester, 'users:manage_admins')) {
        throw new Error('No tienes permiso para asignar rol de administrador');
      }
    }

    // Update fields
    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.secondLastName !== undefined) user.secondLastName = data.secondLastName;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.profileType) user.profileType = data.profileType;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.readOnly !== undefined) user.readOnly = data.readOnly;

    await user.save();

    const updatedUser = await UserModel.findById(user._id)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

    return updatedUser!;
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivateUser(requesterId: string, userId: string): Promise<IUser> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:delete')) {
      throw new Error('No tienes permiso para desactivar usuarios');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Can't deactivate yourself
    if (requesterId === userId) {
      throw new Error('No puedes desactivarte a ti mismo');
    }

    // Check same client
    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      throw new Error('No tienes permiso para desactivar este usuario');
    }

    // Can't deactivate corporate user
    if (user.profileType === 'corporate') {
      throw new Error('No se puede desactivar al usuario principal');
    }

    user.isActive = false;
    await user.clearRefreshTokens(); // Logout from all sessions
    await user.save();

    const updatedUser = await UserModel.findById(user._id)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

    return updatedUser!;
  }

  /**
   * Reactivate a user
   */
  async reactivateUser(requesterId: string, userId: string): Promise<IUser> {
    return this.updateUser(requesterId, userId, { isActive: true });
  }

  /**
   * Reset user's 2FA
   */
  async reset2FA(requesterId: string, userId: string): Promise<IUser> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:update')) {
      throw new Error('No tienes permiso para resetear 2FA');
    }

    const user = await UserModel.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Check same client
    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      throw new Error('No tienes permiso para resetear 2FA de este usuario');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();

    const updatedUser = await UserModel.findById(user._id)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -refreshTokens');

    return updatedUser!;
  }

  /**
   * Reset user's password (generates temporary password)
   */
  async resetPassword(requesterId: string, userId: string): Promise<{ tempPassword: string }> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:update')) {
      throw new Error('No tienes permiso para resetear contraseñas');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Check same client
    if (requester.clientId && user.clientId &&
        requester.clientId.toString() !== user.clientId.toString()) {
      throw new Error('No tienes permiso para resetear la contraseña de este usuario');
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

    user.passwordHash = tempPassword; // Will be hashed by pre-save hook
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.clearRefreshTokens(); // Logout from all sessions
    await user.save();

    return { tempPassword };
  }

  /**
   * Get user counts by role for dashboard
   */
  async getUserStats(requesterId: string): Promise<{ total: number; byRole: Record<string, number>; active: number; inactive: number }> {
    const requester = await UserModel.findById(requesterId);
    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    if (!Permissions.userHas(requester, 'users:read')) {
      throw new Error('No tienes permiso para ver usuarios');
    }

    const clientFilter = requester.clientId ? { clientId: requester.clientId } : {};

    const [total, active, byRoleResult] = await Promise.all([
      UserModel.countDocuments(clientFilter),
      UserModel.countDocuments({ ...clientFilter, isActive: true }),
      UserModel.aggregate([
        { $match: clientFilter },
        { $group: { _id: '$profileType', count: { $sum: 1 } } },
      ]),
    ]);

    const byRole: Record<string, number> = {};
    byRoleResult.forEach((r: any) => {
      byRole[r._id] = r.count;
    });

    return {
      total,
      active,
      inactive: total - active,
      byRole,
    };
  }
}

// Export singleton instance
export const usersService = new UsersService();
export default usersService;
