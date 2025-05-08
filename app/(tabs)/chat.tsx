import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, FlatList, View, Image, Pressable } from 'react-native';
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

// Type definitions
type ChatParticipantStatus = 'conversation' | 'reachedOut' | 'none';
type ChatType = 'group' | 'direct'; // Added chat type

export interface ChatItem {
  id: string;
  name: string;
  participants: string;
  avatar: any; // For image require
  newMessages: number;
  status: ChatParticipantStatus;
  type: ChatType; // Added chat type field
  projectId?: string; // Optional field to link direct messages to their project
  lastMessageTime?: Date; // For sorting chats by most recent message
  requestId?: string; // For linking back to a request
}

// Mock chat data
const chatData: ChatItem[] = [
  {
    id: '1',
    name: 'Dolphin Robot',
    participants: 'Chris Hoch, Jerry Cain',
    avatar: require('@/assets/images/1.png'), // Make sure to create these assets
    newMessages: 3,
    status: 'conversation',
    type: 'group',
    lastMessageTime: new Date(2025, 4, 7, 14, 30), // Yesterday at 2:30 PM
  },
  {
    id: '2',
    name: 'Spider Robot',
    participants: 'Chris Hoch',
    avatar: require('@/assets/images/1.png'),
    newMessages: 1,
    status: 'conversation',
    type: 'group',
    lastMessageTime: new Date(2025, 4, 7, 9, 15), // Yesterday at 9:15 AM
  },
  {
    id: '3',
    name: 'Collaborative Essay',
    participants: 'FamousWriter123',
    avatar: require('@/assets/images/1.png'),
    newMessages: 0,
    status: 'reachedOut',
    type: 'group',
    lastMessageTime: new Date(2025, 4, 6, 16, 45), // Two days ago
  },
  // Example of a direct message for a request discussion
  {
    id: '4',
    name: 'Sam A.',
    participants: 'Sam A.',
    avatar: require('@/assets/images/1.png'),
    newMessages: 2,
    status: 'conversation',
    type: 'direct',
    projectId: 'essay-writing-project',
    requestId: '1', // Link to the original request
    lastMessageTime: new Date(2025, 4, 8, 10, 5), // Today at 10:05 AM
  },
];

export default function ChatScreen(): JSX.Element {
  const [chats, setChats] = useState<ChatItem[]>(chatData);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showRequests, setShowRequests] = useState<boolean>(false);
  const [requests, setRequests] = useState<Record<string, RequestItem>>({});
  const theme = useTheme();

  // Handle back navigation
  const handleBack = (): void => {
    setSelectedChat(null);
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
      // Check if a DM already exists for this request
      const existingChat = chats.find(chat => chat.requestId === request.id);
      
      if (existingChat) {
        // If DM already exists, just open it
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
          status: 'conversation',
          type: 'direct',
          projectId: request.project.toLowerCase().replace(/\s+/g, '-'),
          requestId: request.id,
          lastMessageTime: new Date(), // Current time
        };
  
        // Add the new chat to the list
        setChats([...chats, newDirectChat]);
        
        // Close the requests screen and open the new chat
        setShowRequests(false);
        setSelectedChat(newDirectChat);
      }
    } else {
      // This is an accept request - implement the logic to accept the project request
      // (You might want to add code here to add the user to the project)
      
      // Remove any existing DM for this request
      const updatedChats = chats.filter(chat => chat.requestId !== request.id);
      setChats(updatedChats);
      
      // Close the requests screen
      setShowRequests(false);
    }
  };

  const isFocused = useIsFocused();
  const wasUnfocused = useRef(false);
  
  useEffect(() => {
    // We only want to reset if:
    // 1. The screen is currently focused AND
    // 2. It was previously unfocused (coming from another tab)
    if (isFocused && wasUnfocused.current) {
      setShowRequests(false);
      setSelectedChat(null);
      wasUnfocused.current = false;
    }
    
    // Update the ref when we lose focus
    if (!isFocused) {
      wasUnfocused.current = true;
    }
  }, [isFocused]);

  if (showRequests) {
    return (
      <ProjectRequests 
        onBack={handleBackFromRequests}
        onAcceptRequest={handleAcceptRequest}
      />
    );
  }

  // Function to update a chat with a new message
  const updateChatWithMessage = (chatId: string, messageText: string): void => {
    // Find the chat to update
    const updatedChats = chats.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          lastMessageTime: new Date(),
          newMessages: chat.newMessages + 1
        };
      }
      return chat;
    });
    
    // Sort chats by most recent message
    const sortedChats = updatedChats.sort((a, b) => {
      const timeA = a.lastMessageTime ? a.lastMessageTime.getTime() : 0;
      const timeB = b.lastMessageTime ? b.lastMessageTime.getTime() : 0;
      return timeB - timeA; // Sort in descending order (newest first)
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
        return theme.colors.error || '#ffcc00';
      default:
        return 'transparent';
    }
  };

  // Render each chat item
  const renderChatItem = ({ item }: { item: ChatItem }): JSX.Element => (
    <Pressable
      onPress={() => setSelectedChat(item)}
    >
      <Surface style={styles.chatItem} elevation={0}>
        <View style={styles.avatarContainer}>
          <Avatar.Image size={50} source={item.avatar} />
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
        
        {/* TODO: Break into its own component? */}
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
    return timeB - timeA; // Sort in descending order (newest first)
  });

  return (
    <ThemedView style={styles.container}>
      {/* Header with Chat title and Requests button */}
      <Surface style={styles.header} elevation={1}>
        <Title style={styles.headerTitle}>Chat</Title>
        <Button mode="contained" onPress={() => setShowRequests(true)}>
          Requests
        </Button>
      </Surface>

      <Divider />

      {/* Chat list */}
      <FlatList
        data={sortedChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        ItemSeparatorComponent={() => <Divider />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});