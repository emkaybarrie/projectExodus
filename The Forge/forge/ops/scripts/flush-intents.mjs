#!/usr/bin/env node

/**
 * Flush Intents Queue
 *
 * Writes queued Director Intents from staging file to the persistent intents.json.
 *
 * Usage: node "The Forge/forge/ops/scripts/flush-intents.mjs"
 *
 * Input:  exports/cognition/intents-queue.json (staging - from Portal localStorage export)
 * Output: exports/cognition/intents.json (persistent)
 *
 * FCL v2: Director Intent persistence layer
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../');

const INTENTS_FILE = path.join(REPO_ROOT, 'The Forge/forge/exports/cognition/intents.json');
const QUEUE_FILE = path.join(REPO_ROOT, 'The Forge/forge/exports/cognition/intents-queue.json');

async function main() {
  console.log('[Intents Flush] Starting...');

  // Check if queue file exists
  if (!fs.existsSync(QUEUE_FILE)) {
    console.log('[Intents Flush] No queue file found. Nothing to flush.');
    console.log('[Intents Flush] To create queue file, export from Portal localStorage:');
    console.log('  localStorage.getItem("forge_intents_queue")');
    return;
  }

  // Read queue
  let queueData;
  try {
    const queueContent = fs.readFileSync(QUEUE_FILE, 'utf-8').trim();
    if (!queueContent) {
      console.log('[Intents Flush] Queue file is empty. Nothing to flush.');
      return;
    }
    queueData = JSON.parse(queueContent);
  } catch (e) {
    console.error('[Intents Flush] Failed to parse queue file:', e.message);
    return;
  }

  const intents = queueData.intents || [];
  if (intents.length === 0) {
    console.log('[Intents Flush] No intents in queue. Nothing to flush.');
    return;
  }

  console.log(`[Intents Flush] Found ${intents.length} intents in queue.`);

  // Validate each intent
  const validIntents = [];
  for (const intent of intents) {
    if (intent.intentType === 'DirectorIntent' && intent.id && intent.title) {
      validIntents.push(intent);
    } else {
      console.warn('[Intents Flush] Skipping invalid intent:', intent.id || 'unknown');
    }
  }

  if (validIntents.length === 0) {
    console.log('[Intents Flush] No valid intents to flush.');
    return;
  }

  // Load existing intents file
  let existingData = {
    intentsType: 'DirectorIntentIndex',
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    intents: [],
    counts: { total: 0, active: 0, completed: 0, abandoned: 0 }
  };

  if (fs.existsSync(INTENTS_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(INTENTS_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[Intents Flush] Failed to parse existing intents.json, starting fresh');
    }
  }

  // Merge: queue intents win over existing (by ID, newer updatedAt wins)
  const merged = new Map();

  // Add existing intents
  for (const intent of existingData.intents || []) {
    merged.set(intent.id, intent);
  }

  // Override with queue intents (more recent)
  for (const intent of validIntents) {
    const existing = merged.get(intent.id);
    if (!existing || new Date(intent.metadata?.updatedAt) >= new Date(existing.metadata?.updatedAt)) {
      merged.set(intent.id, intent);
    }
  }

  const finalIntents = Array.from(merged.values());

  // Calculate counts
  const counts = {
    total: finalIntents.length,
    active: finalIntents.filter(i => i.status === 'active').length,
    completed: finalIntents.filter(i => i.status === 'completed').length,
    abandoned: finalIntents.filter(i => i.status === 'abandoned').length
  };

  // Build output
  const output = {
    intentsType: 'DirectorIntentIndex',
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    intents: finalIntents,
    counts
  };

  // Write to intents.json
  fs.writeFileSync(INTENTS_FILE, JSON.stringify(output, null, 2));
  console.log(`[Intents Flush] Wrote ${finalIntents.length} intents to intents.json`);
  console.log(`[Intents Flush] Counts: ${counts.active} active, ${counts.completed} completed, ${counts.abandoned} abandoned`);

  // Clear queue file
  fs.writeFileSync(QUEUE_FILE, '{}');
  console.log('[Intents Flush] Queue cleared.');

  console.log('[Intents Flush] Complete.');
}

main().catch(err => {
  console.error('[Intents Flush] Error:', err);
  process.exit(1);
});
