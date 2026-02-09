/**
 * Tag Definitions Service
 *
 * Default tag definitions for the system.
 */

export interface TagDefinition {
  name: string;
  slug: string;
  description?: string;
  color?: string;
}

/**
 * Default tag definitions
 */
export const DEFAULT_TAG_DEFINITIONS: TagDefinition[] = [
  {
    name: 'health',
    slug: 'health',
    description: 'Health and wellness topics',
    color: '#EF4444',
  },
  {
    name: 'fitness',
    slug: 'fitness',
    description: 'Exercise and physical fitness',
    color: '#10B981',
  },
  {
    name: 'nutrition',
    slug: 'nutrition',
    description: 'Food, diet, and nutrition',
    color: '#F59E0B',
  },
  {
    name: 'coding',
    slug: 'coding',
    description: 'General programming and coding',
    color: '#3B82F6',
  },
  {
    name: 'programming',
    slug: 'programming',
    description: 'Programming languages and frameworks',
    color: '#6366F1',
  },
  {
    name: 'ai/ml',
    slug: 'ai-ml',
    description: 'Artificial Intelligence and Machine Learning',
    color: '#8B5CF6',
  },
  {
    name: 'business',
    slug: 'business',
    description: 'Business and entrepreneurship',
    color: '#EC4899',
  },
  {
    name: 'design',
    slug: 'design',
    description: 'Design and user experience',
    color: '#F97316',
  },
  {
    name: 'productivity',
    slug: 'productivity',
    description: 'Productivity and efficiency tools',
    color: '#06B6D4',
  },
  {
    name: 'science',
    slug: 'science',
    description: 'Scientific research and studies',
    color: '#14B8A6',
  },
  {
    name: 'tech',
    slug: 'tech',
    description: 'Technology and innovation',
    color: '#6366F1',
  },
  {
    name: 'finance',
    slug: 'finance',
    description: 'Finance and investing',
    color: '#22C55E',
  },
];

/**
 * Get all default tag definitions
 */
export function getAllDefaultTagDefinitions(): TagDefinition[] {
  return [...DEFAULT_TAG_DEFINITIONS];
}
