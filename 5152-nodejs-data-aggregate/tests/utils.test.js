const { encrypt, decrypt } = require('../src/utils/encryption');
const { hashQuery } = require('../src/utils/hash');

describe('Encryption Utils', () => {
  test('should encrypt and decrypt text', () => {
    const original = 'my-secret-password';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  test('should produce different ciphertext each time', () => {
    const original = 'my-secret-password';
    const enc1 = encrypt(original);
    const enc2 = encrypt(original);
    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(original);
    expect(decrypt(enc2)).toBe(original);
  });
});

describe('Hash Utils', () => {
  test('should generate consistent hash for same query and datasources', () => {
    const hash1 = hashQuery('SELECT * FROM users', ['ds1', 'ds2']);
    const hash2 = hashQuery('SELECT * FROM users', ['ds1', 'ds2']);
    expect(hash1).toBe(hash2);
  });

  test('should generate different hash for different queries', () => {
    const hash1 = hashQuery('SELECT * FROM users', ['ds1']);
    const hash2 = hashQuery('SELECT * FROM orders', ['ds1']);
    expect(hash1).not.toBe(hash2);
  });

  test('should generate different hash for different datasources', () => {
    const hash1 = hashQuery('SELECT * FROM users', ['ds1']);
    const hash2 = hashQuery('SELECT * FROM users', ['ds2']);
    expect(hash1).not.toBe(hash2);
  });

  test('should be order-independent for datasource IDs', () => {
    const hash1 = hashQuery('SELECT * FROM users', ['ds1', 'ds2']);
    const hash2 = hashQuery('SELECT * FROM users', ['ds2', 'ds1']);
    expect(hash1).toBe(hash2);
  });
});
