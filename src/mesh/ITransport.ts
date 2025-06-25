export interface ITransport {
  listen(): AsyncGenerator<Uint8Array|null>;
  send(data: Uint8Array): Promise<void>;
}

class AsyncSemaphore {
  private promises = Array<(_v:unknown) => void>();
  private permits = 0;

  constructor(max: number) {
    this.permits = max;
  }

  signal() {
    this.permits += 1;
    if (this.promises.length > 0) {
      const p = this.promises.pop();
      if (p) {
        p(0);
      }
    }
  }

  async wait() {
    if (this.permits == 0 || this.promises.length > 0)
      await new Promise((r) => this.promises.unshift(r));
    this.permits -= 1;
  }
}

export class AsyncQueue<T> {
  private queue = Array<T>();
  private waitingEnqueue: AsyncSemaphore;
  private waitingDequeue: AsyncSemaphore;

  constructor(maxSize: number) {
    this.waitingEnqueue = new AsyncSemaphore(0);
    this.waitingDequeue = new AsyncSemaphore(maxSize);
  }

  async enqueue(x: T) {
    await this.waitingDequeue.wait();
    this.queue.unshift(x);
    this.waitingEnqueue.signal();
  }

  async dequeue() {
    await this.waitingEnqueue.wait();
    this.waitingDequeue.signal();
    return this.queue.pop()!;
  }
}

export class LoopbackTestTransport implements ITransport {
  packetQueue: AsyncQueue<Uint8Array> = new AsyncQueue<Uint8Array>(10);

  async *listen(): AsyncGenerator<Uint8Array|null> {
    while (true) {
      const packet = await this.packetQueue.dequeue();
      yield packet;
    }
  }

  async send(data: Uint8Array): Promise<void> {
    await this.packetQueue.enqueue(data);
  }
}
