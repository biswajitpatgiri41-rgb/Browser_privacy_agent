/**
 * Task State - manages the current task execution state.
 */

import { TaskStatus } from "../types/agent";

interface TaskStateData {
  task: string;
  status: TaskStatus;
  startedAt: number;
  completedAt?: number;
  maxSteps: number;
  currentStep: number;
  error?: string;
}

export class TaskState {
  private state: TaskStateData | null = null;

  initialize(task: string, maxSteps: number): void {
    this.state = {
      task,
      status: "running",
      startedAt: Date.now(),
      maxSteps,
      currentStep: 0,
    };
  }

  incrementStep(): void {
    if (this.state) {
      this.state.currentStep++;
    }
  }

  complete(): void {
    if (this.state) {
      this.state.status = "completed";
      this.state.completedAt = Date.now();
    }
  }

  fail(error: string): void {
    if (this.state) {
      this.state.status = "failed";
      this.state.completedAt = Date.now();
      this.state.error = error;
    }
  }

  getState(): TaskStateData | null {
    return this.state;
  }

  isRunning(): boolean {
    return this.state?.status === "running";
  }

  getProgress(): number {
    if (!this.state) return 0;
    return Math.min(this.state.currentStep / this.state.maxSteps, 1);
  }

  reset(): void {
    this.state = null;
  }
}
