import { type Page, type Locator } from '@playwright/test';

export class InscricaoPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async goto(): Promise<void> {
    await this.page.goto('/inscricoes');
  }
}
