import { FetchTransport, XHRTransport } from '@sentry/browser/dist/transports';
import { Event, Response, Transport, TransportOptions } from '@sentry/types';
import { PromiseBuffer, SentryError, supportsFetch } from '@sentry/utils';

import { NATIVE } from '../wrapper';

/**
 * Uses the native transport if available, otherwise falls back to Fetch/XHR transport.
 * @see NATIVE.SUPPORTS_NATIVE_TRANSPORT for platforms with native transport
 */
export class CordovaTransport implements Transport {
  /** A simple buffer holding all requests. */
  protected readonly _buffer: PromiseBuffer<Response> = new PromiseBuffer(30);

  /** Fallback transport uses if native transport is not available */
  private _fallbackTransport: Transport;

  constructor(options: TransportOptions) {
    if (supportsFetch()) {
      this._fallbackTransport = new FetchTransport(options);
    } else {
      this._fallbackTransport = new XHRTransport(options);
    }
  }

  /**
   * @inheritDoc
   */
  public sendEvent(event: Event): PromiseLike<Response> {
    if (NATIVE.isNativeTransportAvailable()) {
      if (!this._buffer.isReady()) {
        return Promise.reject(new SentryError('Not adding Promise due to buffer limit reached.'));
      }
      return this._buffer.add(NATIVE.sendEvent(event));
    }

    return this._fallbackTransport.sendEvent(event);
  }

  /**
   * @inheritDoc
   */
  public close(timeout?: number): PromiseLike<boolean> {
    return Promise.all([this._buffer.drain(timeout), this._fallbackTransport.close()]).then(
      ([bufferDrained, fallbackClosed]) => bufferDrained && fallbackClosed
    );
  }
}
