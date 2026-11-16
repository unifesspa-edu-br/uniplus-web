import type { Page, TestInfo } from '@playwright/test';
import { mockUnidadesApi } from './api-das-unidades';
import { mockConfiguracaoRuntimeConfig } from './runtime-config';

export type VisualTheme = 'light' | 'dark' | 'contrast';
export type VisualViewport = 'mobile' | 'desktop';

export function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

export function metadataViewport(testInfo: TestInfo): VisualViewport {
  return testInfo.project.metadata['viewport'] === 'mobile' ? 'mobile' : 'desktop';
}

/** O tema do project, a configuração de runtime e a API de unidades que as telas consultam. */
export async function prepararTelaDeUnidades(page: Page, testInfo: TestInfo): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await page.addInitScript((dsTheme: VisualTheme) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
        contrast: dsTheme === 'contrast',
        fontMode: 'default',
      }),
    );
  }, metadataTheme(testInfo));
  await mockUnidadesApi(page);
}

export async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: 'unidades-lista' | 'unidades-drawer',
): Promise<void> {
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}
