import { supabase } from '@/lib/supabase';

export type ChatContact = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type ProfileRow = {
  id: string;
  nickname: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function toDirectMessage(row: MessageRow): DirectMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function getMessagingSnapshot(userId: string): Promise<ChatContact[]> {
  const [profilesResult, messagesResult] = await Promise.all([
    supabase.from('profiles').select('id, nickname').neq('id', userId).order('nickname'),
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at, read_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }
  if (messagesResult.error) {
    throw messagesResult.error;
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const messages = (messagesResult.data ?? []) as MessageRow[];
  const latestByContact = new Map<string, ChatContact>();

  for (const row of messages) {
    const contactId = row.sender_id === userId ? row.recipient_id : row.sender_id;
    const current = latestByContact.get(contactId);
    if (!current) {
      latestByContact.set(contactId, {
        id: contactId,
        name: '',
        lastMessage: row.body,
        lastMessageAt: row.created_at,
        unreadCount: 0,
      });
    }

    if (row.recipient_id === userId && !row.read_at) {
      const contact = latestByContact.get(contactId);
      if (contact) {
        contact.unreadCount += 1;
      }
    }
  }

  const contacts = profiles.map((profile) => ({
    id: profile.id,
    name: profile.nickname,
    lastMessage: latestByContact.get(profile.id)?.lastMessage ?? '',
    lastMessageAt: latestByContact.get(profile.id)?.lastMessageAt ?? null,
    unreadCount: latestByContact.get(profile.id)?.unreadCount ?? 0,
  }));

  return contacts.sort((left, right) => {
    if (left.lastMessageAt && right.lastMessageAt) {
      return right.lastMessageAt.localeCompare(left.lastMessageAt);
    }
    if (left.lastMessageAt) {
      return -1;
    }
    if (right.lastMessageAt) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function getDirectMessages(
  userId: string,
  contactId: string
): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    throw error;
  }

  return ((data ?? []) as MessageRow[]).map(toDirectMessage);
}

export async function sendDirectMessage(
  senderId: string,
  recipientId: string,
  body: string
): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      body: body.trim(),
    })
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .single();

  if (error) {
    throw error;
  }

  return toDirectMessage(data as MessageRow);
}

export async function markDirectMessagesRead(userId: string, senderId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', senderId)
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}

export function subscribeToMessages(onChange: () => void) {
  return supabase
    .channel(`direct-messages:${Date.now()}:${Math.random()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      onChange
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Direct message realtime subscription failed:', error ?? status);
      }
    });
}
