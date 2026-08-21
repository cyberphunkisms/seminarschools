'use strict';

/**
 * Return one normalized UTC build timestamp. Release and clean-room callers
 * may pin it with MEPHISTODATA_GENERATED_AT or SOURCE_DATE_EPOCH; ordinary
 * ad-hoc generation retains wall-clock behavior.
 */
function generatedAt(env = process.env, clock = () => new Date()) {
  const explicit = String(env.MEPHISTODATA_GENERATED_AT || '').trim();
  if (explicit) {
    const parsed = new Date(explicit);
    if (Number.isNaN(parsed.getTime())) throw new Error('MEPHISTODATA_GENERATED_AT must be an ISO-8601 timestamp');
    return parsed.toISOString();
  }
  const epoch = String(env.SOURCE_DATE_EPOCH || '').trim();
  if (epoch) {
    if (!/^\d+$/.test(epoch)) throw new Error('SOURCE_DATE_EPOCH must be a non-negative integer');
    const millis = Number(epoch) * 1000;
    if (!Number.isSafeInteger(millis)) throw new Error('SOURCE_DATE_EPOCH is outside the supported date range');
    const parsed = new Date(millis);
    if (Number.isNaN(parsed.getTime())) throw new Error('SOURCE_DATE_EPOCH is outside the supported date range');
    return parsed.toISOString();
  }
  return clock().toISOString();
}

module.exports = {generatedAt};
