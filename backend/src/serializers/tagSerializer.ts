import { Tag } from '@prisma/client';
import { TagWithCount } from '../services/tagService';

export function serializeTag(tag: Tag): {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    description: tag.description,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

export function serializeTagWithCount(tag: TagWithCount): ReturnType<typeof serializeTag> & {
  bookmarkCount: number;
} {
  return {
    ...serializeTag(tag),
    bookmarkCount: tag.bookmarkCount,
  };
}
