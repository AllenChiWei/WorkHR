import type { DataSource } from './contracts';
import { mockDataSource } from './mock';
import { httpDataSource } from './http';

/**
 * 依環境變數決定注入哪一組實作，其餘程式碼完全無感。
 *   VITE_DATA_SOURCE=mock → localStorage 假資料（現階段）
 *   VITE_DATA_SOURCE=api  → HTTP adapter（接後端後啟用）
 */
export type DataSourceKind = 'mock' | 'api';

export const DATA_SOURCE_KIND: DataSourceKind =
  import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock';

export const services: DataSource = DATA_SOURCE_KIND === 'api' ? httpDataSource : mockDataSource;

export const isMockDataSource = DATA_SOURCE_KIND === 'mock';

export type * from './contracts';
