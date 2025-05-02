import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, FlatList, View, Image } from 'react-native';
import {
  Button,
  Surface,
  Text,
  Avatar,
  Badge,
  Title,
  Divider,
  useTheme,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatDetail } from '@/components/chat/ChatDetail';
import { ProjectRequests } from '@/components/chat/ChatRequests';
import { useIsFocused } from '@react-navigation/native';

// Type definitions
type ChatParticipantStatus = 'conversation' | 'reachedOut' | 'none';

export interface ChatItem {
  id: string;
  name: string;
  participants: string;
  avatar: any; // For image require
  newMessages: number;
  status: ChatParticipantStatus;
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
  },
  {
    id: '2',
    name: 'Spider Robot',
    participants: 'Chris Hoch',
    avatar: require('@/assets/images/1.png'),
    newMessages: 1,
    status: 'conversation',
  },
  {
    id: '3',
    name: 'Collaborative Essay',
    participants: 'FamousWriter123',
    avatar: require('@/assets/images/1.png'),
    newMessages: 0,
    status: 'reachedOut',
  },
];

export default function ChatScreen(): JSX.Element {
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showRequests, setShowRequests] = useState<boolean>(false);
  const theme = useTheme();

  // Handle back navigation
  const handleBack = (): void => {
    setSelectedChat(null);
  };

  const handleBackFromRequests = (): void => {
    setShowRequests(false);
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
        onAcceptRequest={() => console.log('Request accepted')}
      />
    );
  }

  if (selectedChat) {
    return (
      <ChatDetail
        chat={selectedChat}
        onBack={handleBack}
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
    <div
      onClick={() => setSelectedChat(item)}
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
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text variant="titleMedium" style={styles.chatName}>{item.name}</Text>
            {item.newMessages > 0 && (
              <Text variant="labelSmall" style={styles.messageCount}>
                {item.newMessages} new {item.newMessages === 1 ? 'message' : 'messages'}
              </Text>
            )}
          </View>
          <Text variant="bodySmall" style={styles.participants}>{item.participants}</Text>
        </View>
      </Surface>
    </div>
  );

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
        data={chatData}
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
  },
  messageCount: {
    color: '#888',
  },
  participants: {
    color: '#666',
  },
});