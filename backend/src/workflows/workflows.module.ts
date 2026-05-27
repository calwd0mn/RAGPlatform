import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { RagModule } from '../rag/rag.module';
import { Workflow, WorkflowSchema } from './schemas/workflow.schema';
import { WorkflowExecutorService } from './services/workflow-executor.service';
import { WorkflowsService } from './services/workflows.service';
import { WorkflowsController } from './workflows.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
    ]),
    KnowledgeBasesModule,
    RagModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowExecutorService],
})
export class WorkflowsModule {}
