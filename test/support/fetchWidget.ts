/**
 * Global setup for the *.widget.test.tsx files: the widget bundle to run.
 * REPLYZE_WIDGET_JS when it names a built widget.js, otherwise the live one
 * from Replyze's CDN (REPLYZE_WIDGET_URL picks another, e.g. a staging CDN).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    widgetJs: string;
  }
}

export default async function setup(project: TestProject): Promise<void> {
  const local = process.env.REPLYZE_WIDGET_JS;
  if (local && fs.existsSync(local)) {
    project.provide('widgetJs', path.resolve(local));
    return;
  }
  const url = process.env.REPLYZE_WIDGET_URL || 'https://cdn.replyze.chat/widget.js';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download the widget from ${url}: HTTP ${response.status}`);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'replyze-widget-')), 'widget.js');
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  project.provide('widgetJs', file);
}
