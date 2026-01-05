/**
 * Tag Categorization Service
 * 
 * Keyword-based auto-categorization system that analyzes bookmark content
 * and suggests appropriate tags with confidence scores.
 */

export interface TagMatch {
  tagName: string;
  tagSlug: string;
  confidence: number;
  matchedKeywords: string[];
}

export interface TagDefinition {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  keywords: string[];
}

/**
 * Default tag definitions with associated keywords
 */
export const DEFAULT_TAG_DEFINITIONS: TagDefinition[] = [
  {
    name: 'health',
    slug: 'health',
    description: 'Health and wellness topics',
    color: '#EF4444',
    keywords: [
      'health', 'wellness', 'wellbeing', 'medical', 'medicine', 'disease', 'illness',
      'treatment', 'cure', 'symptom', 'diagnosis', 'doctor', 'physician', 'hospital',
      'clinic', 'patient', 'healthcare', 'therapy', 'therapeutic', 'healing', 'heal'
    ],
  },
  {
    name: 'fitness',
    slug: 'fitness',
    description: 'Exercise and physical fitness',
    color: '#10B981',
    keywords: [
      'fitness', 'exercise', 'workout', 'gym', 'training', 'cardio', 'cardiorespiratory',
      'strength', 'weight', 'lifting', 'muscle', 'muscular', 'endurance', 'stamina',
      'yoga', 'pilates', 'running', 'jogging', 'cycling', 'swimming', 'sport', 'athletic',
      'athlete', 'physical', 'bodybuilding', 'crossfit', 'calisthenics'
    ],
  },
  {
    name: 'nutrition',
    slug: 'nutrition',
    description: 'Food, diet, and nutrition',
    color: '#F59E0B',
    keywords: [
      'nutrition', 'food', 'diet', 'dietary', 'meal', 'meals', 'eating', 'recipe', 'recipes',
      'cooking', 'cuisine', 'ingredient', 'ingredients', 'calorie', 'calories', 'protein',
      'carbohydrate', 'carb', 'fat', 'fiber', 'vitamin', 'mineral', 'supplement',
      'healthy eating', 'meal plan', 'nutritional', 'nutrient', 'macros', 'keto',
      'paleo', 'vegan', 'vegetarian', 'organic'
    ],
  },
  {
    name: 'coding',
    slug: 'coding',
    description: 'General programming and coding',
    color: '#3B82F6',
    keywords: [
      'code', 'coding', 'programming', 'program', 'developer', 'development', 'software',
      'software engineering', 'function', 'variable', 'syntax', 'compiler', 'interpreter',
      'debug', 'debugging', 'bug', 'bugfix', 'codebase', 'repository', 'repo', 'git',
      'version control', 'commit', 'branch', 'merge', 'pull request', 'pr'
    ],
  },
  {
    name: 'programming',
    slug: 'programming',
    description: 'Programming languages and frameworks',
    color: '#6366F1',
    keywords: [
      'python', 'javascript', 'typescript', 'java', 'c++', 'cpp', 'c#', 'csharp',
      'react', 'vue', 'angular', 'node', 'nodejs', 'express', 'django', 'flask',
      'algorithm', 'data structure', 'api', 'rest', 'graphql', 'sql', 'database',
      'frontend', 'backend', 'fullstack', 'full stack', 'web development', 'mobile',
      'ios', 'android', 'swift', 'kotlin', 'rust', 'go', 'golang', 'php', 'ruby',
      'rails', 'laravel', 'spring', 'framework', 'library', 'package', 'npm', 'yarn'
    ],
  },
  {
    name: 'ai/ml',
    slug: 'ai-ml',
    description: 'Artificial Intelligence and Machine Learning',
    color: '#8B5CF6',
    keywords: [
      'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
      'neural network', 'neural', 'llm', 'large language model', 'chatgpt', 'gpt',
      'openai', 'anthropic', 'claude', 'transformer', 'nlp', 'natural language',
      'computer vision', 'reinforcement learning', 'supervised', 'unsupervised',
      'tensorflow', 'pytorch', 'keras', 'model', 'training', 'inference', 'prediction',
      'algorithm', 'data science', 'datascience', 'automation', 'robotic', 'robot'
    ],
  },
  {
    name: 'business',
    slug: 'business',
    description: 'Business and entrepreneurship',
    color: '#EC4899',
    keywords: [
      'business', 'startup', 'start-up', 'entrepreneur', 'entrepreneurship', 'revenue',
      'profit', 'market', 'marketing', 'sales', 'strategy', 'business model', 'customer',
      'client', 'product', 'service', 'company', 'corporation', 'corp', 'inc', 'llc',
      'venture capital', 'vc', 'investment', 'investor', 'funding', 'fundraise',
      'brand', 'branding', 'growth', 'scale', 'scaling', 'team', 'leadership', 'management'
    ],
  },
  {
    name: 'design',
    slug: 'design',
    description: 'Design and user experience',
    color: '#F97316',
    keywords: [
      'design', 'designer', 'ui', 'user interface', 'ux', 'user experience',
      'interface', 'visual', 'aesthetic', 'aesthetics', 'layout', 'typography',
      'graphic design', 'web design', 'mobile design', 'responsive', 'wireframe',
      'prototype', 'prototyping', 'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
      'color', 'palette', 'icon', 'iconography', 'illustration', 'illustrator',
      'usability', 'accessibility', 'a11y', 'interaction', 'interactive'
    ],
  },
  {
    name: 'productivity',
    slug: 'productivity',
    description: 'Productivity and efficiency tools',
    color: '#06B6D4',
    keywords: [
      'productivity', 'efficient', 'efficiency', 'optimize', 'optimization', 'workflow',
      'tool', 'tools', 'automation', 'automate', 'task', 'tasks', 'project management',
      'pomodoro', 'time management', 'organize', 'organization', 'system', 'process',
      'methodology', 'framework', 'hack', 'tip', 'tips', 'technique', 'best practice',
      'gtd', 'getting things done', 'kanban', 'agile', 'scrum', 'sprint'
    ],
  },
  {
    name: 'science',
    slug: 'science',
    description: 'Scientific research and studies',
    color: '#14B8A6',
    keywords: [
      'science', 'scientific', 'research', 'study', 'studies', 'experiment', 'experimental',
      'hypothesis', 'thesis', 'theory', 'data', 'dataset', 'analysis', 'analytical',
      'peer review', 'published', 'publication', 'journal', 'paper', 'academic',
      'university', 'professor', 'researcher', 'scientist', 'laboratory', 'lab',
      'evidence', 'evidence-based', 'statistics', 'statistical', 'methodology'
    ],
  },
  {
    name: 'tech',
    slug: 'tech',
    description: 'Technology and innovation',
    color: '#6366F1',
    keywords: [
      'technology', 'tech', 'innovation', 'innovative', 'device', 'devices', 'gadget',
      'hardware', 'software', 'application', 'app', 'platform', 'system', 'service',
      'digital', 'electronic', 'electronics', 'computer', 'laptop', 'smartphone',
      'mobile', 'tablet', 'internet', 'web', 'cloud', 'server', 'infrastructure',
      'security', 'cybersecurity', 'privacy', 'data', 'information'
    ],
  },
  {
    name: 'finance',
    slug: 'finance',
    description: 'Finance and investing',
    color: '#22C55E',
    keywords: [
      'finance', 'financial', 'money', 'monetary', 'investment', 'investing', 'invest',
      'investor', 'stock', 'stocks', 'equity', 'equities', 'trading', 'trade', 'trader',
      'market', 'stock market', 'crypto', 'cryptocurrency', 'bitcoin', 'ethereum',
      'budget', 'budgeting', 'saving', 'savings', 'retirement', 'retire', 'portfolio',
      'asset', 'assets', 'liability', 'liabilities', 'wealth', 'income', 'expense',
      'tax', 'taxation', 'accounting', 'accountant', 'bank', 'banking', 'loan', 'credit'
    ],
  },
];

