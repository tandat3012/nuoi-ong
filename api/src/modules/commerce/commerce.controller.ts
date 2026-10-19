import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parsePagination } from '../../common/query-params';
import { ApiPageQueries } from '../../common/swagger-docs';
import { Public } from '../auth/public.decorator';
import { CommerceService } from './commerce.service';

@Controller('store')
@ApiTags('Cửa hàng')
export class CommerceController {
  constructor(private readonly commerceService: CommerceService) {}

  @Get('products')
  @Public()
  @ApiOperation({ summary: 'Danh sách sản phẩm cửa hàng (dữ liệu mẫu)' })
  @ApiPageQueries()
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Lọc theo slug danh mục cửa hàng.',
  })
  @ApiOkResponse({ description: 'Sản phẩm mẫu, bọc trong data và page.' })
  @ApiBadRequestResponse({ description: 'Tham số phân trang không hợp lệ.' })
  listProducts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
  ) {
    if (
      category !== undefined &&
      (typeof category !== 'string' ||
        category.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category))
    ) {
      throw new BadRequestException('category must be a valid slug');
    }

    return this.commerceService.listProducts(
      parsePagination(page, pageSize),
      category,
    );
  }

  @Get('products/:slug')
  @Public()
  @ApiOperation({ summary: 'Chi tiết sản phẩm cửa hàng (dữ liệu mẫu)' })
  @ApiParam({ name: 'slug', description: 'Slug sản phẩm.', type: String })
  @ApiOkResponse({ description: 'Sản phẩm mẫu, bọc trong data.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm.' })
  getProduct(@Param('slug') slug: string) {
    return { data: this.commerceService.getProduct(slug) };
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Danh sách danh mục cửa hàng (dữ liệu mẫu)' })
  @ApiPageQueries()
  @ApiOkResponse({ description: 'Danh mục mẫu, bọc trong data và page.' })
  @ApiBadRequestResponse({ description: 'Tham số phân trang không hợp lệ.' })
  listCategories(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commerceService.listCategories(parsePagination(page, pageSize));
  }
}
