import { Module } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';
import { StockReceiptsController } from './stock-receipts.controller';
import { StockReceiptsService } from './stock-receipts.service';
import { StockIssuesController } from './stock-issues.controller';
import { StockIssuesService } from './stock-issues.service';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';
import { StockCountsController } from './stock-counts.controller';
import { StockCountsService } from './stock-counts.service';

@Module({
  controllers: [WarehousesController, StockReceiptsController, StockIssuesController, StockTransfersController, StockCountsController],
  providers: [WarehousesService, StockReceiptsService, StockIssuesService, StockTransfersService, StockCountsService],
  exports: [WarehousesService, StockReceiptsService, StockIssuesService, StockTransfersService, StockCountsService],
})
export class WarehousesModule {}
