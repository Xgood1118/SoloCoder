"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPool = void 0;
const uuid_1 = require("uuid");
const SdkError_1 = require("../errors/SdkError");
class ConnectionPool {
    constructor(config, factory, poolName = 'default', logger) {
        this.connections = new Map();
        this.waitingQueue = [];
        this.config = config;
        this.factory = factory;
        this.poolName = poolName;
        this.logger = logger;
        this.initialize();
    }
    async initialize() {
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
        }
        catch (error) {
            if (this.logger) {
                this.logger.error('Failed to initialize connection pool', error, {
                    poolName: this.poolName,
                });
            }
            throw error;
        }
    }
    async createConnection() {
        const id = (0, uuid_1.v4)();
        const now = Date.now();
        try {
            const connection = await this.factory.create();
            const pooled = {
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
        }
        catch (error) {
            if (this.logger) {
                this.logger.error('Failed to create connection', error, {
                    poolName: this.poolName,
                });
            }
            throw SdkError_1.SdkError.fromError(error);
        }
    }
    async acquire() {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new SdkError_1.SdkError(SdkError_1.ErrorCode.POOL_TIMEOUT, 'Timed out waiting for connection', {
                    details: {
                        poolName: this.poolName,
                        totalConnections: this.connections.size,
                        inUse: this.getInUseCount(),
                        waiting: this.waitingQueue.length,
                    },
                }));
            }, this.config.acquireTimeoutMs);
            const tryAcquire = async () => {
                const available = Array.from(this.connections.values()).find((c) => !c.inUse);
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
                    }
                    else {
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
                    }
                    catch (error) {
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
    release(connection) {
        const pooled = Array.from(this.connections.values()).find((c) => c.connection === connection);
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
            const resolve = this.waitingQueue.shift();
            pooled.inUse = true;
            pooled.lastUsedAt = Date.now();
            resolve(pooled.connection);
        }
    }
    async validateConnection(pooled) {
        if (this.factory.validate) {
            try {
                return await this.factory.validate(pooled.connection);
            }
            catch (error) {
                if (this.logger) {
                    this.logger.warn('Connection validation failed', {
                        name: this.poolName,
                        connectionId: pooled.id,
                    }, error);
                }
                return false;
            }
        }
        return true;
    }
    async destroyConnection(id) {
        const pooled = this.connections.get(id);
        if (!pooled)
            return;
        try {
            await this.factory.destroy(pooled.connection);
        }
        catch (error) {
            if (this.logger) {
                this.logger.warn('Error destroying connection', {
                    name: this.poolName,
                    connectionId: id,
                }, error);
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
    cleanupIdleConnections() {
        const now = Date.now();
        const idleConnections = Array.from(this.connections.values()).filter((c) => !c.inUse && (now - c.lastUsedAt) > this.config.idleTimeoutMs);
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
    getInUseCount() {
        return Array.from(this.connections.values()).filter((c) => c.inUse).length;
    }
    getConnectionInfo() {
        return Array.from(this.connections.values()).map((c) => ({
            id: c.id,
            createdAt: c.createdAt,
            lastUsedAt: c.lastUsedAt,
            inUse: c.inUse,
        }));
    }
    getStats() {
        const total = this.connections.size;
        const inUse = this.getInUseCount();
        return {
            total,
            inUse,
            available: total - inUse,
            waiting: this.waitingQueue.length,
        };
    }
    async close() {
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
        const destroyPromises = Array.from(this.connections.keys()).map((id) => this.destroyConnection(id));
        await Promise.allSettled(destroyPromises);
        this.connections.clear();
        this.waitingQueue = [];
    }
}
exports.ConnectionPool = ConnectionPool;
