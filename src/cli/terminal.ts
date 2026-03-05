import { createInterface, Interface } from 'readline';
import chalk from 'chalk';
import { AIInterpreter, OfflineInterpreter } from '../ai/interpreter.js';
import { ToolEngine } from '../tools/engine.js';
import { ToolContext, ToolResult, FlashConfig, IFlashClient } from '../types/index.js';
import { SimulatedFlashClient } from '../client/simulation.js';
import { FStatsClient } from '../data/fstats.js';
import { banner, shortAddress } from '../utils/format.js';
import { getErrorMessage } from '../utils/retry.js';
import { initLogger } from '../utils/logger.js';

export class FlashTerminal {
  private config: FlashConfig;
  private interpreter: AIInterpreter | OfflineInterpreter;
  private engine!: ToolEngine;
  private context!: ToolContext;
  private rl!: Interface;
  private flashClient!: IFlashClient;
  private fstats: FStatsClient;

  constructor(config: FlashConfig) {
    this.config = config;
    this.fstats = new FStatsClient();

    // Initialize logger
    initLogger(config.logFile ? { logFile: config.logFile } : undefined);

    // Initialize interpreter
    if (config.anthropicApiKey && config.anthropicApiKey !== 'sk-ant-...') {
      this.interpreter = new AIInterpreter(config.anthropicApiKey);
    } else {
      this.interpreter = new OfflineInterpreter();
    }
  }

  async start(): Promise<void> {
    // Initialize client (simulation or real)
    if (this.config.simulationMode) {
      this.flashClient = new SimulatedFlashClient(10_000);
    } else {
      const { FlashClient } = await import('../client/flash-client.js');
      this.flashClient = new FlashClient(this.config);
    }

    // Build tool context
    this.context = {
      flashClient: this.flashClient,
      dataClient: this.fstats,
      simulationMode: this.config.simulationMode,
      walletAddress: this.flashClient.walletAddress ?? 'unknown',
    };

    this.engine = new ToolEngine(this.context);

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Print banner
    console.log(banner());

    const modeTag = this.config.simulationMode
      ? chalk.bgYellow.black(' SIMULATION ')
      : chalk.bgGreen.black(' LIVE ');

    console.log(`  ${modeTag} ${chalk.dim('Pool:')} ${chalk.bold(this.config.defaultPool)}`);
    console.log(`  Wallet: ${chalk.cyan(shortAddress(this.context.walletAddress))}`);

    if (this.config.simulationMode) {
      console.log(`  Balance: ${chalk.green('$' + this.flashClient.getBalance().toFixed(2))}`);
    }

    console.log(chalk.dim('\n  Type "help" for commands, "exit" to quit.\n'));

    // Start the prompt loop
    this.promptLoop();
  }

  private promptLoop(): void {
    const prefix = this.config.simulationMode
      ? chalk.yellow('flash [sim]')
      : chalk.green('flash');

    this.rl.question(`${prefix} > `, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        this.promptLoop();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(chalk.dim('\n  Goodbye.\n'));
        this.rl.close();
        process.exit(0);
      }

      await this.handleInput(trimmed);
      this.promptLoop();
    });
  }

  private async handleInput(input: string): Promise<void> {
    // Parse intent
    process.stdout.write(chalk.dim('  Parsing...\r'));

    let intent;
    try {
      intent = await this.interpreter.parseIntent(input);
      process.stdout.write('              \r');
    } catch (error: unknown) {
      console.log(chalk.red(`  Parse error: ${getErrorMessage(error)}`));
      return;
    }

    // Execute tool
    process.stdout.write(chalk.dim('  Executing...\r'));

    let result: ToolResult;
    try {
      result = await this.engine.dispatch(intent);
      process.stdout.write('               \r');
    } catch (error: unknown) {
      console.log(chalk.red(`  Execution error: ${getErrorMessage(error)}`));
      return;
    }

    // Display result
    console.log(result.message);

    // Handle confirmation flow
    if (result.requiresConfirmation && result.data?.executeAction) {
      const confirmed = await this.confirm(result.confirmationPrompt ?? 'Confirm?');
      if (confirmed) {
        process.stdout.write(chalk.dim('  Submitting...\r'));

        try {
          const execResult = await result.data.executeAction();
          process.stdout.write('                \r');
          console.log(execResult.message);
        } catch (error: unknown) {
          console.log(chalk.red(`  Transaction failed: ${getErrorMessage(error)}`));
        }
      } else {
        console.log(chalk.dim('  Cancelled.'));
      }
    }
  }

  private confirm(prompt: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(
        `  ${chalk.yellow(prompt)} ${chalk.dim('(yes/no)')} `,
        (answer) => {
          resolve(
            answer.toLowerCase() === 'yes' ||
            answer.toLowerCase() === 'y'
          );
        }
      );
    });
  }
}
