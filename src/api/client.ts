import { createBackendApiConfig } from './config';
import { HttpApiClient } from './http';
import { RealtimeApiClient } from './realtime';

export class AppApiClient {
  readonly http: HttpApiClient;
  readonly realtime: RealtimeApiClient;

  constructor(config = createBackendApiConfig()) {
    this.http = new HttpApiClient(config);
    this.realtime = new RealtimeApiClient(config);
  }

  close(): void { this.realtime.close(); }
}
