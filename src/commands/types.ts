import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { DiscordJSManager } from "magmastream";

export type CommandContext = {
  interaction: ChatInputCommandInteraction;
  manager: DiscordJSManager;
};

export type CommandBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
  data: CommandBuilder | RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(ctx: CommandContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, manager: DiscordJSManager): Promise<void>;
}
