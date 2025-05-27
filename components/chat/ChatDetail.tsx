import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, FlatList, View, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import {
  Appbar,
  Button,
  Surface,
  Text,
  TextInput,
  useTheme,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatItem } from '@/app/(tabs)/chat';
import { ChatService, FirebaseChatMessage, RequestDMMessage } from '@/services/chatService';
import { useAuth } from '@/app/_layout';
import { Timestamp } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isCurrentUser: boolean;
  type?: 'text' | 'system';
}

// Chat Detail Component
export const ChatDetail: React.FC<{
  chat: ChatItem;
  onBack: () => void;
  onMessageSent?: (chatId: string, messageText: string) => void;
}> = ({ chat, onBack, onMessageSent }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const theme = useTheme();

  // Ref for auto-scrolling to bottom
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom function
  const scrollToBottom = (animated: boolean = true) => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated });
        } catch (error) {
          // Handle any scrolling errors gracefully
          console.log('Scroll error:', error);
        }
      }, 100); // Small delay to ensure content is rendered
    }
  };

  // Convert Firebase group message to local message format
  const convertFirebaseGroupMessage = (firebaseMsg: FirebaseChatMessage): Message => {
    return {
      id: firebaseMsg.id,
      text: firebaseMsg.text,
      sender: firebaseMsg.senderName,
      timestamp: firebaseMsg.timestamp.toDate().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isCurrentUser: firebaseMsg.senderId === authUser?.uid,
      type: 'text'
    };
  };

  // Convert RequestDMMessage to local message format
  const convertRequestDMMessage = (dmMsg: RequestDMMessage): Message => {
    return {
      id: dmMsg.id,
      text: dmMsg.text,
      sender: dmMsg.senderName,
      timestamp: dmMsg.timestamp.toDate().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isCurrentUser: dmMsg.senderId === authUser?.uid,
      type: dmMsg.type === 'system' ? 'system' : 'text'
    };
  };

  const markMessagesAsRead = async (latestMessageId: string) => {
    if (authUser?.uid && latestMessageId && chat.type === 'group') {
      try {
        await ChatService.markMessagesAsRead(chat.id, authUser.uid, latestMessageId);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
    // For request DMs, we don't need to track read status since they're temporary
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!authUser || !chat.id) return;

    setLoading(true);
    
    if (chat.type === 'group') {
      const unsubscribe = ChatService.subscribeToGroupChatMessages(
        chat.id,
        async (firebaseMessages: FirebaseChatMessage[]) => {
          const convertedMessages = firebaseMessages.map(convertFirebaseGroupMessage);
          setMessages(convertedMessages);
          
          // Mark messages as read if there are any messages
          if (firebaseMessages.length > 0) {
            const latestMessage = firebaseMessages[firebaseMessages.length - 1];
            setLastMessageId(latestMessage.id);
            
            // Mark as read after a short delay to ensure UI is ready
            setTimeout(() => {
              markMessagesAsRead(latestMessage.id);
            }, 500);
          }
          
          setLoading(false);
          
          // Auto-scroll to bottom when messages are loaded/updated
          setTimeout(() => {
            scrollToBottom(!loading); // No animation on initial load, animated for updates
          }, 200);
        }
      );

      return () => unsubscribe();
    } else if (chat.type === 'request_dm') {
      const unsubscribe = ChatService.subscribeToRequestDMMessages(
        chat.id,
        async (dmMessages: RequestDMMessage[]) => {
          const convertedMessages = dmMessages.map(convertRequestDMMessage);
          setMessages(convertedMessages);
          setLoading(false);
          
          // Auto-scroll to bottom when messages are loaded/updated
          setTimeout(() => {
            scrollToBottom(!loading); // No animation on initial load, animated for updates
          }, 200);
        }
      );

      return () => unsubscribe();
    }
  }, [chat.id, chat.type, authUser]);
  
  useEffect(() => {
    if (lastMessageId && authUser?.uid) {
      markMessagesAsRead(lastMessageId);
    }
  }, [lastMessageId, authUser?.uid]);

  // Auto-scroll when chat is first opened or when returning to it
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom(false); // No animation when first opening
      }, 300);
    }
  }, [loading, chat.id]); // Trigger when chat changes or loading completes

  // Handle sending a message
  const handleSendMessage = async (): Promise<void> => {
    if (inputText.trim() === '' || !authUser) return;
    
    setSendingMessage(true);
    
    try {
      let success = false;
      
      if (chat.type === 'group') {
        success = await ChatService.sendGroupChatMessage(
          chat.id,
          authUser.uid,
          authUser.displayName || 'Anonymous',
          inputText.trim()
        );
      } else if (chat.type === 'request_dm') {
        success = await ChatService.sendRequestDMMessage(
          chat.id,
          authUser.uid,
          authUser.displayName || 'Anonymous',
          inputText.trim()
        );
      }

      if (!success) {
        Alert.alert('Error', 'Failed to send message. Please try again.');
        return;
      }

      setInputText('');
      
      // Auto-scroll to bottom after sending a message
      setTimeout(() => {
        scrollToBottom(true);
      }, 150);
      
      if (onMessageSent) {
        onMessageSent(chat.id, inputText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Render a message bubble
  const renderMessage = ({ item }: { item: Message }): JSX.Element => {
    const isSystemMessage = item.type === 'system' || item.sender === 'System';
    
    return (
      <View 
        style={[
          styles.messageContainer,
          item.isCurrentUser ? styles.userMessageContainer : styles.otherMessageContainer,
          isSystemMessage && styles.systemMessageContainer
        ]}
      >
        <Surface 
          style={[
            styles.messageBubble,
            item.isCurrentUser 
              ? { backgroundColor: theme.colors.primary } 
              : isSystemMessage
                ? { backgroundColor: 'rgba(0, 0, 0, 0.05)' }
                : { backgroundColor: theme.colors.surfaceVariant }
          ]}
          elevation={1}
        >
          {!item.isCurrentUser && !isSystemMessage && (
            <Text variant="labelSmall" style={styles.senderName}>{item.sender}</Text>
          )}
          <Text 
            style={[
              styles.messageText,
              item.isCurrentUser 
                ? { color: theme.colors.onPrimary } 
                : isSystemMessage
                  ? { color: '#666', fontStyle: 'italic' }
                  : { color: theme.colors.onSurfaceVariant }
            ]}
          >
            {item.text}
          </Text>
        </Surface>
        <Text variant="labelSmall" style={styles.timestamp}>{item.timestamp}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading messages...</Text>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content 
          title={chat.name}
          subtitle={chat.type === 'request_dm' 
            ? 'Temporary request chat' 
            : `${chat.memberCount || 0} members`
          }
        />
        <Appbar.Action icon="information" onPress={() => console.log('Info')} />
      </Appbar.Header>

      <ThemedView style={styles.container}>
        <Divider />

        {/* Welcome message for new chats */}
        {messages.length === 0 && !loading && (
          <View style={styles.welcomeMessageContainer}>
            <Text variant="bodyMedium" style={styles.welcomeMessage}>
              {chat.type === 'request_dm' 
                ? 'This is a temporary chat for discussing the project request. It will close when the request is resolved.'
                : `Welcome to the ${chat.name} project chat! Start the conversation.`
              }
            </Text>
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10
          }}
          onContentSizeChange={() => {
            // Auto-scroll when content size changes (new messages arrive)
            if (!loading) {
              setTimeout(() => {
                scrollToBottom(true);
              }, 100);
            }
          }}
          onLayout={() => {
            // Scroll to bottom when FlatList is laid out for the first time
            if (!loading && messages.length > 0) {
              setTimeout(() => {
                scrollToBottom(false);
              }, 200);
            }
          }}
        />
        
        {/* Input Area */}
        <Surface style={styles.inputContainer} elevation={1}>
          <TextInput
            mode="outlined"
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="New message..."
            outlineStyle={styles.inputOutline}
            disabled={sendingMessage}
            onFocus={() => {
              // Scroll to bottom when user focuses input
              setTimeout(() => {
                scrollToBottom(true);
              }, 300); // Slight delay to account for keyboard animation
            }}
          />
          <Button 
            mode="contained" 
            onPress={handleSendMessage}
            disabled={inputText.trim() === '' || sendingMessage}
            loading={sendingMessage}
            style={styles.sendButton}
          >
            Send
          </Button>
        </Surface>
      </ThemedView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    maxWidth: '90%',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
  },
  senderName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
    alignSelf: 'flex-end',
    color: '#888',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginBottom: 49,
  },
  input: {
    flex: 1,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  inputOutline: {
    borderRadius: 20,
  },
  sendButton: {
    justifyContent: 'center',
    borderRadius: 20,
    alignSelf: 'center',
  },
  welcomeMessageContainer: {
    padding: 16,
    alignItems: 'center',
  },
  welcomeMessage: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
});