import { applyDecorators } from '@nestjs/common';
import { ApiParam, ApiQuery } from '@nestjs/swagger';

export const OPENAPI_PAGE = {
  type: 'object',
  properties: {
    number: { type: 'integer', example: 1 },
    size: { type: 'integer', example: 20 },
    totalItems: { type: 'integer', example: 42 },
    totalPages: { type: 'integer', example: 3 },
  },
} as const;

export const OPENAPI_UUID = {
  type: 'string',
  format: 'uuid',
  example: '550e8400-e29b-41d4-a716-446655440000',
} as const;

export const OPENAPI_DECIMAL_STRING = {
  type: 'string',
  example: '12.500',
  description:
    'Số thập phân được trả về dưới dạng chuỗi để giữ nguyên độ chính xác.',
} as const;

// Lot identity fields shared by every lot-bearing response.
export const LOT_IDENTITY_PROPERTIES = {
  lotCode: {
    type: 'string',
    example: 'LOT-000000001',
    description: 'Mã lô nội bộ duy nhất, do hệ thống cấp.',
  },
  supplierLotNumber: {
    type: 'string',
    nullable: true,
    example: 'BATCH-0425',
    description: 'Số lô in trên hàng; không bắt buộc, có thể trùng.',
  },
  legacyLotNumber: {
    type: 'string',
    nullable: true,
    description:
      'Số lô cũ trước khi tách mã lô; chỉ để tham chiếu, không chắc là số của nhà cung cấp.',
  },
  lotNumber: {
    type: 'string',
    deprecated: true,
    description: 'Bí danh cũ của lotCode cho client đời trước.',
  },
} as const;

export function ApiFarmIdQuery() {
  return ApiQuery({
    name: 'farmId',
    required: true,
    type: String,
    format: 'uuid',
    description:
      'UUID trang trại; tham số này bắt buộc cho thao tác theo trang trại.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  });
}

export function ApiPageQueries() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: 'integer',
      minimum: 1,
      default: 1,
      description: 'Số trang, bắt đầu từ 1.',
      example: 1,
    }),
    ApiQuery({
      name: 'pageSize',
      required: false,
      type: 'integer',
      minimum: 1,
      default: 20,
      description:
        'Số dòng mỗi trang; giá trị lớn hơn 100 được giới hạn ở 100.',
      example: 20,
    }),
  );
}

export function ApiSearchQuery() {
  return ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Từ khóa tìm kiếm; khoảng trắng được cắt và tối đa 100 ký tự.',
    example: 'ONG-001',
  });
}

export function ApiUuidQuery(name: string, description: string) {
  return ApiQuery({
    name,
    required: false,
    type: String,
    format: 'uuid',
    example: OPENAPI_UUID.example,
    description,
  });
}

export function ApiEnumQuery(
  name: string,
  values: readonly string[],
  description: string,
) {
  return ApiQuery({
    name,
    required: false,
    enum: [...values],
    description,
    example: values[0],
  });
}

export function ApiUuidParam(name: string, description: string) {
  return ApiParam({
    name,
    required: true,
    type: String,
    format: 'uuid',
    example: OPENAPI_UUID.example,
    description,
  });
}
