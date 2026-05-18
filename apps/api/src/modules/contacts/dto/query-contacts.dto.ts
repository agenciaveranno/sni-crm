import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { OptInStatus } from '@prisma/client'

export class QueryContactsDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [],
  )
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[]

  @IsOptional()
  @IsEnum(OptInStatus)
  optInStatus?: OptInStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sortBy: 'createdAt' | 'updatedAt' | 'name' = 'createdAt'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc'
}
