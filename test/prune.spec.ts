import { isModule } from '../src/prune';
import path from 'node:path';

describe('isModule', () => {
  it('detects module folders', async () => {
    const fixture = path.join(__dirname, 'fixtures', 'prune-is-module');
    await expect(
      isModule(path.join(fixture, 'node_modules', 'module')),
    ).resolves.toBe(true);
    await expect(
      isModule(path.join(fixture, 'node_modules', 'not-module')),
    ).resolves.toBe(false);
    await expect(
      isModule(path.join(fixture, 'node_modules', '@user/namespaced')),
    ).resolves.toBe(true);
  });
});
