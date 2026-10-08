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
