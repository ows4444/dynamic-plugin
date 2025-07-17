export class CreateDto {
  // Base DTO for create operations
}

export class UpdateDto {
  // Base DTO for update operations
}

export class QueryDto {
  limit?: number = 10;
  offset?: number = 0;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
  search?: string;
}