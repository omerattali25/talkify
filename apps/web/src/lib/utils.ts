import { type ClassValue, clsx } from "clsx"
import { twMerge as merge } from "tailwind-merge"
import type { Conversation } from '../types/api';

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function absoluteUrl(path: string) {
  return `${window.location.origin}${path}`
} 

/**
 * Validates if a conversation is accessible to a user
 * @param conversation The conversation to validate
 * @param currentUserId The ID of the current user
 * @returns boolean indicating if the conversation is valid and accessible
 */
export const isValidConversation = (conversation: Conversation, currentUserId: string | undefined): boolean => {
  // Basic validation
  if (!conversation || !conversation.participants || !currentUserId) {
    return false;
  }
  
  // Check if current user is a participant
  const currentUserParticipant = conversation.participants.find(p => p.user_id === currentUserId);
  if (!currentUserParticipant) {
    return false;
  }

  // For direct chats
  if (conversation.type === 'direct') {
    // Must have exactly 2 participants
    return conversation.participants.length === 2;
  }
  
  // For group chats
  // Just ensure all participants have user_ids
  return conversation.participants.every(p => p.user_id);
}; 