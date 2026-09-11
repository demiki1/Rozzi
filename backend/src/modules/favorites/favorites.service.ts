import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string) {
    const [vendors, products] = await Promise.all([
      this.prisma.favoriteVendor.findMany({ where:{customerId}, orderBy:{createdAt:'desc'}, include:{ vendor:{ select:{id:true,storeName:true,logoUrl:true,coverImageUrl:true,phone:true,holidayMode:true,busyMode:true} } } }),
      this.prisma.favoriteProduct.findMany({ where:{customerId}, orderBy:{createdAt:'desc'}, include:{ product:{ select:{id:true,name:true,priceAmount:true,discountAmount:true,unit:true,isAvailable:true,images:{orderBy:{sortOrder:'asc'},take:1},vendor:{select:{id:true,storeName:true,logoUrl:true}},category:{select:{id:true,name:true}}} } } }),
    ]);
    return { vendors:vendors.map(x=>({...x.vendor,favoritedAt:x.createdAt})), products:products.map(x=>({...x.product,favoritedAt:x.createdAt})) };
  }

  async addVendor(customerId:string,vendorId:string){
    const vendor=await this.prisma.vendor.findUnique({
  where:{id:vendorId},
  select:{id:true},
});
    if(!vendor) throw new NotFoundException('Vendor not found.');
    try { await this.prisma.favoriteVendor.create({data:{customerId,vendorId}}); }
    catch(e:any){ if(e?.code==='P2002') throw new ConflictException('Vendor is already in your favorites.'); throw e; }
    return {success:true,type:'VENDOR',id:vendorId};
  }
  async removeVendor(customerId:string,vendorId:string){ await this.prisma.favoriteVendor.deleteMany({where:{customerId,vendorId}}); return {success:true}; }
  async addProduct(customerId:string,productId:string){
    const product=await this.prisma.product.findUnique({where:{id:productId},select:{id:true}});
    if(!product) throw new NotFoundException('Product not found.');
    try { await this.prisma.favoriteProduct.create({data:{customerId,productId}}); }
    catch(e:any){ if(e?.code==='P2002') throw new ConflictException('Product is already in your favorites.'); throw e; }
    return {success:true,type:'PRODUCT',id:productId};
  }
  async removeProduct(customerId:string,productId:string){ await this.prisma.favoriteProduct.deleteMany({where:{customerId,productId}}); return {success:true}; }
  async status(customerId:string,productId?:string,vendorId?:string){
    const [p,v]=await Promise.all([
      productId?this.prisma.favoriteProduct.findUnique({where:{customerId_productId:{customerId,productId}},select:{id:true}}):null,
      vendorId?this.prisma.favoriteVendor.findUnique({where:{customerId_vendorId:{customerId,vendorId}},select:{id:true}}):null,
    ]); return {productFavorited:Boolean(p),vendorFavorited:Boolean(v)};
  }
}
