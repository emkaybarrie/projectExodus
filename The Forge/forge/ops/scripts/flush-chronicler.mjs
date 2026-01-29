#!/usr/bin/env node

/**
 * Flush Chronicler Queue
 *
 * Appends queued Chronicler entries from staging file to the persistent chronicler.jsonl.
 *
 * Usage: node "The Forge/forge/ops/scripts/flush-chronicler.mjs"
 *
 * Input:  exports/cognition/chronicler-queue.jsonl (staging)
 * Output: exports/cognition/chronicler.jsonl (persistent)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../');

const CHRONICLER_FILE = path.join(REPO_ROOT, 'The Forge/forge/exports/cognition/chronicler.jsonl');
const QUEUE_FILE = path.join(REPO_ROOT, 'The Forge/forge/exports/cognition/chronicler-queue.jsonl');

async function main() {
  console.log('[Chronicler Flush] Starting...');

  // Check if queue file exists
  if (!fs.existsSync(QUEUE_FILE)) {
    console.log('[Chronicler Flush] No queue file found. Nothing to flush.');
    return;
  }

  // Read queue
  const queueContent = fs.readFileSync(QUEUE_FILE, 'utf-8').trim();
  if (!queueContent) {
    console.log('[Chronicler Flush] Queue file is empty. Nothing to flush.');
    return;
  }

  const lines = queueContent.split('\n').filter(line => line.trim());
  console.log(`[Chronicler Flush] Found ${lines.length} queued entries.`);

  // Validate each line is valid JSON
  const validEntries = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.entryType === 'ChroniclerEntry') {
        validEntries.push(line);
      } else {
        console.warn('[Chronicler Flush] Skipping invalid entry (wrong type):', line.substring(0, 50));
      }
    } catch (e) {
      console.warn('[Chronicler Flush] Skipping invalid JSON:', line.substring(0, 50));
    }
  }

  if (validEntries.length === 0) {
    console.log('[Chronicler Flush] No valid entries to flush.');
    return;
  }

  // Ensure chronicler file exists
  if (!fs.existsSync(CHRONICLER_FILE)) {
    console.log('[Chronicler Flush] Creating chronicler.jsonl...');
    fs.writeFileSync(CHRONICLER_FILE, '');
  }

  // Append to chronicler file
  const appendContent = validEntries.join('\n') + '\n';
  fs.appendFileSync(CHRONICLER_FILE, appendContent);
  console.log(`[Chronicler Flush] Appended ${validEntries.length} entries to chronicler.jsonl`);

  // Clear queue file
  fs.writeFileSync(QUEUE_FILE, '');
  console.log('[Chronicler Flush] Queue cleared.');

  console.log('[Chronicler Flush] Complete.');
}

main().catch(err => {
  console.error('[Chronicler Flush] Error:', err);
  process.exit(1);
});
