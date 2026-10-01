export type PageInfo = {
  number: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  page: PageInfo;
};

export type ApiMessage = {
  message: string;
};
