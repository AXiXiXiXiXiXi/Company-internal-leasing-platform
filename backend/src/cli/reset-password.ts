import 'dotenv/config';
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { createInterface } from 'node:readline/promises';
import { DataSource } from 'typeorm';
import { User } from '../database/entities';

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function promptVisible(question: string): Promise<string> {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await terminal.question(question);
  terminal.close();
  return answer;
}

async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('非交互终端请通过 NEW_PASSWORD 环境变量提供新密码');
  }

  process.stdout.write(question);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = (): void => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    };
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('已取消'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const username = readArgument('--username')
    ?? await promptVisible('用户名: ');
  const password = process.env.NEW_PASSWORD
    ?? await promptHidden('新密码（输入不回显）: ');

  if (username.trim().length < 1) {
    throw new Error('用户名不能为空');
  }
  if (password.length < 8) {
    throw new Error('新密码至少 8 个字符');
  }

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE ?? 'asset_loan',
    charset: 'utf8mb4',
    timezone: 'Z',
    synchronize: false,
    entities: [User],
  });

  await dataSource.initialize();
  try {
    const repository = dataSource.getRepository(User);
    const user = await repository.findOne({ where: { username } });
    if (!user) {
      throw new Error(`用户 ${username} 不存在`);
    }
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    await repository.update(user.id, { passwordHash });
    console.log(`已重置用户 ${username} 的密码。`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
