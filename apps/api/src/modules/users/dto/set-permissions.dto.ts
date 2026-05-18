import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator'

export class PermissionEntryDto {
  @IsString()
  module!: string

  @IsString()
  action!: string

  @IsBoolean()
  granted!: boolean
}

export class SetPermissionsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[]
}
