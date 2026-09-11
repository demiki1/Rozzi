import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  VendorDocumentStatus,
  VendorStatus,
  VendorVerificationStatus,
  NotificationType,
} from '@prisma/client';

const REQUIRED_DOCUMENTS = [
  {
    type: 'BUSINESS_REGISTRATION',
    label: 'Business registration / CAC document',
    required: true,
  },
  {
    type: 'IDENTITY_DOCUMENT',
    label: 'Owner identity document',
    required: true,
  },
  {
    type: 'STORE_PROOF',
    label: 'Store / business location proof',
    required: true,
  },
];

@Injectable()
export class VendorOnboardingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
    private notifications: NotificationsService,
  ) {}

  async getMine(userId: string) {
    return this.snapshot((await this.vendor(userId)).id);
  }

  async save(
    userId: string,
    data: { adminNote?: string },
  ) {
    const v = await this.vendor(userId);

    const lockedStatuses: VendorStatus[] = [
      VendorStatus.APPROVED,
      VendorStatus.SUSPENDED,
    ];

    if (lockedStatuses.includes(v.status)) {
      throw new ForbiddenException(
        'Onboarding cannot be edited while the store is active or suspended.',
      );
    }

    await this.prisma.vendorVerification.upsert({
      where: { vendorId: v.id },
      create: {
        vendorId: v.id,
        status: VendorVerificationStatus.IN_PROGRESS,
        adminNote: data.adminNote,
      },
      update: {
        status: VendorVerificationStatus.IN_PROGRESS,
        adminNote: data.adminNote,
      },
    });

    return this.snapshot(v.id);
  }

  async addDocument(
    userId: string,
    docType: string,
    fileUrl: string,
  ) {
    const v = await this.vendor(userId);

    const lockedStatuses: VendorStatus[] = [
      VendorStatus.APPROVED,
      VendorStatus.SUSPENDED,
    ];

    if (lockedStatuses.includes(v.status)) {
      throw new ForbiddenException(
        'Documents cannot be changed while the store is active or suspended.',
      );
    }

    if (!docType?.trim() || !fileUrl?.trim()) {
      throw new BadRequestException(
        'Document type and file URL are required.',
      );
    }

    const row = await this.prisma.vendorDocument.create({
      data: {
        vendorId: v.id,
        docType: docType.trim(),
        fileUrl: fileUrl.trim(),
      },
    });

    await this.prisma.vendorVerification.upsert({
      where: { vendorId: v.id },
      create: {
        vendorId: v.id,
        status: VendorVerificationStatus.IN_PROGRESS,
      },
      update: {
        status: VendorVerificationStatus.IN_PROGRESS,
      },
    });

    return row;
  }

  async submit(userId: string) {
    const v = await this.vendor(userId);
    const snap = await this.snapshot(v.id);

    const missing = snap.checklist
      .filter((x: any) => x.required && !x.complete)
      .map((x: any) => x.label);

    if (missing.length) {
      throw new BadRequestException(
        `Complete these requirements before submitting: ${missing.join(', ')}.`,
      );
    }

    const ver =
      await this.prisma.vendorVerification.upsert({
        where: { vendorId: v.id },
        create: {
          vendorId: v.id,
          status: VendorVerificationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        update: {
          status: VendorVerificationStatus.SUBMITTED,
          submittedAt: new Date(),
          rejectionReason: null,
        },
      });

    await this.prisma.vendor.update({
      where: { id: v.id },
      data: {
        status: VendorStatus.PENDING,
        isOpen: false,
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'vendor.verification.submit',
      entityType: 'Vendor',
      entityId: v.id,
      before: {
        status: v.status,
      },
      after: {
        status: VendorStatus.PENDING,
        verificationStatus: ver.status,
      },
    });

    return this.snapshot(v.id);
  }

  async adminList(status?: VendorVerificationStatus) {
    return this.prisma.vendorVerification.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'asc' },
      include: {
        vendor: {
          select: {
            id: true,
            storeName: true,
            status: true,
            createdAt: true,
            vendorType: {
              select: {
                name: true,
              },
            },
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                isEmailVerified: true,
                isPhoneVerified: true,
              },
            },
            locations: {
              select: {
                address: true,
                serviceArea: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
            documents: {
              orderBy: {
                uploadedAt: 'desc',
              },
            },
          },
        },
      },
    });
  }

  async adminReview(
    id: string,
    actorId: string,
    status: VendorVerificationStatus,
    reason?: string,
    note?: string,
  ) {
    const c =
      await this.prisma.vendorVerification.findUnique({
        where: { id },
        include: { vendor: true },
      });

    if (!c) {
      throw new NotFoundException(
        'Verification case not found.',
      );
    }

    if (status === VendorVerificationStatus.APPROVED) {
      const snap = await this.snapshot(c.vendorId);

      if (
        snap.checklist.some(
          (x: any) => x.required && !x.complete,
        )
      ) {
        throw new BadRequestException(
          'All required verification items must be approved before approving the vendor.',
        );
      }
    }

    const vs =
      status === VendorVerificationStatus.APPROVED
        ? VendorStatus.APPROVED
        : status === VendorVerificationStatus.REJECTED
          ? VendorStatus.REJECTED
          : VendorStatus.PENDING;

    const rejectionStatuses: VendorVerificationStatus[] = [
      VendorVerificationStatus.REJECTED,
      VendorVerificationStatus.NEEDS_INFORMATION,
    ];

    const out = await this.prisma.$transaction(
      async (tx) => {
        const ver =
          await tx.vendorVerification.update({
            where: { id },
            data: {
              status,
              reviewedAt: new Date(),
              reviewedById: actorId,
              rejectionReason: rejectionStatuses.includes(
                status,
              )
                ? reason || null
                : null,
              adminNote: note || c.adminNote,
            },
          });

        const vendor = await tx.vendor.update({
          where: { id: c.vendorId },
          data: {
            status: vs,
            isOpen:
              vs === VendorStatus.APPROVED
                ? c.vendor.isOpen
                : false,
          },
        });

        return { ver, vendor };
      },
    );

    await this.audit.record({
      actorId,
      action: `vendor.verification.${status.toLowerCase()}`,
      entityType: 'Vendor',
      entityId: c.vendorId,
      before: {
        vendorStatus: c.vendor.status,
        verificationStatus: c.status,
      },
      after: {
        vendorStatus: out.vendor.status,
        verificationStatus: out.ver.status,
        reason,
        note,
      },
    });

    const copy =
      status === VendorVerificationStatus.APPROVED
        ? [
            'Vendor verification approved',
            'Your store verification has been approved.',
          ]
        : status === VendorVerificationStatus.REJECTED
          ? [
              'Vendor verification rejected',
              `Your verification needs attention. ${
                reason || 'Please review the requirements.'
              }`,
            ]
          : status ===
              VendorVerificationStatus.NEEDS_INFORMATION
            ? [
                'More information required',
                `ROZZI needs more information. ${
                  reason ||
                  'Open Onboarding & Verification to review the request.'
                }`,
              ]
            : [
                'Vendor verification under review',
                'Your vendor verification is now under review.',
              ];

    await this.notifications.notify(
      c.vendor.ownerUserId,
      {
        title: copy[0],
        message: copy[1],
        type: NotificationType.ACCOUNT,
      },
    );

    return this.snapshot(c.vendorId);
  }

  async adminReviewDocument(
    id: string,
    actorId: string,
    status: VendorDocumentStatus,
    reason?: string,
  ) {
    const d =
      await this.prisma.vendorDocument.findUnique({
        where: { id },
      });

    if (!d) {
      throw new NotFoundException(
        'Vendor document not found.',
      );
    }

    const u = await this.prisma.vendorDocument.update({
      where: { id },
      data: {
        status,
        verified:
          status === VendorDocumentStatus.APPROVED,
        rejectionReason:
          status === VendorDocumentStatus.REJECTED
            ? reason || null
            : null,
        reviewedAt: new Date(),
        reviewedById: actorId,
      },
    });

    await this.audit.record({
      actorId,
      action: `vendor.document.${status.toLowerCase()}`,
      entityType: 'VendorDocument',
      entityId: id,
      before: {
        status: d.status,
      },
      after: {
        status: u.status,
        reason,
      },
    });

    return u;
  }

  private async vendor(userId: string) {
    return vendorForUser(this.prisma, userId);
  }

  private async snapshot(vendorId: string) {
    const v = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        vendorType: true,
        locations: {
          include: {
            serviceArea: true,
          },
        },
        documents: {
          orderBy: {
            uploadedAt: 'desc',
          },
        },
        verification: true,
        paymentAccount: true,
      },
    });

    if (!v) {
      throw new NotFoundException('Vendor not found.');
    }

    const docs = v.documents;

    const approved = (t: string) =>
      docs.some(
        (d) =>
          d.docType === t &&
          d.status === VendorDocumentStatus.APPROVED,
      );

    const checklist = [
      {
        key: 'business',
        label: 'Business information',
        required: true,
        complete:
          !!v.storeName &&
          !!v.vendorTypeId &&
          !!v.phone,
      },
      {
        key: 'location',
        label: 'Store location',
        required: true,
        complete:
          v.locations.length > 0 &&
          !!v.locations[0].address,
      },
      {
        key: 'hours',
        label: 'Opening hours',
        required: true,
        complete:
          !!v.operatingHoursJson ||
          (!!v.operatingHoursStart &&
            !!v.operatingHoursEnd),
      },
      {
        key: 'identity',
        label: 'Owner identity document',
        required: true,
        complete: approved('IDENTITY_DOCUMENT'),
      },
      {
        key: 'businessDoc',
        label: 'Business registration / CAC document',
        required: true,
        complete: approved('BUSINESS_REGISTRATION'),
      },
      {
        key: 'storeProof',
        label: 'Store / business location proof',
        required: true,
        complete: approved('STORE_PROOF'),
      },
      {
        key: 'bank',
        label: 'Bank / payout account',
        required: true,
        complete:
          v.paymentAccount?.status === 'VERIFIED',
      },
      {
        key: 'branding',
        label: 'Logo or cover image',
        required: false,
        complete:
          !!v.logoUrl || !!v.coverImageUrl,
      },
      {
        key: 'catalogue',
        label: 'Categories and products',
        required: false,
        complete:
          (await this.prisma.product.count({
            where: { vendorId },
          })) > 0,
      },
    ];

    return {
      vendor: {
        id: v.id,
        storeName: v.storeName,
        status: v.status,
        vendorType: v.vendorType?.name || null,
        logoUrl: v.logoUrl,
        coverImageUrl: v.coverImageUrl,
        phone: v.phone,
        email: v.email,
        location: v.locations[0]
          ? {
              address: v.locations[0].address,
              serviceArea:
                v.locations[0].serviceArea?.name,
            }
          : null,
      },
      verification:
        v.verification || {
          status: VendorVerificationStatus.NOT_STARTED,
        },
      paymentAccount: v.paymentAccount
        ? {
            status: v.paymentAccount.status,
            bankName: v.paymentAccount.bankName,
            accountName: v.paymentAccount.accountName,
            accountNumberLast4:
              v.paymentAccount.accountNumberLast4,
          }
        : null,
      documents: docs.map((d) => ({
        id: d.id,
        docType: d.docType,
        fileUrl: d.fileUrl,
        status: d.status,
        verified: d.verified,
        rejectionReason: d.rejectionReason,
        uploadedAt: d.uploadedAt,
      })),
      checklist,
      percentage: Math.round(
        (checklist.filter((x) => x.complete).length /
          checklist.length) *
          100,
      ),
      requiredDocuments: REQUIRED_DOCUMENTS,
    };
  }
}