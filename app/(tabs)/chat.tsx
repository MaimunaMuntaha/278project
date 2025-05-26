import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, FlatList, View, Image, Pressable, ActivityIndicator } from 'react-native';
import {
  Button,
  Surface,
  Text,
  Avatar,
  Badge,
  Title,
  Divider,
  useTheme,
  Chip,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatDetail } from '@/components/chat/ChatDetail';
import { ProjectRequests, RequestItem } from '@/components/chat/ChatRequests';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../_layout'; // Import useAuth
import { db } from '../../firebase';

// Type definitions
type ChatParticipantStatus = 'conversation' | 'reachedOut' | 'none';
type ChatType = 'group' | 'direct';

import { ChatService, FirebaseChatMessage, FirebaseGroupChat } from '@/services/chatService';

export interface ChatItem {
  id: string;
  name: string;
  participants: string;
  avatar: any;
  newMessages: number;
  status: ChatParticipantStatus;
  type: ChatType;
  projectId?: string;
  lastMessageTime?: Date;
  requestId?: string;
  memberCount?: number;
}

// Helper function to convert Firebase chat to ChatItem
const convertFirebaseChatToChatItem = (
  firebaseChat: FirebaseGroupChat, 
  currentUserId: string
): ChatItem => {
  const memberNames = Object.values(firebaseChat.members)
    .map(member => member.displayName)
    .join(', ');

  // Calculate unread messages (you'll need to implement this based on your needs)
  const newMessages = 0; // This should be calculated based on lastReadMessageId vs actual messages

  // Determine status based on user's participation
  const currentUserMember = firebaseChat.members[currentUserId];
  let status: ChatParticipantStatus = 'none';
  if (currentUserMember) {
    status = 'conversation'; // User is already in the chat
  }

  return {
    id: firebaseChat.id,
    name: firebaseChat.projectName,
    participants: memberNames,
    avatar: null, // You can generate this or use a default
    newMessages,
    status,
    type: 'group',
    projectId: firebaseChat.id,
    lastMessageTime: firebaseChat.lastMessage?.timestamp.toDate() || firebaseChat.updatedAt.toDate(),
  };
};

// Replace your existing ChatScreen component with these updates

