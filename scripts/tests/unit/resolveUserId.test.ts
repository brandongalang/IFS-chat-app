async function main() {
  // Test case 1: uses provided user ID when dev mode is disabled
  process.env.NODE_ENV = 'production';
  delete process.env.IFS_DEV_MODE;
  delete process.env.NEXT_PUBLIC_IFS_DEV_MODE;
  const { resolveUserId } = await import('@/config/dev?bustCache=' + Date.now());
  const returned = resolveUserId('some-user-id');
  assert(returned === 'some-user-id', 'Test Case 1 Failed: did not return provided user ID');
  console.log('Test Case 1 Passed: uses provided user ID when dev mode is disabled');

  // Test case 2: Dev mode with default user ID
  process.env.NODE_ENV = 'test';
  process.env.IFS_DEV_MODE = 'true';
  process.env.IFS_DEFAULT_USER_ID = 'dev-user-id';
  const { resolveUserId: resolveUserId2 } = await import('@/config/dev?bustCache=' + Date.now());
  const userId = resolveUserId2();
  assert(userId === '11111111-1111-1111-1111-111111111111', 'Test Case 2 Failed: Incorrect user ID');
  console.log('Test Case 2 Passed: Dev mode with default user ID');

  console.log('All resolveUserId unit tests passed.');
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

main().catch((err) => {
  console.error('resolveUserId unit test failed:', err);
  process.exit(1);
});
