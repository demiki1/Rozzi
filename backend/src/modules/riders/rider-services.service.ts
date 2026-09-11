import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RiderAcademyProgressStatus, RiderEquipmentStatus, RiderInsuranceStatus, RiderMaintenanceType } from '@prisma/client';

@Injectable()
export class RiderServicesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  private async rider(ownerUserId: string) {
    const rider = await this.prisma.rider.findUnique({ where: { ownerUserId } });
    if (!rider) throw new NotFoundException('No rider profile found for this account.');
    return rider;
  }

  async serviceOverview(ownerUserId: string) {
    const rider = await this.rider(ownerUserId);
    const [issues, documents, insurances, equipment, maintenance, academy, sos] = await Promise.all([
      this.prisma.riderIssue.findMany({ where: { riderId: rider.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.riderDocument.findMany({ where: { riderId: rider.id }, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.riderInsurance.findMany({ where: { riderId: rider.id }, orderBy: { expiryDate: 'asc' } }),
      this.prisma.riderEquipment.findMany({ where: { riderId: rider.id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.riderVehicleMaintenance.findMany({ where: { riderId: rider.id }, orderBy: { serviceDate: 'desc' }, take: 10 }),
      this.prisma.riderAcademyProgress.findMany({ where: { riderId: rider.id }, orderBy: { title: 'asc' } }),
      this.prisma.riderSosEvent.findMany({ where: { riderId: rider.id }, orderBy: { triggeredAt: 'desc' }, take: 5 }),
    ]);
    const now = new Date();
    return {
      safety: { openIssues: issues.filter(i => i.status === 'OPEN').length, activeSos: sos.filter(x => x.status === 'OPEN').length },
      documents,
      insurance: insurances,
      equipment,
      maintenance,
      academy,
      recentIssues: issues,
      recentSos: sos,
      alerts: {
        expiringInsurance: insurances.filter(i => i.expiryDate <= new Date(now.getTime() + 30 * 86400000)).length,
        overdueMaintenance: maintenance.filter(m => m.nextDueDate && m.nextDueDate < now).length,
      },
    };
  }

  async insurances(ownerUserId: string) { const r=await this.rider(ownerUserId); return this.prisma.riderInsurance.findMany({where:{riderId:r.id},orderBy:{expiryDate:'asc'}}); }
  async addInsurance(ownerUserId: string, body: any) {
    const r=await this.rider(ownerUserId); const expiry=new Date(body.expiryDate), start=new Date(body.startDate);
    if (!body.provider || !body.policyNumber || !body.coverageType || !Number.isFinite(start.getTime()) || !Number.isFinite(expiry.getTime()) || expiry<=start) throw new BadRequestException('Provide valid insurance details and dates.');
    const item=await this.prisma.riderInsurance.create({data:{riderId:r.id,provider:body.provider,policyNumber:body.policyNumber,coverageType:body.coverageType,startDate:start,expiryDate:expiry,documentUrl:body.documentUrl,notes:body.notes,status:RiderInsuranceStatus.PENDING}});
    await this.audit.record({actorId:r.ownerUserId,action:'RIDER_INSURANCE_ADDED',entityType:'RiderInsurance',entityId:item.id,after:{provider:item.provider,policyNumber:item.policyNumber}}); return item;
  }

  async maintenance(ownerUserId: string) { const r=await this.rider(ownerUserId); return this.prisma.riderVehicleMaintenance.findMany({where:{riderId:r.id},orderBy:{serviceDate:'desc'}}); }
  async addMaintenance(ownerUserId: string, body: any) {
    const r=await this.rider(ownerUserId); const serviceDate=new Date(body.serviceDate); const type=body.type as RiderMaintenanceType;
    if (!Object.values(RiderMaintenanceType).includes(type) || !body.description || !Number.isFinite(serviceDate.getTime())) throw new BadRequestException('Provide valid maintenance details.');
    const item=await this.prisma.riderVehicleMaintenance.create({data:{riderId:r.id,type,description:body.description,odometerKm:body.odometerKm!=null?Number(body.odometerKm):undefined,costAmount:body.costAmount!=null?Number(body.costAmount):undefined,serviceDate,nextDueDate:body.nextDueDate?new Date(body.nextDueDate):undefined,nextDueKm:body.nextDueKm!=null?Number(body.nextDueKm):undefined,receiptUrl:body.receiptUrl,notes:body.notes}});
    await this.audit.record({actorId:r.ownerUserId,action:'RIDER_MAINTENANCE_ADDED',entityType:'RiderVehicleMaintenance',entityId:item.id}); return item;
  }

  async equipment(ownerUserId: string) { const r=await this.rider(ownerUserId); return this.prisma.riderEquipment.findMany({where:{riderId:r.id},orderBy:{createdAt:'desc'}}); }
  async requestEquipment(ownerUserId: string, body: any) {
    const r=await this.rider(ownerUserId); if (!body.itemType) throw new BadRequestException('Equipment type is required.');
    const item=await this.prisma.riderEquipment.create({data:{riderId:r.id,itemType:body.itemType,notes:body.notes,status:RiderEquipmentStatus.REQUESTED}});
    await this.audit.record({actorId:r.ownerUserId,action:'RIDER_EQUIPMENT_REQUESTED',entityType:'RiderEquipment',entityId:item.id}); return item;
  }
  async requestReplacement(ownerUserId: string, id: string) {
    const r=await this.rider(ownerUserId); const item=await this.prisma.riderEquipment.findFirst({where:{id,riderId:r.id}}); if(!item) throw new NotFoundException('Equipment item not found.');
    return this.prisma.riderEquipment.update({where:{id},data:{status:RiderEquipmentStatus.REPLACEMENT_REQUESTED,replacementRequestedAt:new Date()}});
  }

  async academy(ownerUserId: string) {
    const r=await this.rider(ownerUserId); const defaults=[
      ['ROZZI_BASICS','How ROZZI works','Marketplace, rider workflow and delivery standards.'],['DELIVERY_PROCEDURES','Delivery procedures','Pickup, transit, arrival and proof of delivery.'],['CUSTOMER_SERVICE','Customer service','Professional communication and issue handling.'],['FOOD_HANDLING','Food handling','Safe handling practices for applicable orders.'],['SAFETY','Rider safety','Road, delivery and personal safety.'],['NAVIGATION','Navigation','Location, routes and map best practices.'],['CASH_HANDLING','Cash handling','Collection, reconciliation and remittance.'],['FRAUD_PREVENTION','Fraud prevention','Recognize and report suspicious activity.'],['VEHICLE_SAFETY','Vehicle safety','Pre-ride checks and maintenance basics.'],] as const;
    for(const [code,title,description] of defaults) await this.prisma.riderAcademyProgress.upsert({where:{riderId_code:{riderId:r.id,code}},update:{},create:{riderId:r.id,code,title,description}});
    return this.prisma.riderAcademyProgress.findMany({where:{riderId:r.id},orderBy:{title:'asc'}});
  }
  async academyStart(ownerUserId:string,id:string){const r=await this.rider(ownerUserId);const x=await this.prisma.riderAcademyProgress.findFirst({where:{id,riderId:r.id}});if(!x)throw new NotFoundException('Academy module not found.');return this.prisma.riderAcademyProgress.update({where:{id},data:{status:RiderAcademyProgressStatus.IN_PROGRESS,startedAt:x.startedAt||new Date()}})}
  async academyComplete(ownerUserId:string,id:string,scorePercent?:number){const r=await this.rider(ownerUserId);const x=await this.prisma.riderAcademyProgress.findFirst({where:{id,riderId:r.id}});if(!x)throw new NotFoundException('Academy module not found.');const score=scorePercent==null?undefined:Number(scorePercent);if(score!=null&&(score<0||score>100))throw new BadRequestException('Score must be between 0 and 100.');return this.prisma.riderAcademyProgress.update({where:{id},data:{status:RiderAcademyProgressStatus.COMPLETED,completedAt:new Date(),scorePercent:score}})}

  async sos(ownerUserId:string, body:any={}) {
    const r=await this.rider(ownerUserId); const lat=body.latitude!=null?Number(body.latitude):undefined, lon=body.longitude!=null?Number(body.longitude):undefined;
    const item=await this.prisma.riderSosEvent.create({data:{riderId:r.id,deliveryId:body.deliveryId||undefined,latitude:Number.isFinite(lat)?lat:undefined,longitude:Number.isFinite(lon)?lon:undefined,notes:body.notes}});
    await this.audit.record({actorId:r.ownerUserId,action:'RIDER_SOS_TRIGGERED',entityType:'RiderSosEvent',entityId:item.id,after:{deliveryId:item.deliveryId,latitude:item.latitude,longitude:item.longitude}}); return item;
  }
  async sosHistory(ownerUserId:string){const r=await this.rider(ownerUserId);return this.prisma.riderSosEvent.findMany({where:{riderId:r.id},orderBy:{triggeredAt:'desc'}})}
}
