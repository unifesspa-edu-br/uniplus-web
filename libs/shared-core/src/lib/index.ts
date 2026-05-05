// Services
export { LoadingService } from './services/loading.service';
export { NotificationService } from './services/notification.service';
export type { Notification } from './services/notification.service';

// Interceptors
export { loadingInterceptor } from './interceptors/loading.interceptor';

// HTTP — adapter `ApiResult<T>` consolidado (ADR-0011 + ADR-0012)
export * from './http';
