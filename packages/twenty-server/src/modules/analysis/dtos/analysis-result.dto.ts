import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType()
export class AnalysisRunDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  analysisId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  startedAt!: string;

  @Field(() => String, { nullable: true })
  completedAt?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  result?: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  errorMessage?: string;
}

@ObjectType()
export class AnalysisDTO {
  @Field(() => String)
  id!: string;

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

  @Field(() => String)
  status!: string;

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;
}
