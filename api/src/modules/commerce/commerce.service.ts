import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationParams } from '../../common/query-params';
import { STORE_CATEGORIES, STORE_PRODUCTS } from './commerce.fixtures';

@Injectable()
export class CommerceService {
  listProducts(pagination: PaginationParams, category?: string) {
    const products = category
      ? STORE_PRODUCTS.filter((product) => product.category.slug === category)
      : STORE_PRODUCTS;
    return this.paginate(products, pagination);
  }

  getProduct(slug: string) {
    const product = STORE_PRODUCTS.find((item) => item.slug === slug);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  listCategories(pagination: PaginationParams) {
    return this.paginate(STORE_CATEGORIES, pagination);
  }

  private paginate<T>(rows: readonly T[], pagination: PaginationParams) {
    const { page, pageSize, offset } = pagination;
    if (!Number.isSafeInteger(offset + pageSize)) {
      throw new BadRequestException(
        'page exceeds the supported pagination range',
      );
    }

    return {
      data: rows.slice(offset, offset + pageSize),
      page: {
        number: page,
        size: pageSize,
        totalItems: rows.length,
        totalPages: Math.ceil(rows.length / pageSize),
      },
    };
  }
}
