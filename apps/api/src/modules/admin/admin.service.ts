import type { AdminStats } from '@libify/shared';
import type { AdminRepository } from './admin.repository';

export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  getStats(): Promise<AdminStats> {
    return this.repo.stats();
  }
}
