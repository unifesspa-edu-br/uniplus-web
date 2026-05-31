import { ElementRef, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDisclosureController, UiDisclosureController } from './disclosure';

describe('createDisclosureController', () => {
  let host: HTMLElement;
  let trigger: HTMLButtonElement;
  let panel: HTMLElement;
  let firstControl: HTMLButtonElement;
  let outside: HTMLButtonElement;
  let controller: UiDisclosureController;

  beforeEach(() => {
    vi.useFakeTimers();

    host = document.createElement('div');
    trigger = document.createElement('button');
    panel = document.createElement('div');
    firstControl = document.createElement('button');
    outside = document.createElement('button');

    host.append(trigger, panel);
    panel.append(firstControl);
    document.body.append(host, outside);

    controller = createDisclosureController({
      document,
      host: new ElementRef(host),
      panel: signal(new ElementRef(panel)),
      trigger: signal(new ElementRef(trigger)),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    host.remove();
    outside.remove();
  });

  it('abre e envia foco ao primeiro controle do painel', () => {
    controller.openPanel();
    vi.runOnlyPendingTimers();

    expect(controller.open()).toBe(true);
    expect(document.activeElement).toBe(firstControl);
  });

  it('fecha e restaura foco quando o foco atual estava dentro do painel', () => {
    controller.openPanel();
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(firstControl);

    controller.close(false);

    expect(controller.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('fecha ao clicar fora do host', () => {
    controller.openPanel();
    vi.runOnlyPendingTimers();

    const event = new MouseEvent('click', { bubbles: true });
    outside.dispatchEvent(event);
    controller.closeOnDocumentClick(event);

    expect(controller.open()).toBe(false);
  });

  it('mantem aberto ao clicar dentro do host', () => {
    controller.openPanel();
    vi.runOnlyPendingTimers();

    const event = new MouseEvent('click', { bubbles: true });
    firstControl.dispatchEvent(event);
    controller.closeOnDocumentClick(event);

    expect(controller.open()).toBe(true);
  });

  it('fecha com Escape e restaura foco no trigger', () => {
    controller.openPanel();
    vi.runOnlyPendingTimers();

    controller.closeOnEscape();

    expect(controller.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
