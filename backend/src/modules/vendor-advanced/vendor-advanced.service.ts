import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';

function csvEscape(value: unknown) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function parseCsv(text: string): string[][] {
  const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i]; if(quoted){if(c==='"' && text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\\r')cell+=c;} row.push(cell); if(row.some(Boolean))rows.push(row); return rows;
}

@Injectable()
export class VendorAdvancedService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  private async vendor(userId:string){
    return vendorForUser(this.prisma, userId);
  }
  private async ownedProducts(userId:string, ids:string[]){
    const v=await this.vendor(userId); const products=await this.prisma.product.findMany({where:{id:{in:ids},vendorId:v.id}});
    if(products.length!==new Set(ids).size) throw new ForbiddenException('One or more selected products do not belong to your store.');
    return {v,products};
  }

  async settings(userId:string){const v=await this.vendor(userId); return {maxOrdersPerHour:v.maxOrdersPerHour};}
  async setCapacity(userId:string,maxOrdersPerHour?:number|null){const v=await this.vendor(userId); if(maxOrdersPerHour!==null && maxOrdersPerHour!==undefined && maxOrdersPerHour<1) throw new BadRequestException('Capacity must be at least 1 order per hour.'); const updated=await this.prisma.vendor.update({where:{id:v.id},data:{maxOrdersPerHour:maxOrdersPerHour ?? null}}); await this.audit.record({actorId:userId,action:'vendor.capacity.update',entityType:'Vendor',entityId:v.id,before:{maxOrdersPerHour:v.maxOrdersPerHour},after:{maxOrdersPerHour:updated.maxOrdersPerHour}}); return {maxOrdersPerHour:updated.maxOrdersPerHour};}

  async productSchedule(userId:string,id:string,data:any){const {v,products}=await this.ownedProducts(userId,[id]); const p=products[0]; const updated=await this.prisma.product.update({where:{id:p.id},data}); await this.audit.record({actorId:userId,action:'vendor.product.schedule.update',entityType:'Product',entityId:p.id,before:{availabilityStartTime:p.availabilityStartTime,availabilityEndTime:p.availabilityEndTime,availabilityDays:p.availabilityDays},after:{availabilityStartTime:updated.availabilityStartTime,availabilityEndTime:updated.availabilityEndTime,availabilityDays:updated.availabilityDays}}); return updated;}

  async listSchedules(userId:string){const v=await this.vendor(userId); return this.prisma.vendorMenuSchedule.findMany({where:{vendorId:v.id},orderBy:{createdAt:'desc'},include:{items:{orderBy:{displayOrder:'asc'},include:{product:{select:{id:true,name:true,isAvailable:true}}}}}});}
  async createSchedule(userId:string,data:any){const v=await this.vendor(userId); if(data.startTime===data.endTime) throw new BadRequestException('Menu start and end times cannot be identical.'); const ids=data.productIds||[]; await this.ownedProducts(userId,ids); const schedule=await this.prisma.vendorMenuSchedule.create({data:{vendorId:v.id,name:data.name,startTime:data.startTime,endTime:data.endTime,days:data.days,isActive:data.isActive??true,items:{create:ids.map((productId:string,i:number)=>({productId,displayOrder:i}))}}}); return schedule;}
  async updateSchedule(userId:string,id:string,data:any){const v=await this.vendor(userId); const old=await this.prisma.vendorMenuSchedule.findFirst({where:{id,vendorId:v.id}}); if(!old) throw new NotFoundException('Menu schedule not found.'); const ids=data.productIds||[]; await this.ownedProducts(userId,ids); return this.prisma.$transaction(async tx=>{await tx.vendorMenuScheduleItem.deleteMany({where:{scheduleId:id}}); return tx.vendorMenuSchedule.update({where:{id},data:{name:data.name,startTime:data.startTime,endTime:data.endTime,days:data.days,isActive:data.isActive??true,items:{create:ids.map((productId:string,i:number)=>({productId,displayOrder:i}))}}});});}
  async deleteSchedule(userId:string,id:string){const v=await this.vendor(userId); const old=await this.prisma.vendorMenuSchedule.findFirst({where:{id,vendorId:v.id}}); if(!old) throw new NotFoundException('Menu schedule not found.'); await this.prisma.vendorMenuSchedule.delete({where:{id}}); return {ok:true};}

  async bulkUpdate(userId:string,data:any){const {v,products}=await this.ownedProducts(userId,data.productIds); if(data.priceAmount!==undefined && data.discountAmount!==undefined && data.discountAmount>data.priceAmount) throw new BadRequestException('Discount cannot exceed price.'); const result=await this.prisma.product.updateMany({where:{vendorId:v.id,id:{in:products.map(p=>p.id)}},data:{...(data.priceAmount!==undefined?{priceAmount:data.priceAmount}:{}),...(data.discountAmount!==undefined?{discountAmount:data.discountAmount}:{}),...(data.vendorCategoryId!==undefined?{vendorCategoryId:data.vendorCategoryId}:{}),...(data.isAvailable!==undefined?{isAvailable:data.isAvailable}:{})}}); await this.audit.record({actorId:userId,action:'vendor.products.bulk_update',entityType:'Vendor',entityId:v.id,after:{productIds:data.productIds,count:result.count}}); return {count:result.count};}
  async bulkAvailability(userId:string,data:any){return this.bulkUpdate(userId,{productIds:data.productIds,isAvailable:data.isAvailable});}
  async bulkCategory(userId:string,data:any){return this.bulkUpdate(userId,{productIds:data.productIds,vendorCategoryId:data.vendorCategoryId});}
  async bulkStock(userId:string,data:any){
    const v=await this.vendor(userId); if(!Array.isArray(data.items)||!data.items.length) throw new BadRequestException('At least one stock item is required.');
    if(data.items.length>100) throw new BadRequestException('Bulk stock updates are limited to 100 products.');
    const ids=data.items.map((x:any)=>x.productId); const {products}=await this.ownedProducts(userId,ids); const byId=new Map(products.map(p=>[p.id,p])); let count=0;
    for(const item of data.items){
      if(!Number.isInteger(item.quantity)||item.quantity<0) throw new BadRequestException('Stock quantity must be a non-negative integer.');
      const p=byId.get(item.productId); if(!p) continue;
      await this.prisma.$transaction(async tx=>{
        const inv=await tx.inventory.findUnique({where:{productId:p.id}});
        if(!inv){const created=await tx.inventory.create({data:{productId:p.id,quantity:item.quantity}}); if(item.quantity) await tx.stockMovement.create({data:{inventoryId:created.id,quantityDelta:item.quantity,quantityBefore:0,quantityAfter:item.quantity,reason:'Bulk stock update',actorId:userId,referenceType:'BULK_STOCK_UPDATE'}});}
        else {const delta=item.quantity-inv.quantity; const updated=await tx.inventory.update({where:{id:inv.id},data:{quantity:item.quantity}}); if(delta) await tx.stockMovement.create({data:{inventoryId:inv.id,quantityDelta:delta,quantityBefore:inv.quantity,quantityAfter:updated.quantity,reason:'Bulk stock update',actorId:userId,referenceType:'BULK_STOCK_UPDATE'}});}
      }); count++;
    }
    await this.audit.record({actorId:userId,action:'vendor.products.bulk_stock_update',entityType:'Vendor',entityId:v.id,after:{count}}); return {count};
  }

  async exportCsv(userId:string){const v=await this.vendor(userId); const ps=await this.prisma.product.findMany({where:{vendorId:v.id},include:{inventory:true,vendorCategory:true,category:true},orderBy:{createdAt:'desc'}}); const header=['id','name','sku','priceNaira','discountNaira','categoryId','categoryName','vendorCategoryId','vendorCategoryName','unit','weightGrams','preparationTimeMinutes','isAvailable','stockQuantity']; const lines=[header.join(',')]; for(const p of ps) lines.push([p.id,p.name,p.sku,(p.priceAmount/100).toFixed(2),p.discountAmount==null?'':(p.discountAmount/100).toFixed(2),p.categoryId,p.category?.name,p.vendorCategoryId,p.vendorCategory?.name,p.unit,p.weightGrams,p.preparationTimeMinutes,p.isAvailable,p.inventory?.quantity??0].map(csvEscape).join(',')); return {filename:`rozzi-catalogue-${new Date().toISOString().slice(0,10)}.csv`,csv:lines.join('\\n')};}

  async importCsv(userId:string,csv:string){const v=await this.vendor(userId); const rows=parseCsv(csv.trim()); if(rows.length<2) throw new BadRequestException('CSV must contain a header and at least one product row.'); const header=rows[0].map(x=>x.trim()); const required=['name','priceNaira','categoryId']; for(const x of required) if(!header.includes(x)) throw new BadRequestException(`CSV is missing required column: ${x}`); const idx=(n:string)=>header.indexOf(n); const errors:any[]=[]; let created=0,updated=0; for(let r=1;r<rows.length;r++){const row=rows[r]; const name=row[idx('name')]?.trim(); const price=Number(row[idx('priceNaira')]); const categoryId=row[idx('categoryId')]?.trim(); if(!name||!Number.isFinite(price)||price<0||!categoryId){errors.push({row:r+1,message:'name, priceNaira and categoryId are required.'});continue;} try{const sku=row[idx('sku')]?.trim()||undefined; const data={name,sku,categoryId,priceAmount:Math.round(price*100),discountAmount:row[idx('discountNaira')]?Math.max(0,Math.round(Number(row[idx('discountNaira')])*100)):undefined,unit:row[idx('unit')]?.trim()||undefined,weightGrams:row[idx('weightGrams')]?Math.max(0,Math.round(Number(row[idx('weightGrams')]))):undefined,preparationTimeMinutes:row[idx('preparationTimeMinutes')]?Math.max(0,Math.round(Number(row[idx('preparationTimeMinutes')]))):undefined,isAvailable:row[idx('isAvailable')] ? row[idx('isAvailable')].toLowerCase()!=='false' : true}; if(data.discountAmount!==undefined&&data.discountAmount>data.priceAmount) throw new Error('discount exceeds price'); const existing=sku?await this.prisma.product.findFirst({where:{vendorId:v.id,sku}}):null; if(existing){await this.prisma.product.update({where:{id:existing.id},data});updated++;}else{await this.prisma.product.create({data:{...data,vendorId:v.id}});created++;}}catch(e:any){errors.push({row:r+1,message:e.message||'Import failed'});} } await this.audit.record({actorId:userId,action:'vendor.products.import',entityType:'Vendor',entityId:v.id,after:{created,updated,errors:errors.length}}); return {created,updated,errors};}
}
