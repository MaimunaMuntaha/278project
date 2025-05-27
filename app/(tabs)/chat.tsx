import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, FlatList, View, Image, Pressable, ActivityIndicator, Animated } from 'react-native';
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
import { useAuth } from '../_layout';
import { db } from '../../firebase';

// Type definitions
type ChatParticipantStatus = 'conversation' | 'reachedOut' | 'none';
type ChatType = 'group' | 'request_dm';

import { ChatService, FirebaseChatMessage, FirebaseGroupChat, RequestDM } from '@/services/chatService';

export interface ChatItem {
  id: string;
  name: string;
  participants: string;
  avatar: any;
  newMessages: number;
  status: ChatParticipantStatus;
  type: ChatType;
  projectId: string;
  lastMessageTime?: Date;
  memberCount?: number;
  requestId?: string; // For request DMs
}

// Helper function to convert Firebase group chat to ChatItem
const convertFirebaseGroupChatToChatItem = (
  firebaseChat: FirebaseGroupChat, 
  currentUserId: string
): ChatItem => {
  const memberNames = Object.values(firebaseChat.members)
    .map(member => member.displayName)
    .join(', ');

  const currentUserMember = firebaseChat.members[currentUserId];
  let status: ChatParticipantStatus = 'none';
  if (currentUserMember) {
    status = 'conversation';
  }

  return {
    id: firebaseChat.id,
    name: firebaseChat.projectName,
    participants: memberNames,
    avatar: null,
    newMessages: 0, // Will be updated separately
    status,
    type: 'group',
    projectId: firebaseChat.id,
    lastMessageTime: firebaseChat.lastMessage?.timestamp.toDate() || firebaseChat.updatedAt.toDate(),
    memberCount: Object.keys(firebaseChat.members).length,
  };
};

// Helper function to convert RequestDM to ChatItem
const convertRequestDMToChatItem = (
  requestDM: RequestDM,
  currentUserId: string
): ChatItem => {
  // Get the other participant's name
  const otherParticipantId = requestDM.participants.find(id => id !== currentUserId);
  const otherParticipant = otherParticipantId ? requestDM.participantDetails[otherParticipantId] : null;
  const otherParticipantName = otherParticipant?.displayName || 'Unknown User';

  return {
    id: requestDM.id,
    name: `${otherParticipantName} (Request Chat)`,
    participants: `About: ${requestDM.projectContext.projectName}`,
    avatar: null,
    newMessages: 0, // Will be updated separately
    status: 'conversation',
    type: 'request_dm',
    projectId: requestDM.projectContext.projectId,
    lastMessageTime: requestDM.lastMessage?.timestamp.toDate() || requestDM.updatedAt.toDate(),
    requestId: requestDM.requestId,
  };
};