export default function ChatScreen(): JSX.Element {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showRequests, setShowRequests] = useState<boolean>(false);
  const [requests, setRequests] = useState<Record<string, RequestItem>>({});
  const theme = useTheme();

  const { user: authUser } = useAuth();
  const currentUserId = authUser?.uid || '';

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messageUnsubscribesRef = useRef<Record<string, () => void>>({});

  // Function to update unread count for a specific chat
  const updateChatUnreadCount = async (chatId: string): Promise<void> => {
    if (!currentUserId) return;

    try {
      // Find the chat in our current state
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;

      // Get the current user's last read message ID from Firebase
      const chatDoc = await ChatService.getGroupChatById(chatId);
      if (!chatDoc) return;

      const currentUserMember = chatDoc.members[currentUserId];
      const unreadCount = await ChatService.getUnreadMessageCount(
        chatId,
        currentUserId,
        currentUserMember?.lastReadMessageId
      );

      // Update the chat in our state
      setChats(prevChats => 
        prevChats.map(c => 
          c.id === chatId 
            ? { ...c, newMessages: unreadCount }
            : c
        )
      );
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  };

  // Subscribe to message updates for all chats to update unread counts
  const subscribeToMessageUpdates = (chatIds: string[]) => {
    // Clean up existing subscriptions
    Object.values(messageUnsubscribesRef.current).forEach(unsub => unsub());
    messageUnsubscribesRef.current = {};

    // Subscribe to messages for each chat
    chatIds.forEach(chatId => {
      const unsubscribe = ChatService.subscribeToGroupChatMessages(
        chatId,
        async (messages: FirebaseChatMessage[]) => {
          // Only update unread count if this chat is not currently selected
          if (!selectedChat || selectedChat.id !== chatId) {
            await updateChatUnreadCount(chatId);
          }
        }
      );
      
      messageUnsubscribesRef.current[chatId] = unsubscribe;
    });
  };

  // Load chats from Firebase
  useEffect(() => {
    const loadChats = async () => {
      setLoading(true);
      
      // Set up real-time subscription for chat metadata
      const unsubscribe = ChatService.subscribeToUserGroupChats(
        currentUserId,
        async (firebaseChats: FirebaseGroupChat[]) => {
          const chatItems: ChatItem[] = [];
          
          // Convert Firebase chats to ChatItems and get unread counts
          for (const firebaseChat of firebaseChats) {
            const chatItem = convertFirebaseChatToChatItem(firebaseChat, currentUserId);
            
            // Get unread message count
            const currentUserMember = firebaseChat.members[currentUserId];
            const unreadCount = await ChatService.getUnreadMessageCount(
              firebaseChat.id,
              currentUserId,
              currentUserMember?.lastReadMessageId
            );
            
            chatItem.newMessages = unreadCount;
            chatItem.memberCount = Object.keys(firebaseChat.members).length;
            chatItems.push(chatItem);
          }
          
          setChats(chatItems);
          setLoading(false);

          // Subscribe to message updates for all chats
          const chatIds = chatItems.map(chat => chat.id);
          subscribeToMessageUpdates(chatIds);
        }
      );

      unsubscribeRef.current = unsubscribe;
    };

    if (currentUserId) {
      loadChats();
    }

    // Cleanup subscriptions on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      Object.values(messageUnsubscribesRef.current).forEach(unsub => unsub());
    };
  }, [currentUserId]);

  // Clean up message subscriptions when chat selection changes
  useEffect(() => {
    return () => {
      Object.values(messageUnsubscribesRef.current).forEach(unsub => unsub());
    };
  }, [selectedChat]);

  // Function to mark messages as read and update local state
  const markChatAsRead = async (chatId: string): Promise<void> => {
    if (!currentUserId) return;

    try {
      // Get the latest messages to find the last message ID
      const messages = await ChatService.getGroupChatMessages(chatId, 1);
      if (messages.length > 0) {
        const lastMessageId = messages[messages.length - 1].id;
        
        // Mark messages as read in Firebase
        await ChatService.markMessagesAsRead(chatId, currentUserId, lastMessageId);
        
        // Update local state to reflect zero unread messages
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.id === chatId 
              ? { ...chat, newMessages: 0 }
              : chat
          )
        );
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Modified function to handle chat selection
  const handleChatSelect = async (chat: ChatItem): Promise<void> => {
    setSelectedChat(chat);
    
    // Mark messages as read when opening a group chat
    if (chat.type === 'group' && chat.newMessages > 0) {
      await markChatAsRead(chat.id);
    }
  };

  // Handle back navigation
  const handleBack = (): void => {
    setSelectedChat(null);
    
    // When returning to chat list, refresh unread counts for all chats
    if (currentUserId && chats.length > 0) {
      chats.forEach(chat => {
        if (chat.type === 'group') {
          updateChatUnreadCount(chat.id);
        }
      });
    }
  };

  const handleBackFromRequests = (): void => {
    setShowRequests(false);
  };

  // Function to handle project requests (accept or start DM)
  const handleAcceptRequest = (request: RequestItem): void => {
    // Store the request data for reference
    setRequests(prev => ({
      ...prev,
      [request.id]: request
    }));
    
    if (request.startDM) {
      // This is a request to start a DM
      const existingChat = chats.find(chat => chat.requestId === request.id);
      
      if (existingChat) {
        setShowRequests(false);
        setSelectedChat(existingChat);
      } else {
        // Create a new direct message chat
        const newDirectChat: ChatItem = {
          id: `dm-${Date.now()}`,
          name: request.name,
          participants: request.name,
          avatar: request.avatar,
          newMessages: 0,
          status: 'reachedOut',
          type: 'direct',
          projectId: request.project.toLowerCase().replace(/\s+/g, '-'),
          requestId: request.id,
          lastMessageTime: new Date(),
        };
  
        setChats([...chats, newDirectChat]);
        setShowRequests(false);
        setSelectedChat(newDirectChat);
      }
    } else {
      // This is an accept request
      const updatedChats = chats.filter(chat => chat.requestId !== request.id);
      setChats(updatedChats);
      setShowRequests(false);
    }
  };

  const isFocused = useIsFocused();
  const wasUnfocused = useRef(false);
  
  useEffect(() => {
    if (isFocused && wasUnfocused.current) {
      setShowRequests(false);
      setSelectedChat(null);
      wasUnfocused.current = false;
    }
    
    if (!isFocused) {
      wasUnfocused.current = true;
    }
  }, [isFocused]);

  // Don't render anything if user is not authenticated
  if (!authUser) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Text>Please log in to view chats.</Text>
      </ThemedView>
    );
  }

  if (showRequests) {
    return (
      <ProjectRequests 
        onBack={handleBackFromRequests}
        onAcceptRequest={handleAcceptRequest}
        currentUserId={currentUserId}
      />
    );
  }

  // Function to update a chat with a new message (for direct messages)
  const updateChatWithMessage = (chatId: string, messageText: string): void => {
    // Only update last message time for direct messages
    const updatedChats = chats.map(chat => {
      if (chat.id === chatId && chat.type === 'direct') {
        return {
          ...chat,
          lastMessageTime: new Date(),
        };
      }
      return chat;
    });
    
    const sortedChats = updatedChats.sort((a, b) => {
      const timeA = a.lastMessageTime ? a.lastMessageTime.getTime() : 0;
      const timeB = b.lastMessageTime ? b.lastMessageTime.getTime() : 0;
      return timeB - timeA;
    });
    
    setChats(sortedChats);
  };

  // Used as a callback from ChatDetail when a message is sent
  const handleMessageSent = (chatId: string, messageText: string): void => {
    updateChatWithMessage(chatId, messageText);
  };

  if (selectedChat) {
    return (
      <ChatDetail
        chat={selectedChat}
        onBack={handleBack}
        onMessageSent={handleMessageSent}
        requestData={selectedChat.requestId ? requests[selectedChat.requestId] : undefined}
      />
    );
  }

  // Get appropriate status color based on status
  const getStatusColor = (status: ChatParticipantStatus): string => {
    switch (status) {
      case 'conversation':
        return theme.colors.primary;
      case 'reachedOut':
        return '#ffcc00';
      default:
        return 'transparent';
    }
  };

  // Render each chat item
  const renderChatItem = ({ item }: { item: ChatItem }): JSX.Element => (
    <Pressable
      onPress={() => handleChatSelect(item)}
    >
      <Surface style={styles.chatItem} elevation={0}>
        <View style={styles.avatarContainer}>
          <Avatar.Text 
            size={50} 
            label={item.type === 'group' 
              ? item.name.split(' ').slice(0, 2).map(word => word[0]).join('')
              : item.name.split(' ').map(word => word[0]).join('').slice(0, 2)
            }
            color="#fff"
            style={{ 
              backgroundColor: `hsl(${parseInt(item.id, 36) % 360}, 70%, 60%)` 
            }}
          />
          {item.status !== 'none' && (
            <Badge
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) }
              ]}
              size={12}
            />
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <View style={styles.chatNameContainer}>
              <Text variant="titleMedium" style={styles.chatName}>{item.name}</Text>
              {item.type === 'direct' && (
                <Chip 
                  icon="account" 
                  style={styles.chatTypeChip} 
                  textStyle={styles.chatTypeText}
                >
                  DM
                </Chip>
              )}
            </View>
            {item.newMessages > 0 && (
              <Text variant="labelSmall" style={styles.messageCount}>
                {item.newMessages} new {item.newMessages === 1 ? 'message' : 'messages'}
              </Text>
            )}
          </View>
          <Text variant="bodySmall" style={styles.participants}>
            {item.type === 'direct' && item.projectId ? `Re: ${item.projectId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}` : item.participants}
          </Text>
        </View>
      </Surface>
    </Pressable>
  );
  
  // Sort chats by most recent message
  const sortedChats = [...chats].sort((a, b) => {
    const timeA = a.lastMessageTime ? a.lastMessageTime.getTime() : 0;
    const timeB = b.lastMessageTime ? b.lastMessageTime.getTime() : 0;
    return timeB - timeA;
  });

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Surface style={styles.header} elevation={1}>
        <Title style={styles.headerTitle}>Chat</Title>
        <Button mode="contained" onPress={() => setShowRequests(true)}>
          Requests
        </Button>
      </Surface>

      <Divider />

      {chats.length === 0 ? (
        <View style={[styles.container, styles.centered]}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No group chats yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            Join a project to start chatting with team members
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          ItemSeparatorComponent={() => <Divider />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  statusBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontWeight: 'bold',
    marginRight: 8,
  },
  chatNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTypeChip: {
    height: 28,
    padding: 0,
    marginLeft: 4,
  },
  chatTypeText: {
    fontSize: 14,
    lineHeight: 14,
    padding: 2,
  },
  messageCount: {
    color: '#888',
  },
  participants: {
    color: '#666',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#999',
  },
});