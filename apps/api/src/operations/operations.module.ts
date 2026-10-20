import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { ComplianceController } from './compliance.controller';
import { DashboardController } from './dashboard.controller';
import { IncidentsController } from './incidents.controller';
import { MaintenanceController } from './maintenance.controller';
import { WorkOrdersController } from './work-orders.controller';

@Module({
  controllers: [
    DashboardController,
    WorkOrdersController,
    AssetsController,
    MaintenanceController,
    ComplianceController,
    IncidentsController,
  ],
})
export class OperationsModule {}