export default function ChatScreen(): JSX.Element {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showRequests, setShowRequests] = useState<boolean>(false);
  const [requests, setRequests] = useState<Record<string, RequestItem>>({});
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);
  const theme = useTheme();

  // Animation for the notification badge
  const badgeScale = useRef(new Animated.Value(1)).current;

  const { user: authUser } = useAuth();
  const currentUserId = authUser?.uid || '';

  const unsubscribeRefs = useRef<{
    groupChats?: () => void;
    requestDMs?: () => void;
    userRequests?: () => void;
    messageSubscriptions: Record<string, () => void>;
  }>({
    messageSubscriptions: {}
  });

  // Function to update unread count for a specific chat
  const updateChatUnreadCount = async (chatId: string, chatType: ChatType): Promise<void> => {
    if (!currentUserId) return;

    try {
      let unreadCount = 0;
      
      if (chatType === 'group') {
        // Get the current user's last read message ID from Firebase
        const chatDoc = await ChatService.getGroupChatById(chatId);
        if (chatDoc) {
          const currentUserMember = chatDoc.members[currentUserId];
          unreadCount = await ChatService.getUnreadMessageCount(
            chatId,
            currentUserId,
            currentUserMember?.lastReadMessageId
          );
        }
      } else if (chatType === 'request_dm') {
        // For request DMs, we'll implement a simple unread count based on recent messages
        // This is a simplified approach - you could enhance this with proper read tracking
        unreadCount = 0; // For now, keeping it simple
      }

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
  const subscribeToMessageUpdates = (chatItems: ChatItem[]) => {
    // Clean up existing subscriptions
    Object.values(unsubscribeRefs.current.messageSubscriptions).forEach(unsub => unsub());
    unsubscribeRefs.current.messageSubscriptions = {};

    // Subscribe to messages for each chat
    chatItems.forEach(chatItem => {
      if (chatItem.type === 'group') {
        const unsubscribe = ChatService.subscribeToGroupChatMessages(
          chatItem.id,
          async (messages: FirebaseChatMessage[]) => {
            // Only update unread count if this chat is not currently selected
            if (!selectedChat || selectedChat.id !== chatItem.id) {
              await updateChatUnreadCount(chatItem.id, 'group');
            }
          }
        );
        unsubscribeRefs.current.messageSubscriptions[chatItem.id] = unsubscribe;
      } else if (chatItem.type === 'request_dm') {
        const unsubscribe = ChatService.subscribeToRequestDMMessages(
          chatItem.id,
          async (messages) => {
            // Only update unread count if this chat is not currently selected
            if (!selectedChat || selectedChat.id !== chatItem.id) {
              await updateChatUnreadCount(chatItem.id, 'request_dm');
            }
          }
        );
        unsubscribeRefs.current.messageSubscriptions[chatItem.id] = unsubscribe;
      }
    });
  };

  // Load chats from Firebase
  useEffect(() => {
    const loadChats = async () => {
      if (!currentUserId) return;
      
      setLoading(true);
      
      // Set up real-time subscription for group chats
      const groupChatsUnsubscribe = ChatService.subscribeToUserGroupChats(
        currentUserId,
        async (firebaseChats: FirebaseGroupChat[]) => {
          const groupChatItems: ChatItem[] = [];
          
          // Convert Firebase group chats to ChatItems and get unread counts
          for (const firebaseChat of firebaseChats) {
            const chatItem = convertFirebaseGroupChatToChatItem(firebaseChat, currentUserId);
            
            // Get unread message count
            const currentUserMember = firebaseChat.members[currentUserId];
            const unreadCount = await ChatService.getUnreadMessageCount(
              firebaseChat.id,
              currentUserId,
              currentUserMember?.lastReadMessageId
            );
            
            chatItem.newMessages = unreadCount;
            groupChatItems.push(chatItem);
          }
          
          // Set up real-time subscription for request DMs
          const requestDMsUnsubscribe = ChatService.subscribeToUserRequestDMs(
            currentUserId,
            async (requestDMs: RequestDM[]) => {
              const requestDMItems: ChatItem[] = [];
              
              // Convert request DMs to ChatItems
              for (const requestDM of requestDMs) {
                const chatItem = convertRequestDMToChatItem(requestDM, currentUserId);
                // For simplicity, we'll set unread count to 0 for request DMs
                // You could implement proper unread tracking later
                chatItem.newMessages = 0;
                requestDMItems.push(chatItem);
              }
              
              // Combine group chats and request DMs
              const allChats = [...groupChatItems, ...requestDMItems];
              setChats(allChats);
              setLoading(false);

              // Subscribe to message updates for all chats
              subscribeToMessageUpdates(allChats);
            }
          );
          
          unsubscribeRefs.current.requestDMs = requestDMsUnsubscribe;
        }
      );

      unsubscribeRefs.current.groupChats = groupChatsUnsubscribe;
    };

    loadChats();

    // Cleanup subscriptions on unmount
    return () => {
      if (unsubscribeRefs.current.groupChats) {
        unsubscribeRefs.current.groupChats();
      }
      if (unsubscribeRefs.current.requestDMs) {
        unsubscribeRefs.current.requestDMs();
      }
      if (unsubscribeRefs.current.userRequests) {
        unsubscribeRefs.current.userRequests();
      }
      Object.values(unsubscribeRefs.current.messageSubscriptions).forEach(unsub => unsub());
    };
  }, [currentUserId]);

  // Subscribe to user requests to show notification badge
  useEffect(() => {
    if (!currentUserId) return;

    const requestsUnsubscribe = ChatService.subscribeToUserRequests(
      currentUserId,
      (userRequests) => {
        // Count pending requests
        const newPendingCount = userRequests.filter(req => req.status === 'pending').length;
        const previousCount = pendingRequestCount;
        
        setPendingRequestCount(newPendingCount);
        
        // Animate badge when count increases
        if (newPendingCount > previousCount && newPendingCount > 0) {
          Animated.sequence([
            Animated.timing(badgeScale, {
              toValue: 1.3,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(badgeScale, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
    );

    unsubscribeRefs.current.userRequests = requestsUnsubscribe;

    return () => {
      if (unsubscribeRefs.current.userRequests) {
        unsubscribeRefs.current.userRequests();
      }
    };
  }, [currentUserId, pendingRequestCount]);

  // Clean up message subscriptions when chat selection changes
  useEffect(() => {
    return () => {
      Object.values(unsubscribeRefs.current.messageSubscriptions).forEach(unsub => unsub());
    };
  }, [selectedChat]);

  // Function to mark messages as read and update local state
  const markChatAsRead = async (chatItem: ChatItem): Promise<void> => {
    if (!currentUserId) return;

    try {
      if (chatItem.type === 'group') {
        // Get the latest messages to find the last message ID
        const messages = await ChatService.getGroupChatMessages(chatItem.id, 1);
        if (messages.length > 0) {
          const lastMessageId = messages[messages.length - 1].id;
          
          // Mark messages as read in Firebase
          await ChatService.markMessagesAsRead(chatItem.id, currentUserId, lastMessageId);
        }
      } else if (chatItem.type === 'request_dm') {
        // For request DMs, we don't need to implement read tracking for now
        // This is a temporary chat that will be closed when the request is resolved
      }
      
      // Update local state to reflect zero unread messages
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatItem.id 
            ? { ...chat, newMessages: 0 }
            : chat
        )
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Modified function to handle chat selection
  const handleChatSelect = async (chat: ChatItem): Promise<void> => {
    setSelectedChat(chat);
    
    // Mark messages as read when opening any chat with unread messages
    if (chat.newMessages > 0) {
      await markChatAsRead(chat);
    }
  };

  // Handle back navigation
  const handleBack = (): void => {
    setSelectedChat(null);
    
    // When returning to chat list, refresh unread counts for all chats
    if (currentUserId && chats.length > 0) {
      chats.forEach(chat => {
        updateChatUnreadCount(chat.id, chat.type);
      });
    }
  };

  const handleBackFromRequests = (): void => {
    setShowRequests(false);
    // Don't clear the badge here - let it stay until requests are actually processed
  };

  const handleShowRequests = (): void => {
    setShowRequests(true);
    // Optionally, you could mark requests as "seen" here if you want the badge to disappear
    // For now, we'll keep the badge until requests are actually accepted/declined
  };

  // Function to handle project requests
  const handleAcceptRequest = async (request: RequestItem): Promise<void> => {
    // Store the request data for reference
    setRequests(prev => ({
      ...prev,
      [request.id]: request
    }));
    
    // Project join request - user should be added to group chat
    setShowRequests(false);
  };

  // Function to handle starting a DM from requests
  const handleStartDM = async (request: RequestItem): Promise<void> => {
    // Find the request DM that was just created
    setTimeout(async () => {
      try {
        const requestDM = await ChatService.getRequestDMByRequestId(request.id);
        if (requestDM) {
          const dmChatItem = convertRequestDMToChatItem(requestDM, currentUserId);
          
          // Add to chats if not already there
          setChats(prev => {
            const exists = prev.find(chat => chat.id === dmChatItem.id);
            if (!exists) {
              return [dmChatItem, ...prev];
            }
            return prev;
          });
          
          // Navigate to the DM
          setShowRequests(false);
          setSelectedChat(dmChatItem);
        }
      } catch (error) {
        console.error('Error finding created DM:', error);
      }
    }, 1000); // Give Firebase a moment to process
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
        onStartDM={handleStartDM}
        currentUserId={currentUserId}
      />
    );
  }

  // Function to update a chat with a new message
  const updateChatWithMessage = (chatId: string, messageText: string): void => {
    const updatedChats = chats.map(chat => {
      if (chat.id === chatId) {
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
              backgroundColor: item.type === 'request_dm' 
                ? '#FF9800' // Orange for request DMs
                : `hsl(${parseInt(item.id, 36) % 360}, 70%, 60%)` 
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
              {item.type === 'request_dm' && (
                <Chip 
                  icon="message-outline" 
                  style={[styles.chatTypeChip, { backgroundColor: '#FF9800' }]} 
                  textStyle={[styles.chatTypeText, { color: 'white' }]}
                >
                  TEMP
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
            {item.participants}
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
            No conversations yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            Join a project to get started
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
  requestsButtonContainer: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  smallBadge: {
    width: 16,
    height: 16,
    minWidth: 16,
    borderRadius: 8,
    top: -6,
    right: -6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 14,
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