/**
 * Minimum confidence threshold for auto-tagging (0-1)
 */
const MIN_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Normalize text for keyword matching (lowercase, trim)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Extract words from text for matching
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/) // Split on whitespace
    .filter(word => word.length > 2); // Filter out very short words
}

/**
 * Calculate confidence score based on keyword matches
 */
function calculateConfidence(
  matchedKeywords: string[],
  totalKeywords: number,
  contentLength: number
): number {
  if (matchedKeywords.length === 0) {
    return 0;
  }

  // Base score from keyword match ratio
  const keywordRatio = matchedKeywords.length / totalKeywords;

  // Boost for multiple matches
  const matchBoost = Math.min(matchedKeywords.length * 0.1, 0.3);

  // Normalize by content length (longer content needs more matches)
  const lengthNormalizer = Math.min(contentLength / 500, 1);

  // Combine factors
  let confidence = keywordRatio * 0.7 + matchBoost * 0.3;
  confidence = confidence * (0.5 + lengthNormalizer * 0.5);

  // Ensure confidence is between 0 and 1
  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Find matching tags based on content analysis
 */
export function findTagsByKeywords(
  content: string | null | undefined
): TagMatch[] {
  const combinedText = content || '';

  if (!combinedText || combinedText.trim().length === 0) {
    return [];
  }

  const normalizedContent = normalizeText(combinedText);
  const words = extractWords(combinedText);
  const matches: TagMatch[] = [];

  for (const tagDef of DEFAULT_TAG_DEFINITIONS) {
    const matchedKeywords: string[] = [];

    for (const keyword of tagDef.keywords) {
      const normalizedKeyword = normalizeText(keyword);

      // Check for exact match in normalized content
      if (normalizedContent.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
      } else {
        // Check for word boundary matches
        const keywordWords = extractWords(keyword);
        if (keywordWords.length > 0) {
          // Check if all keyword words appear (for multi-word keywords)
          const allWordsMatch = keywordWords.every(kw => words.includes(kw));
          if (allWordsMatch) {
            matchedKeywords.push(keyword);
          }
        }
      }
    }

    if (matchedKeywords.length > 0) {
      const confidence = calculateConfidence(
        matchedKeywords,
        tagDef.keywords.length,
        combinedText.length
      );

      if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
        matches.push({
          tagName: tagDef.name,
          tagSlug: tagDef.slug,
          confidence,
          matchedKeywords: [...new Set(matchedKeywords)], // Remove duplicates
        });
      }
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

/**
 * Get tag definition by slug
 */
export function getTagDefinitionBySlug(slug: string): TagDefinition | undefined {
  return DEFAULT_TAG_DEFINITIONS.find(tag => tag.slug === slug);
}

/**
 * Get tag definition by name
 */
export function getTagDefinitionByName(name: string): TagDefinition | undefined {
  return DEFAULT_TAG_DEFINITIONS.find(tag => tag.name === name);
}

/**
 * Get all tag definitions
 */
export function getAllTagDefinitions(): TagDefinition[] {
  return [...DEFAULT_TAG_DEFINITIONS];
}

