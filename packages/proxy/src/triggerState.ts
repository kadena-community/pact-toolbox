import { EventEmitter } from "events";

export type ChainId = number;
export type Confirmations = number;

/** Represents a timestamp in milliseconds. */
export type TimeSpec = number;

/**
 * Represents the demands for block confirmations on various chains.
 * @property chains - An array of chain IDs that require blocks.
 * @property confirmations - The number of confirmation blocks to mine for each chain listed.
 */
export interface ConfirmationDemands {
  chains: ChainId[];
  confirmations: Confirmations;
}

/** Internal state for the ConfirmationScheduler. */
interface SchedulerState {
  /** Maps ChainId to the number of pending confirmations required. */
  chainMap: Map<ChainId, Confirmations>;
  /** The timestamp (ms) when the next confirmation batch is scheduled to be processed. */
  scheduledTriggerTime: TimeSpec | null;
  /** True if a recently added transaction requires an additional block for flushing. */
  pendingFlush: boolean;
}

function createEmptySchedulerState(): SchedulerState {
  return {
    chainMap: new Map<ChainId, Confirmations>(),
    scheduledTriggerTime: null,
    pendingFlush: false,
  };
}

/**
 * Manages the scheduling of block confirmations based on incoming transactions.
 * It batches transaction confirmations and signals when new blocks are needed.
 */
export class ConfirmationScheduler extends EventEmitter {
  private state: SchedulerState;

  // For the signaling mechanism similar to MVar + timed wait
  private wakeSignalPromise: Promise<void> | null = null;
  private resolveWakeSignal: (() => void) | null = null;

  constructor() {
    super();
    this.state = createEmptySchedulerState();
  }

  /**
   * Registers a new transaction that requires confirmation blocks.
   *
   * @param batchPeriodMs - The time (in ms) to wait for potential batching before scheduling.
   * @param chainId - The ID of the chain where the transaction occurred.
   * @param pendingConfirmations - The number of confirmation blocks requested for this transaction.
   */
  public async pushTransaction(
    batchPeriodMs: number,
    chainId: ChainId,
    pendingConfirmations: Confirmations,
  ): Promise<void> {
    const latestScheduledTimeForThisTx = Date.now() + batchPeriodMs;

    const existingConfirmations = this.state.chainMap.get(chainId) || 0;
    // The original Haskell code adds 1 for a flush, so we replicate that behavior.
    // This means if 5 confirmations are requested, we aim for 6 operations in terms of map value reduction.
    const requiredConfirmationsInMap = pendingConfirmations + 1;
    this.state.chainMap.set(chainId, Math.max(existingConfirmations, requiredConfirmationsInMap));

    if (this.state.scheduledTriggerTime === null || latestScheduledTimeForThisTx < this.state.scheduledTriggerTime) {
      this.state.scheduledTriggerTime = latestScheduledTimeForThisTx;
    }
    this.state.pendingFlush = true;

    // Signal any waiting process that new data is available
    if (this.resolveWakeSignal) {
      this.resolveWakeSignal();
      // The promise and resolver are reset by the waiter
    }
    this.emit("stateChanged", this.state);
  }

  /**
   * Waits until the next batch of confirmations is due, either by timeout or by an explicit signal.
   * Then, calculates and returns the demands for blocks.
   *
   * @param defaultTriggerPeriodMs - The default period (in ms) to check for pending confirmations if no specific schedule.
   *                                 Also used as the basis for scheduling the next trigger after processing demands.
   * @returns A promise that resolves with the ConfirmationDemands.
   */
  public async waitNextDemands(defaultTriggerPeriodMs: number): Promise<ConfirmationDemands> {
    const waitForScheduledTime = async () => {
      const nextScheduled = this.state.scheduledTriggerTime;
      if (nextScheduled !== null) {
        const now = Date.now();
        const delay = Math.max(0, nextScheduled - now);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      // If no scheduled time, this promise resolves immediately, allowing race with signal.
    };

    const waitForSignal = (): Promise<void> => {
      if (!this.wakeSignalPromise) {
        this.wakeSignalPromise = new Promise<void>((resolve) => {
          this.resolveWakeSignal = () => {
            resolve();
            this.wakeSignalPromise = null; // Reset promise for next wait
            this.resolveWakeSignal = null; // Reset resolver
          };
        });
      }
      return this.wakeSignalPromise;
    };

    const wakeUpPromises: Promise<any>[] = [waitForSignal()];
    // Only wait for scheduled time if there's actually something scheduled.
    if (this.state.scheduledTriggerTime !== null) {
      wakeUpPromises.push(waitForScheduledTime());
    }

    await Promise.race(wakeUpPromises);

    // After waking up, process the current state to generate demands
    const now = Date.now();
    const demandsToProcess: ConfirmationDemands = {
      chains: [],
      confirmations: 0,
    };

    // Only generate demands if a trigger was scheduled or state implies it.
    // This check is crucial because a signal might arrive before a scheduledTriggerTime is set,
    // or if the state was cleared before the signal was processed.
    if (
      this.state.scheduledTriggerTime === null ||
      now >= this.state.scheduledTriggerTime ||
      this.state.chainMap.size > 0
    ) {
      const confirmationsDemandValue = this.state.pendingFlush ? 2 : 1;
      const newChainMap = new Map<ChainId, Confirmations>();
      const chainsForThisDemand: ChainId[] = [];

      this.state.chainMap.forEach((currentChainConfirmations, chainId) => {
        if (currentChainConfirmations > 0) {
          chainsForThisDemand.push(chainId);
          const remainingConfirmations = currentChainConfirmations - confirmationsDemandValue;
          if (remainingConfirmations > 0) {
            newChainMap.set(chainId, remainingConfirmations);
          }
        }
      });

      if (chainsForThisDemand.length > 0) {
        demandsToProcess.chains = chainsForThisDemand;
        demandsToProcess.confirmations = confirmationsDemandValue;
      }

      this.state.chainMap = newChainMap;
      this.state.pendingFlush = false;

      if (newChainMap.size > 0) {
        this.state.scheduledTriggerTime = now + defaultTriggerPeriodMs;
      } else {
        this.state.scheduledTriggerTime = null; // No more pending work, clear schedule
      }
    }
    // If state was empty and woke by signal, demands will be empty.

    this.emit("stateChanged", this.state);
    this.emit("demandsPopped", demandsToProcess);
    return demandsToProcess;
  }
}
