import { type Page, type Locator } from '@playwright/test';

export class EditalPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.createButton = page.getByRole('link', { name: 'Novo edital' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/editais');
  }
}
