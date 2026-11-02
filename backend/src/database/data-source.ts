import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

const port = Number(process.env.DB_PORT ?? 3306);

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE ?? 'asset_loan',
  charset: 'utf8mb4',
  timezone: 'Z',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [`${__dirname}/entities/*.entity{.ts,.js}`],
});
