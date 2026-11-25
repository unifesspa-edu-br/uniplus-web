import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed();

import { afterEach } from 'vitest';
import { encerrarConferenciaDoContrato } from './lib/interceptador-de-conferencia.testing';

afterEach(async () => {
  await encerrarConferenciaDoContrato();
});
