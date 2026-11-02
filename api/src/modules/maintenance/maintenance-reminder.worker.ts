import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { enqueueDocumentPushes } from '../notifications/notification-push-outbox';

@Injectable()
export class MaintenanceReminderWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(MaintenanceReminderWorker.name);
  constructor(private readonly database: DatabaseService) {}
  onModuleInit() {
    if (!process.env.DATABASE_URL) return;
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, 300_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.run();
    } catch (error) {
      this.logger.error(
        'Maintenance reminders failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
  async run() {
    return this.database.db.transaction(async (tx) => {
      const lock = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtextextended('maintenance-reminders',0)) AS locked`,
      );
      if (!lock.rows[0]?.locked) return;
      const inserted = await tx.execute(sql`
        WITH dates AS (SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today), candidates AS (
          SELECT m.id, m.farm_id, a.asset_code, 'MAINTENANCE_RECORD' AS entity_type,
            CASE WHEN m.status='SCHEDULED' THEN m.scheduled_at::text ELSE m.expected_return_at::text END AS milestone,
            CASE WHEN m.status='SCHEDULED' THEN (m.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date ELSE (m.expected_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date END AS due,
            m.status='IN_PROGRESS' AS is_returning
          FROM maintenance_records m JOIN assets a ON a.id=m.asset_id JOIN farms f ON f.id=m.farm_id
          WHERE m.status IN ('SCHEDULED','IN_PROGRESS') AND a.status NOT IN ('LOST','RETIRED') AND f.status='ACTIVE'
          UNION ALL
          SELECT a.id, a.farm_id, a.asset_code, 'MAINTENANCE_ASSET', a.next_maintenance_date::text, a.next_maintenance_date, false
          FROM assets a JOIN farms f ON f.id=a.farm_id
          WHERE a.next_maintenance_date IS NOT NULL AND a.status NOT IN ('LOST','RETIRED','MAINTENANCE') AND f.status='ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM maintenance_records m WHERE m.asset_id=a.id AND (m.completed_at IS NULL AND m.status<>'CANCELLED' OR m.received_at IS NOT NULL AND m.return_status IS DISTINCT FROM 'CONFIRMED'))
        ), events AS (
          SELECT c.*, CASE WHEN is_returning THEN 'RETURN_OVERDUE' WHEN due<today THEN 'OVERDUE' WHEN due=today THEN 'DUE' ELSE 'UPCOMING' END AS event
          FROM candidates c CROSS JOIN dates WHERE due <= today + 7 AND (NOT is_returning OR due<today)
        )
        INSERT INTO notifications(user_id,farm_id,type,title,body,entity_type,entity_id,data)
        SELECT DISTINCT fm.user_id,e.farm_id,e.entity_type || '_' || e.event,
          CASE e.event WHEN 'RETURN_OVERDUE' THEN 'Bảo trì trễ hẹn trả' WHEN 'OVERDUE' THEN 'Quá hạn bảo trì' WHEN 'DUE' THEN 'Đến hạn bảo trì' ELSE 'Sắp đến hạn bảo trì' END,
          e.asset_code || ': ' || CASE WHEN is_returning THEN 'hẹn trả ' ELSE 'hạn bảo trì ' END || e.due::text,
          e.entity_type,e.id,jsonb_build_object('milestone',e.milestone)
        FROM events e JOIN farm_members fm ON fm.farm_id=e.farm_id AND fm.status='ACTIVE'
        JOIN users u ON u.id=fm.user_id AND u.status='ACTIVE'
        JOIN farm_member_roles mr ON mr.farm_member_id=fm.id JOIN roles r ON r.id=mr.role_id
        WHERE r.code IN ('ADMIN','FARM_OWNER','WAREHOUSE_MANAGER','MAINTENANCE_STAFF')
        ON CONFLICT DO NOTHING RETURNING id`);
      await enqueueDocumentPushes(
        tx,
        inserted.rows.map((row) => String(row.id)),
      );
      return inserted.rows.length;
    });
  }
}
