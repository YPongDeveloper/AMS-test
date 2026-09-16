const test = require('node:test');
const assert = require('node:assert/strict');

class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, val) {
    this.store.set(key, String(val));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

test('Offline Sync - Task queue and storage persistence', () => {
  const storage = new MockLocalStorage();
  const queueKey = 'ams_offline_task_queue';

  // 1. Initial queue should be empty
  assert.equal(storage.getItem(queueKey), null);

  // 2. Add offline action
  const action1 = {
    id: 'act-001',
    type: 'UPDATE_STATUS',
    taskId: 'tk-mock-01',
    status: 'in_progress',
    timestamp: Date.now()
  };

  let queue = [action1];
  storage.setItem(queueKey, JSON.stringify(queue));

  // 3. Retrieve and verify
  const stored = JSON.parse(storage.getItem(queueKey));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].taskId, 'tk-mock-01');
  assert.equal(stored[0].status, 'in_progress');

  // 4. Enqueue second action
  const action2 = {
    id: 'act-002',
    type: 'SUBMIT_SURVEY',
    taskId: 'tk-mock-01',
    status: 'submitted',
    timestamp: Date.now()
  };
  stored.push(action2);
  storage.setItem(queueKey, JSON.stringify(stored));

  const updatedQueue = JSON.parse(storage.getItem(queueKey));
  assert.equal(updatedQueue.length, 2);

  // 5. Drain/Replay queue upon reconnect
  const replayed = [];
  while (updatedQueue.length > 0) {
    const item = updatedQueue.shift();
    replayed.push(item.id);
  }
  storage.setItem(queueKey, JSON.stringify(updatedQueue));

  assert.deepEqual(replayed, ['act-001', 'act-002']);
  assert.equal(JSON.parse(storage.getItem(queueKey)).length, 0);
});
