import { v4 as uuidv4 } from 'uuid';
import { ConnectionPoolConfig, ConnectionInfo } from '../types';
import { SdkError, ErrorCode } from '../errors/SdkError';
import { Logger } from '../logging/Logger';

interface PooledConnection<T> {
  id: string;
  connection: T;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

export interface ConnectionFactory<T> {
  create(): Promise<T>;
  destroy(connection: T): Promise<void>;
  validate?(connection: T): Promise<boolean>;
}

export class ConnectionPool<T> {
  private config: ConnectionPoolConfig;
  private factory: ConnectionFactory<T>;
  private connections: Map<string, PooledConnection<T>> = new Map();
  private waitingQueue: Array<(connection: T) => void> = [];
  private cleanupTimer?: NodeJS.Timeout;
  private logger?: Logger;
  private poolName: string;

  constructor(
    config: ConnectionPoolConfig,
    factory: ConnectionFactory<T>,
    poolName: string = 'default',
    logger?: Logger
  ) {
    this.config = config;
    this.factory = factory;
    this.poolName = poolName;
    this.logger = logger;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.createConnection();
      }

      this.cleanupTimer = setInterval(() => {
        this.cleanupIdleConnections();
      }, 10000);

      if (this.logger) {
        this.logger.debug('Connection pool initialized', {
          poolName: this.poolName,
          minConnections: this.config.minConnections,
          maxConnections: this.config.maxConnections,
        });
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to initialize connection pool', error as Error, {
          poolName: this.poolName,
        });
      }
      throw error;
    }
  }

  private async createConnection(): Promise<PooledConnection<T>> {
    const id = uuidv4();
    const now = Date.now();

    try {
      const connection = await this.factory.create();

      const pooled: PooledConnection<T> = {
        id,
        connection,
        createdAt: now,
        lastUsedAt: now,
        inUse: false,
      };

      this.connections.set(id, pooled);

      if (this.logger) {
        this.logger.debug('Created new connection', {
          poolName: this.poolName,
          connectionId: id,
          totalConnections: this.connections.size,
        });
      }

      return pooled;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create connection', error as Error, {
          poolName: this.poolName,
        });
      }
      throw SdkError.fromError(error as Error);
    }
  }

  async acquire(): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SdkError(ErrorCode.POOL_TIMEOUT, 'Timed out waiting for connection', {
          details: {
            poolName: this.poolName,
            totalConnections: this.connections.size,
            inUse: this.getInUseCount(),
            waiting: this.waitingQueue.length,
          },
        }));
      }, this.config.acquireTimeoutMs);

      const tryAcquire = async () => {
        const available = Array.from(this.connections.values()).find(
          (c) => !c.inUse
        );

        if (available) {
          const isValid = await this.validateConnection(available);

          if (isValid) {
            available.inUse = true;
            available.lastUsedAt = Date.now();
            clearTimeout(timeout);

            if (this.logger) {
              this.logger.debug('Acquired connection from pool', {
                poolName: this.poolName,
                connectionId: available.id,
                totalConnections: this.connections.size,
                inUse: this.getInUseCount(),
              });
            }

            resolve(available.connection);
            return true;
          } else {
            await this.destroyConnection(available.id);
          }
        }

        if (this.connections.size < this.config.maxConnections) {
          try {
            const newConn = await this.createConnection();
            newConn.inUse = true;
            newConn.lastUsedAt = Date.now();
            clearTimeout(timeout);
            resolve(newConn.connection);
            return true;
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
            return true;
          }
        }

        return false;
      };

      const acquired = await tryAcquire();
      if (!acquired) {
        if (this.logger) {
          this.logger.warn('Connection pool exhausted, adding to waiting queue', {
            poolName: this.poolName,
            totalConnections: this.connections.size,
            inUse: this.getInUseCount(),
            waitingQueueSize: this.waitingQueue.length,
          });
        }

        this.waitingQueue.push((connection) => {
          clearTimeout(timeout);
          resolve(connection);
        });
      }
    });
  }

  release(connection: T): void {
    const pooled = Array.from(this.connections.values()).find(
      (c) => c.connection === connection
    );

    if (!pooled) {
      if (this.logger) {
        this.logger.warn('Released connection not found in pool', {
          poolName: this.poolName,
        });
      }
      return;
    }

    pooled.inUse = false;
    pooled.lastUsedAt = Date.now();

    if (this.logger) {
      this.logger.debug('Released connection back to pool', {
        poolName: this.poolName,
        connectionId: pooled.id,
        totalConnections: this.connections.size,
        inUse: this.getInUseCount(),
      });
    }

    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift()!;
      pooled.inUse = true;
      pooled.lastUsedAt = Date.now();
      resolve(pooled.connection);
    }
  }

  private async validateConnection(pooled: PooledConnection<T>): Promise<boolean> {
    if (this.factory.validate) {
      try {
        return await this.factory.validate(pooled.connection);
      } catch (error) {
        if (this.logger) {
          this.logger.warn('Connection validation failed', {
            name: this.poolName,
            connectionId: pooled.id,
          }, error as Error);
        }
        return false;
      }
    }
    return true;
  }

  private async destroyConnection(id: string): Promise<void> {
    const pooled = this.connections.get(id);
    if (!pooled) return;

    try {
      await this.factory.destroy(pooled.connection);
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Error destroying connection', {
          name: this.poolName,
          connectionId: id,
        }, error as Error);
      }
    }

    this.connections.delete(id);

    if (this.logger) {
      this.logger.debug('Destroyed connection', {
        poolName: this.poolName,
        connectionId: id,
        totalConnections: this.connections.size,
      });
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const idleConnections = Array.from(this.connections.values()).filter(
      (c) => !c.inUse && (now - c.lastUsedAt) > this.config.idleTimeoutMs
    );

    const minToKeep = this.config.minConnections;
    const toDestroy = idleConnections.slice(0, Math.max(0, idleConnections.length - minToKeep));

    for (const pooled of toDestroy) {
      this.destroyConnection(pooled.id).catch((err) => {
        if (this.logger) {
          this.logger.warn('Error during idle connection cleanup', {
            name: this.poolName,
            connectionId: pooled.id,
          }, err);
        }
      });
    }
  }

  private getInUseCount(): number {
    return Array.from(this.connections.values()).filter((c) => c.inUse).length;
  }

  getConnectionInfo(): ConnectionInfo[] {
    return Array.from(this.connections.values()).map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
      inUse: c.inUse,
    }));
  }

  getStats(): {
    total: number;
    inUse: number;
    available: number;
    waiting: number;
  } {
    const total = this.connections.size;
    const inUse = this.getInUseCount();
    return {
      total,
      inUse,
      available: total - inUse,
      waiting: this.waitingQueue.length,
    };
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if (this.logger) {
      this.logger.info('Closing connection pool', {
        poolName: this.poolName,
        totalConnections: this.connections.size,
      });
    }

    const destroyPromises = Array.from(this.connections.keys()).map((id) =>
      this.destroyConnection(id)
    );

    await Promise.allSettled(destroyPromises);

    this.connections.clear();
    this.waitingQueue = [];
  }
}
