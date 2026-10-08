import { Controller, Get, Query } from '@nestjs/common';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { inventoryTransactionType } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { InventoryService } from './inventory.service';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiEnumQuery,
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiUuidQuery,
  OPENAPI_DECIMAL_STRING,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';

@Controller()
@ApiTags('Tồn kho')
@ApiBearerAuth('clerk-jwt')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory')
  @ApiOperation({
    summary: 'Số dư tồn kho hiện tại',
    description:
      'Chỉ trả về số dư dương hiện có; quantityOnHand là chuỗi thập phân và không cộng gộp các lô hoặc kho.',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiUuidQuery('warehouseId', 'Lọc theo kho.')
  @ApiUuidQuery('itemId', 'Lọc theo mặt hàng.')
  @ApiUuidQuery(
    'lotId',
    'Lọc theo lô; bỏ qua tham số để lấy các lô và số dư không theo lô.',
  )
  @ApiOkResponse({
    description:
      'Các dòng số dư dương cùng mặt hàng, kho, đơn vị và lô nếu có.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              quantityOnHand: OPENAPI_DECIMAL_STRING,
              item: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  code: { type: 'string', example: 'ONG-001' },
                  name: { type: 'string', example: 'Đường ăn ong' },
                  trackingMode: {
                    type: 'string',
                    enum: ['QUANTITY', 'LOT', 'ASSET'],
                  },
                  unit: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string', example: 'Kilogram' },
                      symbol: { type: 'string', nullable: true, example: 'kg' },
                    },
                  },
                },
              },
              warehouse: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  code: { type: 'string', example: 'MAIN' },
                  name: { type: 'string', example: 'Kho chính' },
                },
              },
              lot: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  lotNumber: { type: 'string', example: 'LOT-2026-001' },
                  expiryDate: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                  },
                },
              },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, UUID filter hoặc pagination không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc tồn kho của trang trại.',
  })
  listBalances(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('lotId') lotId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.listBalances({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      warehouseId: warehouseId
        ? requireUuid(warehouseId, 'warehouseId')
        : undefined,
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      lotId: lotId ? requireUuid(lotId, 'lotId') : undefined,
      ...parsePagination(page, pageSize),
    });
  }

  @Get('inventory/transactions')
  @ApiOperation({
    summary: 'Lịch sử biến động tồn kho',
    description:
      'Trả về giao dịch đã ghi nhận theo thời gian mới nhất; quantityChange là chuỗi thập phân có dấu.',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiUuidQuery('warehouseId', 'Lọc theo kho.')
  @ApiUuidQuery('itemId', 'Lọc theo mặt hàng.')
  @ApiEnumQuery(
    'transactionType',
    inventoryTransactionType.enumValues,
    'Loại giao dịch tồn kho.',
  )
  @ApiOkResponse({
    description:
      'Lịch sử theo trang. Các liên kết lô, tài sản, người thực hiện và mã chứng từ có thể null khi không tồn tại.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              transactionType: {
                type: 'string',
                enum: [...inventoryTransactionType.enumValues],
              },
              quantityChange: { ...OPENAPI_DECIMAL_STRING, example: '-1.250' },
              reason: {
                type: 'string',
                nullable: true,
                example: 'Điều chỉnh kiểm kê',
              },
              createdAt: { type: 'string', format: 'date-time' },
              item: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  code: { type: 'string' },
                  name: { type: 'string' },
                  unit: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      symbol: { type: 'string', nullable: true },
                    },
                  },
                },
              },
              warehouse: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  code: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              lot: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  lotNumber: { type: 'string' },
                  expiryDate: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                  },
                },
              },
              asset: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  assetCode: { type: 'string' },
                  serialNumber: { type: 'string', nullable: true },
                },
              },
              performer: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  displayName: { type: 'string' },
                },
              },
              source: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'STOCK_RECEIPT' },
                  id: { type: 'string', format: 'uuid' },
                  code: {
                    type: 'string',
                    nullable: true,
                    example: 'RCV-2026-001',
                  },
                },
              },
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'farmId, UUID filter, transactionType hoặc pagination không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc giao dịch của trang trại.',
  })
  listTransactions(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('transactionType') transactionType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.listTransactions({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      warehouseId: warehouseId
        ? requireUuid(warehouseId, 'warehouseId')
        : undefined,
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      transactionType: parseOptionalEnum(
        transactionType,
        inventoryTransactionType.enumValues,
        'transactionType',
      ),
      ...parsePagination(page, pageSize),
    });
  }

  @Get('lots/suggestions')
  @ApiOperation({ summary: 'Gợi ý lô còn tồn và chưa hết hạn' })
  @ApiFarmIdQuery()
  @ApiUuidQuery('itemId', 'Giới hạn theo mặt hàng.')
  @ApiUuidQuery('warehouseId', 'Giới hạn theo kho.')
  @ApiOkResponse({
    description: 'Mảng các cặp lô và số dư dương; lô hết hạn không được gợi ý.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lot: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              farmId: { type: 'string', format: 'uuid' },
              itemId: { type: 'string', format: 'uuid' },
              sourceReceiptItemId: {
                type: 'string',
                format: 'uuid',
                nullable: true,
              },
              lotNumber: { type: 'string' },
              manufacturedDate: {
                type: 'string',
                format: 'date',
                nullable: true,
              },
              expiryDate: { type: 'string', format: 'date', nullable: true },
              initialQuantity: OPENAPI_DECIMAL_STRING,
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          balance: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              farmId: { type: 'string', format: 'uuid' },
              itemId: { type: 'string', format: 'uuid' },
              warehouseId: { type: 'string', format: 'uuid' },
              lotId: { type: 'string', format: 'uuid', nullable: true },
              quantityOnHand: OPENAPI_DECIMAL_STRING,
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc UUID filter không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc tồn kho của trang trại.',
  })
  lotSuggestions(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.lotSuggestions({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      warehouseId: warehouseId
        ? requireUuid(warehouseId, 'warehouseId')
        : undefined,
    });
  }

  @Get('lots')
  @ApiOperation({
    summary: 'Danh sách lô theo trang',
    description:
      'Bao gồm lô hết hạn và lô không còn tồn; dùng để tra cứu lịch sử lô.',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiUuidQuery('itemId', 'Lọc theo mặt hàng.')
  @ApiOkResponse({
    description: 'Trang các lô của trang trại.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              farmId: { type: 'string', format: 'uuid' },
              itemId: { type: 'string', format: 'uuid' },
              sourceReceiptItemId: {
                type: 'string',
                format: 'uuid',
                nullable: true,
              },
              lotNumber: { type: 'string', example: 'LOT-2026-001' },
              manufacturedDate: {
                type: 'string',
                format: 'date',
                nullable: true,
              },
              expiryDate: { type: 'string', format: 'date', nullable: true },
              initialQuantity: OPENAPI_DECIMAL_STRING,
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, itemId hoặc pagination không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc lô của trang trại.',
  })
  listLots(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('itemId') itemId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.listLots({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      ...parsePagination(page, pageSize),
    });
  }
}
