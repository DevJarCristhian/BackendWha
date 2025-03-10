import { IsOptional, IsString } from 'class-validator';

export class GetDTO {
  @IsOptional()
  @IsString()
  search?: string;

  perPage?: string;
  page?: string;

  gender?: number | null;
  department?: number | null;
  city?: number | null;
  birthDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}
