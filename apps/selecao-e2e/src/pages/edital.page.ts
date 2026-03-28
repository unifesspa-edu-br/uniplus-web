import { type Page, type Locator } from '@playwright/test';

export class EditalPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h2');
    this.createButton = page.locator('button:has-text("Novo Edital")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/editais');
  }
}
