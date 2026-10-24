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

function parsePrice(value: string | undefined, field: string) {
  if (value === undefined) return undefined;

  const price = Number(value);
  if (
    typeof value !== 'string' ||
    !/^[0-9]+$/.test(value) ||
    !Number.isSafeInteger(price)
  ) {
    throw new BadRequestException(
      `${field} must be a non-negative safe integer in VND`,
    );
  }
  return price;
}

@Controller('store')
@ApiTags('Cửa hàng')
export class CommerceController {
  constructor(private readonly commerceService: CommerceService) {}

  @Get('products')
  @Public()
  @ApiOperation({ summary: 'Danh sách sản phẩm cửa hàng' })
  @ApiPageQueries()
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Lọc theo slug danh mục cửa hàng.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description:
      'Tìm chuỗi con trong tên, không phân biệt hoa/thường, có phân biệt dấu. Trim, tối đa 100 ký tự; rỗng là không lọc.',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: String,
    description:
      'Giá bán tối thiểu (bao gồm), số nguyên VNĐ từ 0 đến 9007199254740991, chỉ gồm chữ số.',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: String,
    description:
      'Giá bán tối đa (bao gồm), cùng định dạng minPrice và không nhỏ hơn minPrice.',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['price_asc', 'price_desc'],
    description: 'Sắp xếp giá; giá bằng nhau theo id tăng dần.',
  })
  @ApiOkResponse({ description: 'Sản phẩm công khai, bọc trong data và page.' })
  @ApiBadRequestResponse({
    description: 'Tham số phân trang hoặc lọc không hợp lệ.',
  })
  listProducts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('q') q?: unknown,
    @Query('minPrice') minPriceValue?: string,
    @Query('maxPrice') maxPriceValue?: string,
    @Query('sort') sort?: string,
  ) {
    if (
      category !== undefined &&
      (typeof category !== 'string' ||
        category.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category))
    ) {
      throw new BadRequestException('category must be a valid slug');
    }

    if (q !== undefined && (typeof q !== 'string' || q.trim().length > 100)) {
      throw new BadRequestException(
        'q must be a string of at most 100 characters',
      );
    }
    if (sort !== undefined && sort !== 'price_asc' && sort !== 'price_desc') {
      throw new BadRequestException(
        'sort must be one of: price_asc, price_desc',
      );
    }

    const minPrice = parsePrice(minPriceValue, 'minPrice');
    const maxPrice = parsePrice(maxPriceValue, 'maxPrice');
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice must not exceed maxPrice');
    }

    return this.commerceService.listProducts(parsePagination(page, pageSize), {
      category,
      q: q?.trim(),
      minPrice,
      maxPrice,
      sort,
    });
  }

  @Get('products/:slug')
  @Public()
  @ApiOperation({ summary: 'Chi tiết sản phẩm cửa hàng' })
  @ApiParam({ name: 'slug', description: 'Slug sản phẩm.', type: String })
  @ApiOkResponse({
    description:
      'Sản phẩm công khai và các quy cách bán (id, name, price, inStock), bọc trong data. Giá sản phẩm là giá thấp nhất, không thay thế giá quy cách.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm.' })
  async getProduct(@Param('slug') slug: string) {
    return { data: await this.commerceService.getProduct(slug) };
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Danh sách danh mục cửa hàng' })
  @ApiPageQueries()
  @ApiOkResponse({ description: 'Danh mục cửa hàng, bọc trong data và page.' })
  @ApiBadRequestResponse({ description: 'Tham số phân trang không hợp lệ.' })
  listCategories(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commerceService.listCategories(parsePagination(page, pageSize));
  }
}
