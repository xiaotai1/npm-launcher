export function buildLaunchCommands(currentCommand: string, scripts: string[]): string[] {
  const commands = new Set<string>()

  if (currentCommand.trim()) {
    commands.add(currentCommand.trim())
  }

  for (const script of scripts) {
    const normalized = script.trim()
    if (normalized) commands.add(normalized)
  }

  return Array.from(commands)
}
