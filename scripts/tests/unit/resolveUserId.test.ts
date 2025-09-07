async function main() {
  // Test case 1: providedUserId is ignored
  try {
    const { resolveUserId } = await import('@/config/dev');
    resolveUserId('some-user-id');
    assert(false, 'Test Case 1 Failed: Should have thrown an error');
  } catch (error: any) {
    assert(error.message.includes('User ID is required'), 'Test Case 1 Failed: Incorrect error message');
    console.log('Test Case 1 Passed: providedUserId is ignored');
  }

  // Test case 2: Dev mode with default user ID
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
