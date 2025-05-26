import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, FlatList, View, Alert, ActivityIndicator } from 'react-native';
import {
  Button,
  Surface,
  Text,
  Avatar,
  Title,
  Divider,
  useTheme,
  Chip,
  IconButton,
  Card,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatService, ProjectRequest, RequestItem } from '../../services/chatService'; // Adjust import path

interface ProjectRequestsProps {
  onBack: () => void;
  onAcceptRequest: (request: RequestItem) => void;
  currentUserId: string; // Add this prop
}

export function ProjectRequests({ 
  onBack, 
  onAcceptRequest, 
  currentUserId 
}: ProjectRequestsProps): JSX.Element {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const theme = useTheme();
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load requests from Firebase
  useEffect(() => {
    const loadRequests = () => {
      setLoading(true);

      console.log('Loading requests for user:', currentUserId);
      
      // Set up real-time subscription to user's requests
      const unsubscribe = ChatService.subscribeToUserRequests(
        currentUserId,
        (firebaseRequests: ProjectRequest[]) => {
          // Convert Firebase requests to RequestItems for UI compatibility
          const requestItems = ChatService.convertProjectRequestsToRequestItems(firebaseRequests);
          setRequests(requestItems);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
    };

    if (currentUserId) {
      loadRequests();
    }

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [currentUserId]);

  // Handle accepting a request
  const handleAcceptRequest = async (request: RequestItem): Promise<void> => {
    // Add to processing set to show loading state
    setProcessingRequests(prev => new Set(prev).add(request.id));

    try {
      const success = await ChatService.acceptProjectRequest(request.id);
      
      if (success) {
        // Call the parent's callback for any additional UI updates
        onAcceptRequest(request);
        
        // Show success message
        const actionMessage = request.startDM 
          ? 'DM conversation started!' 
          : 'User added to project!';
          
        Alert.alert('Success', actionMessage);
      } else {
        Alert.alert('Error', 'Failed to process request. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      // Remove from processing set
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
    }
  };

  // Handle declining a request
  const handleDeclineRequest = async (requestId: string): Promise<void> => {
    // Add to processing set to show loading state
    setProcessingRequests(prev => new Set(prev).add(requestId));

    try {
      const success = await ChatService.declineProjectRequest(requestId);
      
      if (success) {
        Alert.alert('Request Declined', 'The request has been declined.');
      } else {
        Alert.alert('Error', 'Failed to decline request. Please try again.');
      }
    } catch (error) {
      console.error('Error declining request:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      // Remove from processing set
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  // Get request type display text
  const getRequestTypeText = (request: RequestItem): string => {
    return request.startDM 
      ? 'wants to start a conversation' 
      : 'wants to join your project';
  };

  // Get request type chip color
  const getRequestTypeColor = (request: RequestItem): string => {
    return request.startDM ? '#4CAF50' : '#2196F3';
  };

  // Render individual request item
  const renderRequestItem = ({ item }: { item: RequestItem }): JSX.Element => {
    const isProcessing = processingRequests.has(item.id);
    
    return (
      <Card style={styles.requestCard}>
        <Card.Content>
          <View style={styles.requestHeader}>
            <View style={styles.userInfo}>
              <Avatar.Text
                size={40}
                label={item.name.split(' ').map(word => word[0]).join('').slice(0, 2)}
                style={{
                  backgroundColor: `hsl(${parseInt(item.fromUserId, 36) % 360}, 70%, 60%)`
                }}
              />
              <View style={styles.userDetails}>
                <Text variant="titleMedium" style={styles.userName}>
                  {item.name}
                </Text>
                <Text variant="bodySmall" style={styles.requestType}>
                  {getRequestTypeText(item)}
                </Text>
              </View>
            </View>
            
            <Chip
              style={[
                styles.typeChip,
                { backgroundColor: getRequestTypeColor(item) }
              ]}
              textStyle={styles.typeChipText}
            >
              {item.startDM ? 'DM' : 'JOIN'}
            </Chip>
          </View>

          <View style={styles.projectInfo}>
            <Text variant="labelMedium" style={styles.projectLabel}>
              Project:
            </Text>
            <Text variant="bodyMedium" style={styles.projectName}>
              {item.project}
            </Text>
          </View>

          {item.message && (
            <View style={styles.messageContainer}>
              <Text variant="labelMedium" style={styles.messageLabel}>
                Message:
              </Text>
              <Text variant="bodySmall" style={styles.messageText}>
                {item.message}
              </Text>
            </View>
          )}

          <View style={styles.requestActions}>
            <Button
              mode="contained"
              onPress={() => handleAcceptRequest(item)}
              disabled={isProcessing}
              loading={isProcessing}
              style={styles.acceptButton}
            >
              {item.startDM ? 'Start Chat' : 'Accept'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => handleDeclineRequest(item.id)}
              disabled={isProcessing}
              style={styles.declineButton}
            >
              Decline
            </Button>
          </View>

          <View style={styles.timestampContainer}>
            <Text variant="bodySmall" style={styles.timestamp}>
              {item.timestamp.toLocaleDateString()} at {item.timestamp.toLocaleTimeString()}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={onBack}
          />
          <Title style={styles.headerTitle}>Requests</Title>
          <View style={styles.headerSpacer} />
        </View>
        <Divider />
        
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={1}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={onBack}
        />
        <Title style={styles.headerTitle}>Requests</Title>
        <View style={styles.headerSpacer} />
      </Surface>

      <Divider />

      {/* Requests list */}
      {requests.length === 0 ? (
        <View style={[styles.container, styles.centered]}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No pending requests
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            When people want to join your projects or start conversations, 
            their requests will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          style={styles.requestsList}
          contentContainerStyle={styles.requestsContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 22,
    marginLeft: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  requestsList: {
    flex: 1,
  },
  requestsContent: {
    padding: 16,
  },
  requestCard: {
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
  },
  requestType: {
    color: '#666',
    marginTop: 2,
  },
  typeChip: {
    height: 28,
  },
  typeChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectLabel: {
    color: '#666',
    marginRight: 8,
  },
  projectName: {
    fontWeight: '500',
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  messageLabel: {
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  acceptButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
  },
  timestampContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  separator: {
    height: 8,
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
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});

export { RequestItem };
