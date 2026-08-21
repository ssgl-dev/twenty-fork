import { Field, InputType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class CreateAnalysisInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  csvFileId!: string;

  @Field(() => String)
  analysisType!: string;

  @Field(() => String, { nullable: true })
  targetColumn?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  config?: Record<string, unknown>;
}
