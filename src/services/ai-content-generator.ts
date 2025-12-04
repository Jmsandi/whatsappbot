import { GenelineClient } from '../geneline/client';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/supabase';
import { config } from '../config/env';

export interface GeneratedHealthTopic {
    title: string;
    category: string;
    short_message: string;
    detailed_info: string;
    prevention_tips: string[];
    icon_emoji: string;
    priority: number;
}

export class AIContentGenerator {
    private genelineClient: GenelineClient;

    constructor() {
        this.genelineClient = new GenelineClient();
    }

    /**
     * Generate a health awareness topic using AI
     */
    async generateHealthTopic(options?: {
        category?: string;
        avoidDuplicates?: boolean;
        seasonalFocus?: string;
    }): Promise<GeneratedHealthTopic | null> {
        try {
            logger.info('Generating health topic with AI', options);

            // Get existing topics to avoid duplicates
            const existingTopics = options?.avoidDuplicates
                ? await this.getExistingTopicTitles()
                : [];

            // Build generation prompt
            const prompt = this.buildGenerationPrompt(existingTopics, options);

            // Call Geneline-X AI
            const response = await this.genelineClient.sendMessage({
                chatbotId: config.geneline.chatbotId,
                email: 'ai-content-generator@geneline.local',
                message: prompt
            });

            // Parse AI response
            const generatedTopic = this.parseAIResponse(response);

            if (!generatedTopic) {
                logger.error('Failed to parse AI response for health topic');
                return null;
            }

            logger.info('Health topic generated successfully', {
                title: generatedTopic.title,
                category: generatedTopic.category
            });

            return generatedTopic;
        } catch (error) {
            logger.error('Error generating health topic', error as Error);
            return null;
        }
    }

    /**
     * Save generated topic to database
     */
    async saveGeneratedTopic(
        topic: GeneratedHealthTopic,
        autoPublish: boolean = false
    ): Promise<string | null> {
        try {
            const supabase = getSupabaseClient();

            const status = autoPublish ? 'published' : 'pending_review';

            const { data, error } = await supabase
                .from('health_topics')
                .insert({
                    ...topic,
                    status,
                    generated_by: 'ai',
                    is_active: autoPublish
                })
                .select('id')
                .single();

            if (error) {
                logger.error('Failed to save generated topic', error);
                return null;
            }

            logger.info('Generated topic saved', {
                topicId: data.id,
                status,
                autoPublish
            });

            return data.id;
        } catch (error) {
            logger.error('Error saving generated topic', error as Error);
            return null;
        }
    }

    /**
     * Get existing topic titles to avoid duplicates
     */
    private async getExistingTopicTitles(): Promise<string[]> {
        try {
            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('health_topics')
                .select('title')
                .neq('status', 'rejected');

            if (error) {
                logger.error('Failed to get existing topics', error);
                return [];
            }

            return data?.map(t => t.title) || [];
        } catch (error) {
            logger.error('Error getting existing topics', error as Error);
            return [];
        }
    }

    /**
     * Build AI generation prompt
     */
    private buildGenerationPrompt(
        existingTopics: string[],
        options?: {
            category?: string;
            seasonalFocus?: string;
        }
    ): string {
        const categoryHint = options?.category
            ? `Focus on the category: ${options.category}`
            : 'Choose an appropriate category from: hygiene, water_safety, vector_control, food_safety, sanitation, sexual_health, mental_health, immunization';

        const seasonalHint = options?.seasonalFocus
            ? `\nSeasonal focus: ${options.seasonalFocus}`
            : '';

        const duplicateHint = existingTopics.length > 0
            ? `\n\nAvoid duplicating these existing topics: ${existingTopics.join(', ')}`
            : '';

        return `You are a public health expert creating health awareness content for Sierra Leone.

Generate a comprehensive health awareness topic with the following structure:

1. **Title**: Short, clear topic name (e.g., "Handwashing", "Malaria Prevention")

2. **Category**: ${categoryHint}

3. **Short Message** (2-3 sentences):
   - Friendly and culturally appropriate for Sierra Leone
   - Clear call to action
   - Suitable for WhatsApp broadcast
   - Maximum 200 characters

4. **Detailed Information** (3-4 paragraphs):
   - Why this topic is important for public health
   - How it affects health in Sierra Leone specifically
   - Local context and relevance
   - Evidence-based information

5. **Prevention Tips** (exactly 4-6 actionable steps):
   - Specific, practical advice
   - Easy to follow and implement
   - Culturally appropriate for Sierra Leone
   - Each tip should be one clear sentence

6. **Icon Emoji**: One relevant emoji that represents the topic

7. **Priority** (1-10): How urgent/important is this topic (10 = highest priority)
${seasonalHint}${duplicateHint}

IMPORTANT: 
- Make content culturally sensitive and appropriate for Sierra Leone
- Use simple, clear language
- Focus on practical, actionable advice
- Ensure medical accuracy

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Topic Title",
  "category": "category_name",
  "short_message": "Brief message here...",
  "detailed_info": "Detailed information here...",
  "prevention_tips": ["Tip 1", "Tip 2", "Tip 3", "Tip 4"],
  "icon_emoji": "🏥",
  "priority": 5
}`;
    }

    /**
     * Parse AI response into structured topic
     */
    private parseAIResponse(response: string): GeneratedHealthTopic | null {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                logger.error('No JSON found in AI response');
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate required fields
            if (!parsed.title || !parsed.category || !parsed.short_message ||
                !parsed.detailed_info || !Array.isArray(parsed.prevention_tips)) {
                logger.error('Missing required fields in AI response');
                return null;
            }

            // Ensure prevention tips count
            if (parsed.prevention_tips.length < 4 || parsed.prevention_tips.length > 10) {
                logger.warn('Invalid prevention tips count, adjusting', {
                    count: parsed.prevention_tips.length
                });
                parsed.prevention_tips = parsed.prevention_tips.slice(0, 6);
            }

            return {
                title: parsed.title,
                category: parsed.category,
                short_message: parsed.short_message,
                detailed_info: parsed.detailed_info,
                prevention_tips: parsed.prevention_tips,
                icon_emoji: parsed.icon_emoji || '🏥',
                priority: parsed.priority || 3
            };
        } catch (error) {
            logger.error('Error parsing AI response', error as Error, { response });
            return null;
        }
    }

    /**
     * Check if auto-publish is enabled
     */
    async isAutoPublishEnabled(): Promise<boolean> {
        try {
            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'health_topics_auto_publish')
                .single();

            if (error || !data) {
                return false;
            }

            return data.setting_value?.enabled === true;
        } catch (error) {
            logger.error('Error checking auto-publish setting', error as Error);
            return false;
        }
    }

    /**
     * Generate and save topic (convenience method)
     */
    async generateAndSave(options?: {
        category?: string;
        seasonalFocus?: string;
    }): Promise<{ success: boolean; topicId?: string; topic?: GeneratedHealthTopic }> {
        try {
            // Generate topic
            const topic = await this.generateHealthTopic({
                ...options,
                avoidDuplicates: true
            });

            if (!topic) {
                return { success: false };
            }

            // Check auto-publish setting
            const autoPublish = await this.isAutoPublishEnabled();

            // Save to database
            const topicId = await this.saveGeneratedTopic(topic, autoPublish);

            if (!topicId) {
                return { success: false };
            }

            return {
                success: true,
                topicId,
                topic
            };
        } catch (error) {
            logger.error('Error in generateAndSave', error as Error);
            return { success: false };
        }
    }
}
