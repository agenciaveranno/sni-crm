import { ArrayMinSize, IsArray, IsString } from 'class-validator'

export class AddContactTagsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tagIds!: string[]
}
