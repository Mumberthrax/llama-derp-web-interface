// Data-oriented prompt replacement logic for system prompts
// Usage: applyPromptReplacements(prompt, context)
// context: { userName: string, botName: string }

export function applyPromptReplacements(prompt, context) {
    let result = prompt;
    if (typeof result !== 'string') result = '';
    if (context) {
        if ('botName' in context) {
            result = result.replace(/{{char}}/g, context.botName || 'Assistant');
        }
        if ('userName' in context) {
            result = result.replace(/{{user}}/g, context.userName || 'User');
        }
    }
    return result;
}
