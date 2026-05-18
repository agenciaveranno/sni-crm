import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator'

export class BulkContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  contactIds!: string[]
}
