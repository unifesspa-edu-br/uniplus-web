// Services
export { LoadingService } from './interceptors/loading.service';
export { NotificationService } from './services/notification.service';
export type { Notification, NotificationType } from './services/notification.service';
export { RELOGIO } from './services/relogio';

// Interceptors
export { loadingInterceptor } from './interceptors/loading.interceptor';

// DOM primitives
export {
  createDisclosureController,
  type UiDisclosureController,
  type UiDisclosureControllerOptions,
  type UiDisclosureRef,
} from './dom/disclosure';
export { mediaQuerySignal } from './dom/media-query';

// HTTP — adapter `ApiResult<T>` consolidado (ADR-0011 + ADR-0012)
export * from './http';
export * from './http/idempotency';
