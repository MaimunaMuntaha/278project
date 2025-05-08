import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Appbar,
  Button,
  Surface,
  Text,
  TextInput,
  useTheme,
  Divider,
  Chip,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatItem } from '@/app/(tabs)/chat';
import { RequestItem } from '@/components/chat/ChatRequests';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isCurrentUser: boolean;
}

// Sample messages mapped by chat ID
const messagesByChatId: Record<string, Message[]> = {
  '1': [
    {
      id: '1-1',
      text: 'Dolphin related stuff',
      sender: 'JD',
      timestamp: '10:30 AM',
      isCurrentUser: true,
    },
    {
      id: '1-2',
      text: 'We need to do a lot of important work on the dolphin',
      sender: 'CP',
      timestamp: '10:32 AM',
      isCurrentUser: false,
    },
  ],
  '2': [
    {
      id: '2-1',
      text: 'How is the spider robot project going?',
      sender: 'Me',
      timestamp: '2:15 PM',
      isCurrentUser: true,
    },
    {
      id: '2-2',
      text: 'Making good progress on the leg mechanisms',
      sender: 'Chris',
      timestamp: '2:20 PM',
      isCurrentUser: false,
    },
  ],
  '3': [
    {
      id: '3-1',
      text: 'I have some ideas for our collaborative essay',
      sender: 'Me',
      timestamp: '9:45 AM',
      isCurrentUser: true,
    },
    {
      id: '3-2',
      text: 'Great, let me know what youre thinking!',
      sender: 'FamousWriter123',
      timestamp: '10:02 AM',
      isCurrentUser: false,
    },
  ],
  '4': [
    {
      id: '4-1',
      text: 'Hello! I wanted to discuss your request to join the Essay Writing Project before making a decision.',
      sender: 'Me',
      timestamp: '10:05 AM',
      isCurrentUser: true,
    },
    {
      id: '4-2',
      text: 'Thanks for reaching out! I have experience with collaborative writing and would love to contribute to the project.',
      sender: 'Sam A.',
      timestamp: '10:07 AM',
      isCurrentUser: false,
    },
  ],
};

// Chat Detail Component
export const ChatDetail: React.FC<{
  chat: ChatItem;
  onBack: () => void;
  onMessageSent?: (chatId: string, messageText: string) => void;
  requestData?: RequestItem;
}> = ({ chat, onBack, onMessageSent, requestData }) => {
  const [messages, setMessages] = useState<Message[]>(
    messagesByChatId[chat.id] || []
  );
  const [inputText, setInputText] = useState<string>('');
  const [requestHandled, setRequestHandled] = useState<boolean>(false);
  const theme = useTheme();

  // Format project ID for display
  const formatProjectName = (projectId: string): string => {
    return projectId.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Check if we need to initialize the messages for this chat
  useEffect(() => {
    // If this is a direct message chat with no messages
    if (chat.type === 'direct' && chat.requestId && messages.length === 0) {
      // Initialize with a default message
      const initialMessage: Message = {
        id: Date.now().toString(),
        text: `Hello! I wanted to discuss your request to join ${formatProjectName(chat.projectId || '')} before making a decision.`,
        sender: 'Me',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCurrentUser: true,
      };
      
      setMessages([initialMessage]);
      
      // Notify parent component
      if (onMessageSent) {
        onMessageSent(chat.id, initialMessage.text);
      }
    }
  }, [chat.id, chat.projectId, chat.requestId, chat.type, messages.length, onMessageSent]);

  // Handle sending a new message
  const handleSendMessage = (): void => {
    if (inputText.trim() === '') return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'Me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: true,
    };
    
    setMessages([...messages, newMessage]);
    setInputText('');
    
    // Notify the parent component about the new message
    if (onMessageSent) {
      onMessageSent(chat.id, inputText);
    }
  };

  // Handle accepting a request (for direct messages related to project requests)
  const handleAcceptRequest = (): void => {
    // Add a system message to indicate the request was accepted
    const systemMessage: Message = {
      id: Date.now().toString(),
      text: "✅ You've accepted this request. The user will be added to the project.",
      sender: 'System',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: false,
    };
    
    setMessages([...messages, systemMessage]);
    setRequestHandled(true);
    
    // You would typically call an API to update the project membership here
  };
  
  // Handle declining a request
  const handleDeclineRequest = (): void => {
    // Add a system message to indicate the request was declined
    const systemMessage: Message = {
      id: Date.now().toString(),
      text: "❌ You've declined this request.",
      sender: 'System',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: false,
    };
    
    setMessages([...messages, systemMessage]);
    setRequestHandled(true);
    
    // You would typically call an API to update the request status here
  };

  // Render a message bubble
  const renderMessage = ({ item }: { item: Message }): JSX.Element => {
    // Check if this is a system message
    const isSystemMessage = item.sender === 'System';
    
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
          subtitle={chat.type === 'direct' ? 'Direct Message' : undefined}
        />
        <Appbar.Action icon="information" onPress={() => console.log('Info')} />
      </Appbar.Header>

      <ThemedView style={styles.container}>
        <Divider />

        {/* Project request info for direct messages */}
        {chat.type === 'direct' && chat.projectId && (
          <Surface style={styles.projectInfoContainer}>
            <View style={styles.projectInfoContent}>
              <Text style={styles.projectInfoText}>
                Discussing request for:
              </Text>
              <Chip 
                icon="folder" 
                style={styles.projectChip}
              >
                {formatProjectName(chat.projectId)}
              </Chip>
            </View>
            
            {/* Action buttons for request */}
            {chat.requestId && !requestHandled && (
              <View style={styles.requestActions}>
                <Button 
                  mode="outlined" 
                  compact 
                  icon="close" 
                  onPress={handleDeclineRequest}
                  style={[styles.requestActionButton, styles.declineButton]}
                  labelStyle={styles.requestButtonLabel}
                >
                  Decline
                </Button>
                <Button 
                  mode="outlined" 
                  compact 
                  icon="check" 
                  onPress={handleAcceptRequest}
                  style={[styles.requestActionButton, styles.acceptButton]}
                  labelStyle={styles.requestButtonLabel}
                >
                  Accept
                </Button>
              </View>
            )}
          </Surface>
        )}

        {/* Messages List */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
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
          />
          <Button 
            mode="contained" 
            onPress={handleSendMessage}
            disabled={inputText.trim() === ''}
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
  projectInfoContainer: {
    flexDirection: 'column',
    padding: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  projectInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectInfoText: {
    fontSize: 14,
    marginRight: 8,
  },
  projectChip: {
    height: 32,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  requestActionButton: {
    marginLeft: 8,
    height: 36,
  },
  requestButtonLabel: {
    fontSize: 12,
    lineHeight: 12,
    paddingTop: 2,
    margin: 0,
  },
  declineButton: {
    borderColor: 'rgba(244, 67, 54, 0.5)',
  },
  acceptButton: {
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
});