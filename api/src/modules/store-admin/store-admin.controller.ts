import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import {
  ApiEnumQuery,
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiSearchQuery,
  ApiUuidParam,
  ApiUuidQuery,
} from '../../common/swagger-docs';
import { storeProductStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import {
  CreateStoreCategoryDto,
  UpdateStoreCategoryDto,
} from './dto/store-category.dto';
import {
  ReorderStoreImagesDto,
  UpdateStoreImageDto,
} from './dto/store-image.dto';
import {
  CreateStoreProductDto,
  UpdateStoreProductDto,
  UpdateStoreProductStatusDto,
} from './dto/store-product.dto';
import {
  CreateStoreVariantDto,
  UpdateStoreVariantDto,
} from './dto/store-variant.dto';
import {
  STORE_IMAGE_MAX_BYTES,
  StoreAdminService,
} from './store-admin.service';
import {
  FARM_ADMIN_ROLES,
  STORE_MANAGE_ROLES,
} from '../auth/farm-access/farm-role-groups';
import {
  SetStoreVariantItemDto,
  UpdateStoreSettingsDto,
  UpdateStoreShippingFeesDto,
} from './dto/store-settings.dto';

// The catalog and delivery fees are shared by every farm, so only ADMIN edits them.
const CATALOG_ROLE = 'ADMIN';

@Controller('store-admin')
@UseGuards(FarmAccessGuard)
@FarmRoles(...STORE_MANAGE_ROLES)
@ApiTags('Quản trị cửa hàng')
@ApiBearerAuth('clerk-jwt')
@ApiFarmIdQuery()
@ApiForbiddenResponse({
  description:
    'Xem catalog: quản trị viên, chủ trại, quản lý cửa hàng. Sửa catalog và phí giao hàng chung: chỉ ADMIN. Cấu hình bán của trại: ADMIN hoặc chủ trại.',
})
export class StoreAdminController {
  constructor(private readonly storeAdminService: StoreAdminService) {}

  @Get('products')
  @ApiOperation({ summary: 'Danh sách sản phẩm cửa hàng (mọi trạng thái)' })
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('status', storeProductStatus.enumValues, 'Trạng thái.')
  @ApiUuidQuery('categoryId', 'Lọc theo danh mục cửa hàng.')
  listProducts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.storeAdminService.listProducts({
      ...parsePagination(page, pageSize),
      search: normalizeSearch(search),
      status: parseOptionalEnum(
        status,
        storeProductStatus.enumValues,
        'status',
      ),
      categoryId: categoryId
        ? requireUuid(categoryId, 'categoryId')
        : undefined,
    });
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm kèm biến thể và ảnh' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  async getProduct(@Query('farmId') farmId: string, @Param('id') id: string) {
    return {
      data: await this.storeAdminService.getProduct(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Post('products')
  @ApiOperation({ summary: 'Tạo sản phẩm (mặc định DRAFT)' })
  @ApiConflictResponse({ description: 'Slug đã tồn tại.' })
  async createProduct(
    @Query('farmId') farmId: string,
    @Body() input: CreateStoreProductDto,
  ) {
    return {
      data: await this.storeAdminService.createProduct(
        requireUuid(farmId, 'farmId'),
        input,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Patch('products/:id')
  @ApiOperation({ summary: 'Sửa thông tin sản phẩm' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiConflictResponse({ description: 'Slug đã tồn tại.' })
  async updateProduct(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: UpdateStoreProductDto,
  ) {
    return {
      data: await this.storeAdminService.updateProduct(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        input,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Patch('products/:id/status')
  @ApiOperation({
    summary: 'Đổi trạng thái sản phẩm',
    description:
      'PUBLISHED cần ít nhất một biến thể active gắn item và đơn vị đang hoạt động. Dùng ARCHIVED thay cho xóa.',
  })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiBadRequestResponse({
    description: 'Chưa có biến thể hợp lệ để xuất bản.',
  })
  async updateProductStatus(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: UpdateStoreProductStatusDto,
  ) {
    return {
      data: await this.storeAdminService.updateProductStatus(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        input.status,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Post('products/:id/variants')
  @ApiOperation({ summary: 'Thêm biến thể (quy cách bán)' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiConflictResponse({ description: 'Item đã thuộc biến thể khác.' })
  async createVariant(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: CreateStoreVariantDto,
  ) {
    return {
      data: await this.storeAdminService.createVariant(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        input,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Patch('products/:id/variants/:variantId')
  @ApiOperation({ summary: 'Sửa biến thể; tắt bằng active=false' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('variantId', 'ID biến thể.')
  async updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateStoreVariantDto,
  ) {
    return {
      data: await this.storeAdminService.updateVariant(
        requireUuid(id, 'id'),
        requireUuid(variantId, 'variantId'),
        input,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Post('products/:id/images')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: STORE_IMAGE_MAX_BYTES } }),
  )
  @ApiOperation({
    summary: 'Tải ảnh sản phẩm lên Cloudinary',
    description:
      'JPEG, PNG hoặc WebP, tối đa 10MB. Ảnh được thu về tối đa 2000px và lưu dạng WebP. Ảnh mới xếp cuối gallery.',
  })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string', maxLength: 500 },
      },
    },
  })
  async addImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('alt') alt?: string,
  ) {
    return {
      data: await this.storeAdminService.addImage(
        requireUuid(id, 'id'),
        file,
        typeof alt === 'string' ? alt : '',
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Put('products/:id/images/order')
  @ApiOperation({ summary: 'Sắp xếp lại ảnh; ảnh đầu là ảnh đại diện' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  async reorderImages(
    @Param('id') id: string,
    @Body() input: ReorderStoreImagesDto,
  ) {
    return {
      data: await this.storeAdminService.reorderImages(
        requireUuid(id, 'id'),
        input.imageIds,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Patch('products/:id/images/:imageId')
  @ApiOperation({ summary: 'Sửa mô tả (alt) ảnh' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('imageId', 'ID ảnh.')
  async updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() input: UpdateStoreImageDto,
  ) {
    return {
      data: await this.storeAdminService.updateImage(
        requireUuid(id, 'id'),
        requireUuid(imageId, 'imageId'),
        input.alt,
      ),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Delete('products/:id/images/:imageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa ảnh khỏi sản phẩm và Cloudinary' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('imageId', 'ID ảnh.')
  @ApiNoContentResponse({ description: 'Đã xóa.' })
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    await this.storeAdminService.deleteImage(
      requireUuid(id, 'id'),
      requireUuid(imageId, 'imageId'),
    );
  }

  @Get('settings')
  @FarmRoles(...FARM_ADMIN_ROLES)
  @ApiOperation({
    summary: 'Cấu hình bán online của trại: kho bán, miền phục vụ',
  })
  async getSettings(@Query('farmId') farmId: string) {
    return {
      data: await this.storeAdminService.getSettings(
        requireUuid(farmId, 'farmId'),
      ),
    };
  }

  @Put('shipping-fees')
  @FarmRoles(CATALOG_ROLE)
  @ApiOperation({
    summary: 'Sửa phí giao hàng theo miền (dùng chung mọi trại)',
    description:
      'Chỉ ADMIN. Áp dụng cho đơn đặt sau khi lưu; đơn đã đặt giữ phí cũ. Mỗi lần lưu ghi một dòng lịch sử (SHIPPING_FEES_UPDATED) vào trại đang thao tác. Đọc phí hiện tại qua GET /store/shipping-fees.',
  })
  async updateShippingFees(
    @Query('farmId') farmId: string,
    @CurrentAuth() auth: { clerkUserId: string },
    @Body() input: UpdateStoreShippingFeesDto,
  ) {
    return {
      data: await this.storeAdminService.updateShippingFees(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get('sales-stock')
  @ApiOperation({
    summary:
      'Tồn bán hàng: tồn vật lý, đang giữ và khả dụng tại kho bán của trại',
  })
  async salesStock(@Query('farmId') farmId: string) {
    return {
      data: await this.storeAdminService.salesStock(
        requireUuid(farmId, 'farmId'),
      ),
    };
  }

  @Put('settings')
  @FarmRoles(...FARM_ADMIN_ROLES)
  @ApiOperation({
    summary: 'Lưu cấu hình bán online của trại',
    description:
      'Mỗi trại có đúng một kho bán. Bật bán cần kho bán và ít nhất một miền. Không đổi kho khi kho cũ còn đơn chưa hoàn tất.',
  })
  @ApiConflictResponse({ description: 'Kho bán cũ còn đơn chưa hoàn tất.' })
  async updateSettings(
    @Query('farmId') farmId: string,
    @Body() input: UpdateStoreSettingsDto,
  ) {
    return {
      data: await this.storeAdminService.updateSettings(
        requireUuid(farmId, 'farmId'),
        input,
      ),
    };
  }

  @Put('products/:id/variants/:variantId/item')
  @FarmRoles(...FARM_ADMIN_ROLES)
  @ApiOperation({
    summary: 'Chọn vật tư của trại cung cấp quy cách bán',
    description: 'Vật tư phải đang hoạt động và cùng đơn vị với quy cách.',
  })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('variantId', 'ID biến thể.')
  @ApiConflictResponse({ description: 'Vật tư đã gắn với quy cách khác.' })
  async setVariantItem(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() input: SetStoreVariantItemDto,
  ) {
    return {
      data: await this.storeAdminService.setVariantItem(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        requireUuid(variantId, 'variantId'),
        input.itemId,
      ),
    };
  }

  @Delete('products/:id/variants/:variantId/item')
  @HttpCode(204)
  @FarmRoles(...FARM_ADMIN_ROLES)
  @ApiOperation({ summary: 'Ngừng cung cấp quy cách bán từ trại này' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('variantId', 'ID biến thể.')
  @ApiNoContentResponse({ description: 'Đã gỡ.' })
  async removeVariantItem(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    await this.storeAdminService.removeVariantItem(
      requireUuid(farmId, 'farmId'),
      requireUuid(id, 'id'),
      requireUuid(variantId, 'variantId'),
    );
  }

  @Get('items')
  @ApiOperation({
    summary: 'Tra cứu vật tư để gắn quy cách bán (chỉ mã, tên, đơn vị)',
  })
  @ApiSearchQuery()
  lookupItems(
    @Query('farmId') farmId: string,
    @Query('search') search?: string,
  ) {
    return this.storeAdminService.lookupItems(
      requireUuid(farmId, 'farmId'),
      normalizeSearch(search),
    );
  }

  @Get('categories')
  @ApiOperation({ summary: 'Tất cả danh mục cửa hàng' })
  listCategories() {
    return this.storeAdminService.listCategories();
  }

  @FarmRoles(CATALOG_ROLE)
  @Post('categories')
  @ApiOperation({ summary: 'Tạo danh mục cửa hàng' })
  @ApiConflictResponse({ description: 'Slug đã tồn tại.' })
  async createCategory(@Body() input: CreateStoreCategoryDto) {
    return {
      data: await this.storeAdminService.createCategory(input),
    };
  }

  @FarmRoles(CATALOG_ROLE)
  @Patch('categories/:id')
  @ApiOperation({ summary: 'Sửa danh mục cửa hàng' })
  @ApiUuidParam('id', 'ID danh mục.')
  @ApiConflictResponse({ description: 'Slug đã tồn tại.' })
  async updateCategory(
    @Param('id') id: string,
    @Body() input: UpdateStoreCategoryDto,
  ) {
    return {
      data: await this.storeAdminService.updateCategory(
        requireUuid(id, 'id'),
        input,
      ),
    };
  }
}
