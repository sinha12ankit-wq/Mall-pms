import { Module } from '@nestjs/common';
import { MallsController } from './malls.controller';

@Module({ controllers: [MallsController] })
export class MallsModule {}
