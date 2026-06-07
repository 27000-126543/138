import { BaseRepository } from './BaseRepository.js';
import type { User } from '../../shared/types.js';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  findByUsername(username: string): User | undefined {
    return this.queryOne('SELECT * FROM users WHERE username = ?', [username]);
  }

  findByEmail(email: string): User | undefined {
    return this.queryOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  updateLastLogin(id: string, lastLogin: string): User | undefined {
    return this.update(id, { lastLogin } as Partial<User>);
  }
}

export const userRepository = new UserRepository();
