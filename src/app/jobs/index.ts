import { startQueueWorkers } from "../lib/queue";
import "./accountEmail";
import "./email";
import "./examRoutine";
import "./routine";

// F6/F9 register their processors before bootstrap; tests run handlers inline.
export const startWorkers = () => startQueueWorkers();
