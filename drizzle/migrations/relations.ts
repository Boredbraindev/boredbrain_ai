import { relations } from "drizzle-orm/relations";
import { user, agent, apiKey, chat, customInstructions, extremeSearchUsage, lookout, message, messageUsage, account, referral, promptTemplate, session, promptPurchase, stream, toolUsage } from "./schema";

export const agentRelations = relations(agent, ({one, many}) => ({
	user: one(user, {
		fields: [agent.ownerId],
		references: [user.id]
	}),
	toolUsages: many(toolUsage),
}));

export const userRelations = relations(user, ({many}) => ({
	agents: many(agent),
	apiKeys: many(apiKey),
	chats: many(chat),
	customInstructions: many(customInstructions),
	extremeSearchUsages: many(extremeSearchUsage),
	lookouts: many(lookout),
	messageUsages: many(messageUsage),
	accounts: many(account),
	referrals_referrerId: many(referral, {
		relationName: "referral_referrerId_user_id"
	}),
	referrals_refereeId: many(referral, {
		relationName: "referral_refereeId_user_id"
	}),
	promptTemplates: many(promptTemplate),
	sessions: many(session),
	promptPurchases: many(promptPurchase),
}));

export const apiKeyRelations = relations(apiKey, ({one, many}) => ({
	user: one(user, {
		fields: [apiKey.userId],
		references: [user.id]
	}),
	toolUsages: many(toolUsage),
}));

export const chatRelations = relations(chat, ({one, many}) => ({
	user: one(user, {
		fields: [chat.userId],
		references: [user.id]
	}),
	messages: many(message),
	streams: many(stream),
}));

export const customInstructionsRelations = relations(customInstructions, ({one}) => ({
	user: one(user, {
		fields: [customInstructions.userId],
		references: [user.id]
	}),
}));

export const extremeSearchUsageRelations = relations(extremeSearchUsage, ({one}) => ({
	user: one(user, {
		fields: [extremeSearchUsage.userId],
		references: [user.id]
	}),
}));

export const lookoutRelations = relations(lookout, ({one}) => ({
	user: one(user, {
		fields: [lookout.userId],
		references: [user.id]
	}),
}));

export const messageRelations = relations(message, ({one}) => ({
	chat: one(chat, {
		fields: [message.chatId],
		references: [chat.id]
	}),
}));

export const messageUsageRelations = relations(messageUsage, ({one}) => ({
	user: one(user, {
		fields: [messageUsage.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const referralRelations = relations(referral, ({one}) => ({
	user_referrerId: one(user, {
		fields: [referral.referrerId],
		references: [user.id],
		relationName: "referral_referrerId_user_id"
	}),
	user_refereeId: one(user, {
		fields: [referral.refereeId],
		references: [user.id],
		relationName: "referral_refereeId_user_id"
	}),
}));

export const promptTemplateRelations = relations(promptTemplate, ({one, many}) => ({
	user: one(user, {
		fields: [promptTemplate.creatorId],
		references: [user.id]
	}),
	promptPurchases: many(promptPurchase),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const promptPurchaseRelations = relations(promptPurchase, ({one}) => ({
	promptTemplate: one(promptTemplate, {
		fields: [promptPurchase.promptId],
		references: [promptTemplate.id]
	}),
	user: one(user, {
		fields: [promptPurchase.buyerId],
		references: [user.id]
	}),
}));

export const streamRelations = relations(stream, ({one}) => ({
	chat: one(chat, {
		fields: [stream.chatId],
		references: [chat.id]
	}),
}));

export const toolUsageRelations = relations(toolUsage, ({one}) => ({
	apiKey: one(apiKey, {
		fields: [toolUsage.apiKeyId],
		references: [apiKey.id]
	}),
	agent: one(agent, {
		fields: [toolUsage.agentId],
		references: [agent.id]
	}),
}));