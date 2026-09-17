import type { DataSource, DevRepository } from '../contracts';
import { mockAttendanceRepository } from './attendance';
import { mockAuthRepository } from './auth';
import { mockCrewRepository } from './crews';
import { mockWorkerRepository } from './workers';
import { clearSessionStorage, delay, resetDb } from './db';

const mockDevRepository: DevRepository = {
  async resetMockData(): Promise<void> {
    await delay();
    resetDb();
    clearSessionStorage();
  },
};

export const mockDataSource: DataSource = {
  auth: mockAuthRepository,
  crews: mockCrewRepository,
  workers: mockWorkerRepository,
  attendance: mockAttendanceRepository,
  dev: mockDevRepository,
};
