// backend/tests/lifecycleAndIndexes.test.js
const Booking = require("../models/Booking");
const User = require("../models/User");
const { createShutdownHandler } = require("../server");

describe("Batch 2A — Database Index Definitions", () => {
  it("registers compound index { user: 1, createdAt: -1 } on Booking schema (ARCH-04)", () => {
    const indexes = Booking.schema.indexes();
    const compoundIndex = indexes.find(
      ([spec]) => spec.user === 1 && spec.createdAt === -1
    );

    expect(compoundIndex).toBeDefined();
    expect(compoundIndex[0]).toEqual({ user: 1, createdAt: -1 });
  });

  it("registers sparse index on resetTokenHash on User schema (ARCH-05)", () => {
    const indexes = User.schema.indexes();
    const resetIndex = indexes.find(([spec]) => spec.resetTokenHash === 1);

    expect(resetIndex).toBeDefined();
    expect(resetIndex[1].sparse).toBe(true);
  });

  it("registers sparse index on verifyTokenHash on User schema (ARCH-05)", () => {
    const indexes = User.schema.indexes();
    const verifyIndex = indexes.find(([spec]) => spec.verifyTokenHash === 1);

    expect(verifyIndex).toBeDefined();
    expect(verifyIndex[1].sparse).toBe(true);
  });

  it("does not register duplicate index specifications on Booking or User", () => {
    const bookingIndexSpecs = Booking.schema.indexes().map(([spec]) => JSON.stringify(spec));
    const uniqueBookingSpecs = new Set(bookingIndexSpecs);
    expect(bookingIndexSpecs.length).toBe(uniqueBookingSpecs.size);

    const userIndexSpecs = User.schema.indexes().map(([spec]) => JSON.stringify(spec));
    const uniqueUserSpecs = new Set(userIndexSpecs);
    expect(userIndexSpecs.length).toBe(uniqueUserSpecs.size);
  });
});

describe("Batch 2A — Graceful Shutdown Lifecycle (ARCH-01)", () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
  });

  it("performs normal graceful shutdown (closes HTTP server, closes DB, exits 0)", async () => {
    const mockServer = {
      close: jest.fn((cb) => cb(null)),
    };
    const mockConnection = {
      readyState: 1,
      close: jest.fn().mockResolvedValue(),
    };
    const mockExit = jest.fn();

    const shutdown = createShutdownHandler({
      server: mockServer,
      mongooseConnection: mockConnection,
      exitFn: mockExit,
      timeoutMs: 5000,
      logger: mockLogger,
    });

    await shutdown("SIGTERM");

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockConnection.close).toHaveBeenCalledWith(false);
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockLogger.log).toHaveBeenCalledWith("Graceful shutdown completed successfully.");

    // Verify uncaught exception produces unsuccessful exit status 1, never treated as successful (0)
    const errMockExit = jest.fn();
    const errShutdown = createShutdownHandler({
      server: mockServer,
      mongooseConnection: mockConnection,
      exitFn: errMockExit,
      timeoutMs: 5000,
      logger: mockLogger,
    });
    await errShutdown("uncaughtException", { exitCode: 1 });
    expect(errMockExit).toHaveBeenCalledWith(1);
  });

  it("ignores duplicate shutdown signals when already shutting down", async () => {
    const mockServer = {
      close: jest.fn((cb) => cb(null)),
    };
    const mockConnection = {
      readyState: 1,
      close: jest.fn().mockResolvedValue(),
    };
    const mockExit = jest.fn();

    const shutdown = createShutdownHandler({
      server: mockServer,
      mongooseConnection: mockConnection,
      exitFn: mockExit,
      timeoutMs: 5000,
      logger: mockLogger,
    });

    // Fire two shutdown signals concurrently
    const p1 = shutdown("SIGTERM");
    const p2 = shutdown("SIGINT");

    await Promise.all([p1, p2]);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockLogger.log).toHaveBeenCalledWith(
      "Shutdown already in progress. Ignoring duplicate SIGINT signal."
    );
  });

  it("exits with status 1 if HTTP server close fails", async () => {
    const mockServer = {
      close: jest.fn((cb) => cb(new Error("Socket error during close"))),
    };
    const mockConnection = {
      readyState: 1,
      close: jest.fn().mockResolvedValue(),
    };
    const mockExit = jest.fn();

    const shutdown = createShutdownHandler({
      server: mockServer,
      mongooseConnection: mockConnection,
      exitFn: mockExit,
      timeoutMs: 5000,
      logger: mockLogger,
    });

    await shutdown("SIGTERM");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error closing HTTP server:",
      "Socket error during close"
    );
  });

  it("exits with status 1 if MongoDB connection close fails", async () => {
    const mockServer = {
      close: jest.fn((cb) => cb(null)),
    };
    const mockConnection = {
      readyState: 1,
      close: jest.fn().mockRejectedValue(new Error("Connection pool lock error")),
    };
    const mockExit = jest.fn();

    const shutdown = createShutdownHandler({
      server: mockServer,
      mongooseConnection: mockConnection,
      exitFn: mockExit,
      timeoutMs: 5000,
      logger: mockLogger,
    });

    await shutdown("SIGTERM");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error occurred during graceful shutdown:",
      "Connection pool lock error"
    );
  });

  it("forces exit with code 1 if shutdown times out", async () => {
    jest.useFakeTimers();

    // Server close that hangs indefinitely
    const mockServer = {
      close: jest.fn(), // never calls callback
    };
    const mockConnection = {
      readyState: 1,
      close: jest.fn(),
    };
    const mockExit = jest.fn();

    const shutdown = createShutdownHandler({
      server: mockServer,
      mongooseConnection: mockConnection,
      exitFn: mockExit,
      timeoutMs: 2000,
      logger: mockLogger,
    });

    const shutdownPromise = shutdown("SIGTERM");

    // Advance fake timer beyond timeoutMs
    jest.advanceTimersByTime(2500);

    await Promise.resolve(); // flush microtasks

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Graceful shutdown timed out after 2000ms. Forcing process exit."
    );

    jest.useRealTimers();
  });
});

