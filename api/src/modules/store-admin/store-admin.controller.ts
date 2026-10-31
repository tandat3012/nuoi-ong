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
import { STORE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';

@Controller('store-admin')
@UseGuards(FarmAccessGuard)
@FarmRoles(...STORE_MANAGE_ROLES)
@ApiTags('Quản trị cửa hàng')
@ApiBearerAuth('clerk-jwt')
@ApiFarmIdQuery()
@ApiForbiddenResponse({
  description:
    'Chỉ quản trị viên, chủ trang trại hoặc quản lý cửa hàng của trại sở hữu kho bán hàng.',
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
    @Query('farmId') farmId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.storeAdminService.listProducts(requireUuid(farmId, 'farmId'), {
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

  @Patch('products/:id/variants/:variantId')
  @ApiOperation({ summary: 'Sửa biến thể; tắt bằng active=false' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('variantId', 'ID biến thể.')
  async updateVariant(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateStoreVariantDto,
  ) {
    return {
      data: await this.storeAdminService.updateVariant(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        requireUuid(variantId, 'variantId'),
        input,
      ),
    };
  }

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
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('alt') alt?: string,
  ) {
    return {
      data: await this.storeAdminService.addImage(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        file,
        typeof alt === 'string' ? alt : '',
      ),
    };
  }

  @Put('products/:id/images/order')
  @ApiOperation({ summary: 'Sắp xếp lại ảnh; ảnh đầu là ảnh đại diện' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  async reorderImages(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: ReorderStoreImagesDto,
  ) {
    return {
      data: await this.storeAdminService.reorderImages(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        input.imageIds,
      ),
    };
  }

  @Patch('products/:id/images/:imageId')
  @ApiOperation({ summary: 'Sửa mô tả (alt) ảnh' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('imageId', 'ID ảnh.')
  async updateImage(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() input: UpdateStoreImageDto,
  ) {
    return {
      data: await this.storeAdminService.updateImage(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        requireUuid(imageId, 'imageId'),
        input.alt,
      ),
    };
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa ảnh khỏi sản phẩm và Cloudinary' })
  @ApiUuidParam('id', 'ID sản phẩm.')
  @ApiUuidParam('imageId', 'ID ảnh.')
  @ApiNoContentResponse({ description: 'Đã xóa.' })
  async deleteImage(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    await this.storeAdminService.deleteImage(
      requireUuid(farmId, 'farmId'),
      requireUuid(id, 'id'),
      requireUuid(imageId, 'imageId'),
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
  listCategories(@Query('farmId') farmId: string) {
    return this.storeAdminService.listCategories(requireUuid(farmId, 'farmId'));
  }

  @Post('categories')
  @ApiOperation({ summary: 'Tạo danh mục cửa hàng' })
  @ApiConflictResponse({ description: 'Slug đã tồn tại.' })
  async createCategory(
    @Query('farmId') farmId: string,
    @Body() input: CreateStoreCategoryDto,
  ) {
    return {
      data: await this.storeAdminService.createCategory(
        requireUuid(farmId, 'farmId'),
        input,
      ),
    };
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Sửa danh mục cửa hàng' })
  @ApiUuidParam('id', 'ID danh mục.')
  @ApiConflictResponse({ description: 'Slug đã tồn tại.' })
  async updateCategory(
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: UpdateStoreCategoryDto,
  ) {
    return {
      data: await this.storeAdminService.updateCategory(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
        input,
      ),
    };
  }
}
