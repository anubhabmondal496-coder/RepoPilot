import * as assert from 'assert';
import * as vscode from 'vscode';
import { HealthMonitor } from '../watchers/healthMonitor';
import { CommitDrafter } from '../git/commitDrafter';

suite('RepoPilot Phase 1 Test Suite', () => {
  suiteSetup(() => {
    vscode.window.showInformationMessage('Starting RepoPilot Phase 1 tests...');
  });

  test('Registered commands exist in VS Code registry', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('repopilot.draftCommit'), 'repopilot.draftCommit should be registered');
    assert.ok(commands.includes('repopilot.turboMode'), 'repopilot.turboMode should be registered');
    assert.ok(commands.includes('repopilot.sprintLogistics'), 'repopilot.sprintLogistics should be registered');
  });

  test('HealthMonitor normalizes path parameters and query strings', () => {
    const monitor = new HealthMonitor();

    // Query string stripping
    assert.strictEqual(monitor.normalizeRoute('/api/v1/users?limit=10'), '/api/v1/users');

    // FastAPI/Flask parameter syntax
    assert.strictEqual(monitor.normalizeRoute('/api/v1/users/{id}'), '/api/v1/users/:param');
    assert.strictEqual(monitor.normalizeRoute('/api/v1/orgs/{org_id}/users/{user_id}'), '/api/v1/orgs/:param/users/:param');

    // Express parameter syntax
    assert.strictEqual(monitor.normalizeRoute('/api/v1/users/:id'), '/api/v1/users/:param');

    // JavaScript template literal syntax
    assert.strictEqual(monitor.normalizeRoute('/api/v1/users/${id}'), '/api/v1/users/:param');

    // Trailing slash normalization
    assert.strictEqual(monitor.normalizeRoute('/api/v1/health/'), '/api/v1/health');

    monitor.dispose();
  });

  test('CommitDrafter synthesizes conventional commit messages accurately', () => {
    const drafter = new CommitDrafter();

    // Dependency changes
    const depMessage = drafter.synthesizeConventionalCommit(['requirements.txt'], '+httpx==0.27.0');
    assert.ok(depMessage.startsWith('fix(deps)') || depMessage.startsWith('chore(deps)'));

    // Documentation changes
    const docMessage = drafter.synthesizeConventionalCommit(['README.md'], '+## Architecture');
    assert.strictEqual(docMessage, 'docs(readme): update system architecture and usage documentation');

    // API changes
    const apiMessage = drafter.synthesizeConventionalCommit(
      ['backend.py'],
      '+@app.get("/api/v1/items")\ndef get_items(): pass'
    );
    assert.strictEqual(apiMessage, 'feat(api): implement /api/v1/items endpoint');

    // Config changes
    const configMessage = drafter.synthesizeConventionalCommit(['tsconfig.json'], '+  "target": "ES2022"');
    assert.ok(configMessage.startsWith('chore(config)'));
  });
});
