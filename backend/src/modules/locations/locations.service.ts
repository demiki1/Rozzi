import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateLocationDto,
  UpdateLocationDto,
} from './dto/location.dto';
import {
  CreateServiceAreaDto,
  UpdateServiceAreaDto,
  UpdateServiceAreaStatusDto,
} from './dto/service-area.dto';
import { ServiceAreaStatus } from '@prisma/client';

// This service is the single place that knows how the location tree works.
// Nothing outside this module (and nothing in vendor/order/rider modules
// later) should reference a location by name in a conditional — they should
// always resolve/query by serviceAreaId. That's what makes §108's
// requirement ("FUTO is a location, not the foundation") actually true in
// code rather than just in a comment.
@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---- Location tree (Country/State/City/University/Campus/...) ----

  async createLocation(dto: CreateLocationDto, actorId: string) {
    if (dto.parentId) {
      const parent = await this.prisma.location.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent location not found.');
      }
    }

    const created = await this.prisma.location.create({
      data: dto,
    });

    await this.auditLog.record({
      actorId,
      action: 'location.create',
      entityType: 'Location',
      entityId: created.id,
      after: created,
    });

    return created;
  }

  async updateLocation(
    id: string,
    dto: UpdateLocationDto,
    actorId: string,
  ) {
    const before = await this.getLocationOrThrow(id);

    const updated = await this.prisma.location.update({
      where: { id },
      data: dto,
    });

    await this.auditLog.record({
      actorId,
      action: 'location.update',
      entityType: 'Location',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async deactivateLocation(id: string, actorId: string) {
    const before = await this.getLocationOrThrow(id);

    const updated = await this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLog.record({
      actorId,
      action: 'location.deactivate',
      entityType: 'Location',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: updated.isActive },
    });

    return updated;
  }

  async getLocationTree(rootId?: string) {
    // Simple recursive fetch; fine at this scale. Revisit with a recursive
    // CTE / materialized path if the tree gets very deep or very wide.
    const roots = rootId
      ? [await this.getLocationOrThrow(rootId)]
      : await this.prisma.location.findMany({
          where: { parentId: null },
        });

    const attachChildren = async (node: any): Promise<any> => {
      const children = await this.prisma.location.findMany({
        where: { parentId: node.id },
      });

      return {
        ...node,
        children: await Promise.all(children.map(attachChildren)),
      };
    };

    return Promise.all(roots.map(attachChildren));
  }

  private async getLocationOrThrow(id: string) {
    const loc = await this.prisma.location.findUnique({
      where: { id },
    });

    if (!loc) {
      throw new NotFoundException('Location not found.');
    }

    return loc;
  }

  // ---- Service areas (the operational unit) ----

  async createServiceArea(
    dto: CreateServiceAreaDto,
    actorId: string,
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found.');
    }

    /*
     * Pricing is now managed by PricingConfig, not by the legacy
     * ServiceArea pricing fields.
     *
     * A new service area receives the platform's default pricing
     * configuration immediately so checkout can use it without waiting
     * for an admin to open the Pricing page.
     */
    const created = await this.prisma.$transaction(async (tx) => {
      const serviceArea = await tx.serviceArea.create({
        data: {
          locationId: dto.locationId,
          name: dto.name,
          minimumOrderAmount: dto.minimumOrderAmount ?? 0,
          operatingHoursStart: dto.operatingHoursStart ?? '08:00',
          operatingHoursEnd: dto.operatingHoursEnd ?? '23:00',
          status: ServiceAreaStatus.DRAFT,
        },
      });

      await tx.pricingConfig.create({
        data: {
          serviceAreaId: serviceArea.id,

          isActive: true,

          // ROZZI default pricing
          serviceFeeRatePercent: 5,
          serviceFeeCapAmount: 100000,

          baseDeliveryFee: 45000,
          perKmDeliveryFee: 10000,
          deliveryRadiusKm: 8,

          surgeEnabled: true,
          surgeSlightlyHighAmount: 10000,
          surgeHighAmount: 20000,
          surgeVeryHighAmount: 30000,
          surgeMaxAmount: 30000,
        },
      });

      return serviceArea;
    });

    await this.auditLog.record({
      actorId,
      action: 'service_area.create',
      entityType: 'ServiceArea',
      entityId: created.id,
      after: created,
    });

    return created;
  }

  async listServiceAreas(status?: ServiceAreaStatus) {
    return this.prisma.serviceArea.findMany({
      where: status ? { status } : undefined,
      include: {
        location: true,
        deliveryZones: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getServiceArea(id: string) {
    const area = await this.prisma.serviceArea.findUnique({
      where: { id },
      include: {
        location: true,
        deliveryZones: true,
      },
    });

    if (!area) {
      throw new NotFoundException('Service area not found.');
    }

    return area;
  }

  async updateServiceArea(
    id: string,
    dto: UpdateServiceAreaDto,
    actorId: string,
  ) {
    const before = await this.getServiceArea(id);

    const updated = await this.prisma.serviceArea.update({
      where: { id },
      data: {
        name: dto.name,
        minimumOrderAmount: dto.minimumOrderAmount,
        operatingHoursStart: dto.operatingHoursStart,
        operatingHoursEnd: dto.operatingHoursEnd,
      },
      include: {
        location: true,
        deliveryZones: true,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'service_area.update',
      entityType: 'ServiceArea',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  // §95: "ACTIVATE LOCATION" checklist button. Still just the single
  // "has at least one delivery zone" check from Phase 1 — a fuller launch
  // checklist (has vendors, has categories enabled, payment method
  // configured) is still a gap, not something this phase added.
  async updateServiceAreaStatus(
    id: string,
    dto: UpdateServiceAreaStatusDto,
    actorId: string,
  ) {
    const before = await this.getServiceArea(id);

    if (dto.status === ServiceAreaStatus.ACTIVE) {
      const [zoneCount, vendorCount, categoryCount] =
        await Promise.all([
          this.prisma.deliveryZone.count({
            where: {
              serviceAreaId: id,
              isActive: true,
            },
          }),
          this.prisma.vendorLocation.count({
            where: {
              serviceAreaId: id,
              vendor: {
                status: 'APPROVED',
              },
            },
          }),
          this.prisma.category.count({
            where: {
              isActive: true,
            },
          }),
        ]);

      if (zoneCount === 0) {
        throw new BadRequestException(
          'Cannot activate a service area with no active delivery zones configured.',
        );
      }

      if (vendorCount === 0) {
        throw new BadRequestException(
          'Cannot activate a service area with no approved vendor assigned.',
        );
      }

      if (categoryCount === 0) {
        throw new BadRequestException(
          'Cannot activate a service area with no active categories.',
        );
      }
    }

    const updated = await this.prisma.serviceArea.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditLog.record({
      actorId,
      action: 'service_area.status_change',
      entityType: 'ServiceArea',
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return updated;
  }

  // ---- Delivery zones ----

  async createDeliveryZone(
    serviceAreaId: string,
    name: string,
    actorId: string,
    radiusKm?: number,
  ) {
    await this.getServiceArea(serviceAreaId);

    const created = await this.prisma.deliveryZone.create({
      data: {
        serviceAreaId,
        name,
        radiusKm,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'delivery_zone.create',
      entityType: 'DeliveryZone',
      entityId: created.id,
      after: created,
    });

    return created;
  }

  // ---- Customer-facing availability check (§4, §85) ----

  async checkAvailability(serviceAreaId: string) {
    const area = await this.prisma.serviceArea.findUnique({
      where: { id: serviceAreaId },
    });

    if (!area || area.status !== ServiceAreaStatus.ACTIVE) {
      return { available: false };
    }

    return {
      available: true,
      serviceArea: area,
    };
  }

  async joinWaitlist(data: {
    phone?: string;
    email?: string;
    serviceAreaId?: string;
    requestedPlace?: string;
  }) {
    if (!data.phone && !data.email) {
      throw new BadRequestException(
        'Provide a phone number or email to join the waitlist.',
      );
    }

    return this.prisma.waitlistEntry.create({
      data,
    });
  }
}