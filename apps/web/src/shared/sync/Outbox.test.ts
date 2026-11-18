import { describe, expect, it } from 'vitest';
import type { SyncOp } from '@libify/shared';
import { openLibifyDb } from '@/shared/db/libifyDb';
import { Outbox } from './Outbox';

const op = (key: string, at: string): SyncOp => ({ entity: 'favorite', key, clientUpdatedAt: at, data: null });
let n = 0;
const fresh = async () => new Outbox(await openLibifyDb(`test-outbox-${n++}`));

describe('Outbox', () => {
  it('keeps only the newest op per record', async () => {
    const outbox = await fresh();
    await outbox.put(op('1', '2026-01-01T00:00:01.000Z'));
    await outbox.put(op('1', '2026-01-01T00:00:02.000Z'));
    await outbox.put(op('2', '2026-01-01T00:00:01.000Z'));
    const entries = await outbox.peek(10);
    expect(entries.map((e) => [e.op.key, e.op.clientUpdatedAt])).toEqual([
      ['1', '2026-01-01T00:00:02.000Z'],
      ['2', '2026-01-01T00:00:01.000Z'],
    ]);
  });

  it('peek respects the limit', async () => {
    const outbox = await fresh();
    for (let i = 0; i < 5; i++) await outbox.put(op(String(i), '2026-01-01T00:00:01.000Z'));
    expect(await outbox.peek(3)).toHaveLength(3);
  });

  it('acknowledge does not drop an op that was replaced while pushing', async () => {
    const outbox = await fresh();
    await outbox.put(op('1', '2026-01-01T00:00:01.000Z'));
    const sent = await outbox.peek(10);
    await outbox.put(op('1', '2026-01-01T00:00:05.000Z'));
    await outbox.acknowledge(sent);
    const left = await outbox.peek(10);
    expect(left.map((e) => e.op.clientUpdatedAt)).toEqual(['2026-01-01T00:00:05.000Z']);
  });

  it('clear empties the queue', async () => {
    const outbox = await fresh();
    await outbox.put(op('1', '2026-01-01T00:00:01.000Z'));
    await outbox.clear();
    expect(await outbox.size()).toBe(0);
  });
});
