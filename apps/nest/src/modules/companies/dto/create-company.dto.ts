import { IsArray, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCompanyDto {
  @IsString()
  @MinLength(5)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  nit: string;

  @IsString()
  @MinLength(3)
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectors?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  regions?: string[];

  @IsNumber()
  @IsOptional()
  liquidity?: number;

  @IsNumber()
  @IsOptional()
  indebtedness?: number;

  @IsNumber()
  @IsOptional()
  interestCoverage?: number;

  @IsNumber()
  @IsOptional()
  contractingCapacity?: number;
}
