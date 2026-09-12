import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogService } from '../audit/audit-log.service';
import {
  RegisterRiderDto,
  UpdateRiderProfileDto,
  UpdateRiderLocationDto,
} from './dto/rider.dto';
import { RiderStatus, OrderStatus } from '@prisma/client';

const WORKING_STATUSES: RiderStatus[] = [
  RiderStatus.APPROVED,
  RiderStatus.ACTIVE,
];

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(ownerUserId: string, dto: RegisterRiderDto) {
    const existing = await this.prisma.rider.findUnique({
      where: { ownerUserId },
    });

    if (existing) {
      throw new ConflictException(
        'This account already has a rider profile.',
      );
    }

    const areas = await this.prisma.serviceArea.findMany({
      where: {
        id: { in: dto.serviceAreaIds },
        status: 'ACTIVE',
      },
    });

    if (areas.length !== dto.serviceAreaIds.length) {
      throw new NotFoundException(
        'One or more service areas were not found or are inactive.',
      );
    }

    return this.prisma.rider.create({
      data: {
        ownerUserId,
        vehicleType: dto.vehicleType,
        vehiclePlateNumber: dto.vehiclePlateNumber,
        address: dto.address,
        profilePhotoUrl: dto.profilePhotoUrl,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankName: dto.bankName,
        status: RiderStatus.PENDING,
        zones: {
          create: dto.serviceAreaIds.map((serviceAreaId) => ({
            serviceAreaId,
          })),
        },
      },
      include: {
        zones: {
          include: {
            serviceArea: true,
          },
        },
      },
    });
  }

  async getByOwner(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { ownerUserId },
      include: {
        zones: {
          include: {
            serviceArea: true,
          },
        },
        documents: true,
        location: true,
      },
    });

    if (!rider) {
      throw new NotFoundException(
        'No rider profile found for this account.',
      );
    }

    return rider;
  }

  async updateProfile(
    ownerUserId: string,
    dto: UpdateRiderProfileDto,
  ) {
    const rider = await this.getByOwner(ownerUserId);

    return this.prisma.rider.update({
      where: { id: rider.id },
      data: dto,
    });
  }

  async addServiceArea(
    ownerUserId: string,
    serviceAreaId: string,
  ) {
    const rider = await this.getByOwner(ownerUserId);

    const area = await this.prisma.serviceArea.findUnique({
      where: { id: serviceAreaId },
    });

    if (!area) {
      throw new NotFoundException('Service area not found.');
    }

    if (area.status !== 'ACTIVE') {
      throw new BadRequestException('Only active service areas can be added.');
    }

    return this.prisma.riderZone.upsert({
      where: {
        riderId_serviceAreaId: {
          riderId: rider.id,
          serviceAreaId,
        },
      },
      update: {},
      create: {
        riderId: rider.id,
        serviceAreaId,
      },
    });
  }

  async uploadDocument(
    ownerUserId: string,
    docType: string,
    fileUrl: string,
    expiryDate?: string,
  ) {
    const rider = await this.getByOwner(ownerUserId);

    return this.prisma.riderDocument.create({
      data: {
        riderId: rider.id,
        docType,
        fileUrl,
        expiryDate: expiryDate
          ? new Date(expiryDate)
          : undefined,
      },
    });
  }

  async goOnline(ownerUserId: string) {
    const rider = await this.getByOwner(ownerUserId);

    if (!WORKING_STATUSES.includes(rider.status)) {
      throw new ForbiddenException(
        'Only approved riders can go online. Your account is still under review.',
      );
    }

    if (!rider.location) {
      throw new BadRequestException(
        'Share your current location before going online.',
      );
    }

    return this.prisma.rider.update({
      where: { id: rider.id },
      data: {
        isOnline: true,
        status:
          rider.status === RiderStatus.APPROVED
            ? RiderStatus.ACTIVE
            : rider.status,
      },
    });
  }

  async goOffline(ownerUserId: string) {
    const rider = await this.getByOwner(ownerUserId);

    const active = await this.prisma.delivery.findFirst({
      where: {
        riderId: rider.id,
        deliveredAt: null,
        order: {
          status: {
            in: [
              'RIDER_ASSIGNED',
              'RIDER_ARRIVED_PICKUP',
              'PICKED_UP',
              'IN_TRANSIT',
              'RIDER_ARRIVED',
            ],
          },
        },
      },
    });

    if (active) {
      throw new BadRequestException(
        'You cannot go offline while you have an active delivery.',
      );
    }

    return this.prisma.rider.update({
      where: { id: rider.id },
      data: { isOnline: false },
    });
  }

  async updateLocation(
    ownerUserId: string,
    dto: UpdateRiderLocationDto,
  ) {
    const rider = await this.getByOwner(ownerUserId);

    const location = await this.prisma.riderLocation.upsert({
      where: { riderId: rider.id },
      update: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      create: {
        riderId: rider.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    this.eventEmitter.emit('rider.location.updated', {
      riderId: rider.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      updatedAt: location.updatedAt.toISOString(),
    });

    return location;
  }

  async createIssue(
    ownerUserId: string,
    dto: {
      category: string;
      subject: string;
      description: string;
      deliveryId?: string;
    },
  ) {
    const rider = await this.getByOwner(ownerUserId);

    if (!dto.category?.trim()) {
      throw new BadRequestException('Issue category is required.');
    }
    if (!dto.subject?.trim()) {
      throw new BadRequestException('Issue subject is required.');
    }
    if (!dto.description?.trim()) {
      throw new BadRequestException('Issue description is required.');
    }

    if (dto.deliveryId) {
      const delivery = await this.prisma.delivery.findFirst({
        where: {
          id: dto.deliveryId,
          riderId: rider.id,
        },
        select: { id: true },
      });

      if (!delivery) {
        throw new NotFoundException(
          'Delivery not found or is not assigned to this rider.',
        );
      }
    }

    const issue = await this.prisma.riderIssue.create({
      data: {
        riderId: rider.id,
        deliveryId: dto.deliveryId || null,
        category: dto.category.trim(),
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        status: 'OPEN',
      },
    });

    await this.auditLog.record({
      actorId: ownerUserId,
      action: 'rider.issue_created',
      entityType: 'RiderIssue',
      entityId: issue.id,
      after: {
        riderId: rider.id,
        deliveryId: issue.deliveryId,
        category: issue.category,
        subject: issue.subject,
        status: issue.status,
      },
    });

    return issue;
  }

  async listIssues(ownerUserId: string) {
    const rider = await this.getByOwner(ownerUserId);

    return this.prisma.riderIssue.findMany({
      where: { riderId: rider.id },
      include: {
        delivery: {
          select: {
            id: true,
            orderId: true,
            order: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestReassignment(
    ownerUserId: string,
    deliveryId: string,
    reason: string,
  ) {
    const rider = await this.getByOwner(ownerUserId);

    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, riderId: rider.id },
      select: {
        id: true,
        orderId: true,
        order: { select: { status: true } },
      },
    });

    if (!delivery) {
      throw new NotFoundException(
        'Delivery not found or is not assigned to this rider.',
      );
    }

    const activeDeliveryStatuses: OrderStatus[] = [
      OrderStatus.RIDER_ASSIGNED,
      OrderStatus.RIDER_ARRIVED_PICKUP,
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.RIDER_ARRIVED,
    ];

    if (!activeDeliveryStatuses.includes(delivery.order.status)) {
      throw new BadRequestException(
        'This delivery is no longer eligible for reassignment.',
      );
    }

    const description =
      reason?.trim() ||
      'Rider requested reassignment of this delivery.';

    const issue = await this.prisma.riderIssue.create({
      data: {
        riderId: rider.id,
        deliveryId: delivery.id,
        category: 'REASSIGNMENT',
        subject: 'Delivery reassignment request',
        description,
        status: 'OPEN',
      },
    });

    await this.auditLog.record({
      actorId: ownerUserId,
      action: 'rider.reassignment_requested',
      entityType: 'Delivery',
      entityId: delivery.id,
      after: {
        riderId: rider.id,
        issueId: issue.id,
        orderId: delivery.orderId,
        reason: description,
        deliveryStatus: delivery.order.status,
      },
    });

    return issue;
  }

  async listAdmin(status?: RiderStatus) {
    return this.prisma.rider.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        status: true,
        isOnline: true,
        vehicleType: true,
        vehiclePlateNumber: true,
        createdAt: true,
        updatedAt: true,
        rejectionReason: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        zones: {
          select: {
            serviceArea: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        location: {
          select: {
            latitude: true,
            longitude: true,
            updatedAt: true,
          },
        },
        documents: {
          select: {
            id: true,
            docType: true,
            verified: true,
            uploadedAt: true,
            fileUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPending() {
    return this.prisma.rider.findMany({
      where: {
        status: {
          in: [RiderStatus.PENDING, RiderStatus.UNDER_REVIEW],
        },
      },
      include: {
        documents: true,
        zones: { include: { serviceArea: true } },
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startReview(riderId: string, actorId: string) {
    const rider = await this.getRiderOrThrow(riderId);

    if (rider.status !== RiderStatus.PENDING) {
      throw new BadRequestException(
        'Only pending riders can be moved to review.',
      );
    }

    const updated = await this.prisma.rider.update({
      where: { id: riderId },
      data: { status: RiderStatus.UNDER_REVIEW },
    });

    await this.auditLog.record({
      actorId,
      action: 'rider.start_review',
      entityType: 'Rider',
      entityId: riderId,
      before: { status: rider.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async approve(riderId: string, actorId: string) {
    const before = await this.getRiderOrThrow(riderId);

    const updated = await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        status: RiderStatus.APPROVED,
        rejectionReason: null,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'rider.approve',
      entityType: 'Rider',
      entityId: riderId,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async reject(riderId: string, actorId: string, reason?: string) {
    const before = await this.getRiderOrThrow(riderId);

    const updated = await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        status: RiderStatus.PENDING,
        rejectionReason: reason,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'rider.reject',
      entityType: 'Rider',
      entityId: riderId,
      before: { status: before.status },
      after: { status: updated.status, reason },
    });

    return updated;
  }

  async suspend(riderId: string, actorId: string) {
    const before = await this.getRiderOrThrow(riderId);

    const updated = await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        status: RiderStatus.SUSPENDED,
        isOnline: false,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'rider.suspend',
      entityType: 'Rider',
      entityId: riderId,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async listByZone(serviceAreaId: string) {
    return this.prisma.rider.findMany({
      where: {
        zones: { some: { serviceAreaId } },
      },
      include: { location: true },
    });
  }

  private async getRiderOrThrow(id: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { id },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found.');
    }

    return rider;
  }
}