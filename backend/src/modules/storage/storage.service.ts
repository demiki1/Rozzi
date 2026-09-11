import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { MediaAssetStatus, UserRole } from '@prisma/client';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase?: string;

  constructor(private readonly cfg: ConfigService, private readonly prisma: PrismaService) {
    const endpoint = cfg.get<string>('S3_ENDPOINT');
    this.bucket = cfg.get<string>('S3_BUCKET', 'rozzi');
    this.publicBase = cfg.get<string>('S3_PUBLIC_BASE_URL');
    this.client = new S3Client({
      region: cfg.get<string>('S3_REGION', 'us-east-1'),
      endpoint,
      forcePathStyle: cfg.get<string>('S3_FORCE_PATH_STYLE', 'false') === 'true',
      credentials:
        cfg.get<string>('S3_ACCESS_KEY') && cfg.get<string>('S3_SECRET_KEY')
          ? { accessKeyId: cfg.get<string>('S3_ACCESS_KEY')!, secretAccessKey: cfg.get<string>('S3_SECRET_KEY')! }
          : undefined,
    });
  }

  private ensure() {
    if (!this.cfg.get<string>('S3_ACCESS_KEY') || !this.cfg.get<string>('S3_SECRET_KEY')) {
      throw new ServiceUnavailableException('Object storage integration implemented but awaiting S3-compatible credentials.');
    }
  }

  private publicUrlFor(key: string) {
    return this.publicBase ? `${this.publicBase.replace(/\/$/, '')}/${key}` : undefined;
  }

  async createUploadUrl(ownerId: string, contentType: string, sizeBytes: number) {
    this.ensure();
    if (sizeBytes <= 0 || sizeBytes > 20 * 1024 * 1024) throw new ServiceUnavailableException('File must be between 1 byte and 20 MB.');
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(contentType)) throw new ServiceUnavailableException('Unsupported file type.');
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const key = `uploads/${ownerId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    const publicUrl = this.publicUrlFor(key);
    await this.prisma.mediaAsset.create({
      data: { ownerId, key, bucket: this.bucket, mimeType: contentType, sizeBytes, status: MediaAssetStatus.PENDING, publicUrl },
    });
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 900 });
    return { key, bucket: this.bucket, uploadUrl, publicUrl, expiresIn: 900 };
  }

  async completeUpload(ownerId: string, key: string) {
    this.ensure();
    const asset = await this.prisma.mediaAsset.findUnique({ where: { key } });
    if (!asset || asset.ownerId !== ownerId) throw new ForbiddenException('You are not allowed to complete this upload.');
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.key }));
      if (head.ContentLength !== undefined && head.ContentLength > 20 * 1024 * 1024) {
        throw new ServiceUnavailableException('Uploaded file exceeds the allowed size.');
      }
      return this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: MediaAssetStatus.UPLOADED, publicUrl: asset.publicUrl ?? this.publicUrlFor(asset.key) },
      });
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException('Uploaded object could not be verified.');
    }
  }

  async getOwnedPublicImageUrl(ownerId: string, publicUrl: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        ownerId,
        publicUrl,
        status: MediaAssetStatus.UPLOADED,
        mimeType: { startsWith: 'image/' },
      },
    });
    if (!asset?.publicUrl) {
      throw new ForbiddenException('Store media must be an uploaded image owned by your account.');
    }
    return asset.publicUrl;
  }

  async createDownloadUrl(key: string, requester: { userId: string; role: UserRole }) {
    this.ensure();
    const asset = await this.prisma.mediaAsset.findUnique({ where: { key } });
    if (!asset) throw new ForbiddenException('File not found or access denied.');
    const isOwner = asset.ownerId === requester.userId;
    const isAdmin = requester.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) throw new ForbiddenException('You are not allowed to access this file.');
    if (asset.status !== MediaAssetStatus.UPLOADED && !isAdmin) throw new ForbiddenException('File is not available yet.');
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: asset.bucket, Key: asset.key }), { expiresIn: 900 });
  }
}
