/**
 * LLM provider abstraction. Swap models via env vars:
 *
 *   COMPOSE_MODEL=openai:gpt-5.3-chat-latest   (or anthropic:claude-haiku-4-5-20251001)
 *   CHAT_MODEL=anthropic:claude-haiku-4-5-20251001
 *   CONTENT_MODEL=anthropic:claude-haiku-4-5-20251001
 *
 * Format: "provider:model-id"
 * Defaults to Anthropic Haiku if not set.
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

type Message = { role: 'user' | 'assistant'; content: string }

type CompletionParams = {
  model?: string
  system?: string
  messages: Message[]
  maxTokens?: number
}

type CompletionResult = {
  text: string
}

function parseModelSpec(spec: string): { provider: 'anthropic' | 'openai'; model: string } {
  const [provider, ...rest] = spec.split(':')
  const model = rest.join(':')
  if (provider === 'openai' && model) return { provider: 'openai', model }
  if (provider === 'anthropic' && model) return { provider: 'anthropic', model }
  // If no provider prefix, assume anthropic
  return { provider: 'anthropic', model: spec }
}

let anthropicClient: Anthropic | null = null
function getAnthropicClient() {
  if (!anthropicClient) anthropicClient = new Anthropic()
  return anthropicClient
}

let openaiClient: OpenAI | null = null
function getOpenAIClient() {
  if (!openaiClient) openaiClient = new OpenAI()
  return openaiClient
}

async function callAnthropic(model: string, params: CompletionParams): Promise<CompletionResult> {
  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: params.maxTokens ?? 4096,
    ...(params.system ? { system: params.system } : {}),
    messages: params.messages,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return { text }
}

async function callOpenAI(model: string, params: CompletionParams): Promise<CompletionResult> {
  const messages: OpenAI.ChatCompletionMessageParam[] = []

  if (params.system) {
    messages.push({ role: 'system', content: params.system })
  }

  for (const msg of params.messages) {
    messages.push({ role: msg.role, content: msg.content })
  }

  const response = await getOpenAIClient().chat.completions.create({
    model,
    max_completion_tokens: params.maxTokens ?? 4096,
    messages,
  })

  const text = response.choices[0]?.message?.content ?? ''
  return { text }
}

export async function complete(purpose: 'compose' | 'chat' | 'content', params: CompletionParams): Promise<CompletionResult> {
  const envKey = `${purpose.toUpperCase()}_MODEL`
  // Sonnet for compose + content (creative quality matters), Haiku for chat (speed matters)
  const defaultModel = purpose === 'chat'
    ? 'anthropic:claude-haiku-4-5-20251001'
    : 'anthropic:claude-sonnet-4-6'
  const spec = process.env[envKey] ?? defaultModel
  const { provider, model } = parseModelSpec(spec)

  if (provider === 'openai') {
    return callOpenAI(model, params)
  }
  return callAnthropic(model, params)
}
