import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly databaseUrl = process.env.DATABASE_URL;
  private readonly pool: Pool;
  private readonly db: NodePgDatabase;

  constructor() {
    this.pool = new Pool({
      connectionString: this.databaseUrl,
    });
    this.db = drizzle({ client: this.pool });
  }

  async ping(): Promise<void> {
    if (!this.databaseUrl) {
      throw new ServiceUnavailableException('DATABASE_URL is not configured');
    }

    await this.db.execute(sql`select 1`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
