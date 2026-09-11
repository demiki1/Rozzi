import { validate } from 'class-validator';
import { RegisterDto } from '../../src/modules/auth/dto/register.dto';

async function validatePassword(password: string) {
  const dto = Object.assign(new RegisterDto(), {
    fullName: 'Test User',
    email: 'test@example.com',
    password,
    role: 'CUSTOMER',
  });
  return validate(dto);
}

describe('RegisterDto password policy', () => {
  it('requires a letter and number', async () => {
    expect((await validatePassword('abcdefgh')).some((e) => e.property === 'password')).toBe(true);
    expect((await validatePassword('12345678')).some((e) => e.property === 'password')).toBe(true);
    expect((await validatePassword('Password1')).some((e) => e.property === 'password')).toBe(false);
  });

  it('rejects passwords longer than bcrypt safe input length', async () => {
    const errors = await validatePassword(`A${'a'.repeat(71)}1`);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
