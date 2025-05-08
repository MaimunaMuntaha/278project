import React, { useState } from 'react';
import { StyleSheet, FlatList, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import {
  Appbar,
  Surface,
  Avatar,
  Text,
  Divider,
  IconButton,
  useTheme,
  Button,
  Portal,
  Dialog,
} from 'react-native-paper';

// Type definition for request items
export interface RequestItem {
  id: string;
  name: string;
  message: string;
  avatar: any;
  project: string;
  timestamp: string;
  startDM?: boolean; // Flag for DM conversations
}

// Sample request data
const requestsData: RequestItem[] = [
  {
    id: '1',
    name: 'Sam A.',
    message: 'I have had three project experiences of essays, would love to join your team!',
    avatar: require('@/assets/images/1.png'),
    project: 'Essay Writing Project',
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    name: 'Homer R.',
    message: 'Awesome idea, I have experience in this area and would like to contribute.',
    avatar: require('@/assets/images/1.png'),
    project: 'Robotics Team',
    timestamp: '5 hours ago',
  },
  {
    id: '3',
    name: 'Cherry B.',
    message: 'My other two friends are also interested, we are in Cultural Studies together.',
    avatar: require('@/assets/images/1.png'),
    project: 'Cultural Studies Group',
    timestamp: '1 day ago',
  },
];

interface ProjectRequestsProps {
  onBack: () => void;
  onAcceptRequest: (request: RequestItem) => void;
}

export const ProjectRequests: React.FC<ProjectRequestsProps> = ({ 
  onBack, 
  onAcceptRequest 
}) => {
  const theme = useTheme();
  const [requests, setRequests] = useState<RequestItem[]>(requestsData);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  
  // Handle declining a request
  const handleDecline = (request: RequestItem) => {
    setSelectedRequest(request);
    setDialogVisible(true);
  };
  
  // Confirm decline
  const confirmDecline = () => {
    if (selectedRequest) {
      setRequests(requests.filter(req => req.id !== selectedRequest.id));
    }
    setDialogVisible(false);
  };
  
  // Handle accepting a request
  const handleAccept = (request: RequestItem) => {
    // Remove from requests list
    setRequests(requests.filter(req => req.id !== request.id));
    
    // Call the parent component's onAcceptRequest
    onAcceptRequest(request);
  };
  
  // Handle starting a DM conversation
  const handleStartDM = (request: RequestItem) => {
    // Call the parent component's onAcceptRequest with a special flag
    onAcceptRequest({...request, startDM: true});
  };
  
  // Render each request item
  const renderRequestItem = ({ item }: { item: RequestItem }): JSX.Element => (
    <>
      <Surface style={styles.requestItem}>
        <View style={styles.requestHeader}>
          <View style={styles.userInfo}>
            <Avatar.Image size={50} source={item.avatar} style={styles.avatar} />
            <View style={styles.textContainer}>
              <Text style={styles.nameText}>{item.name}</Text>
              <Text style={styles.projectText}>{item.project}</Text>
              <Text style={styles.timestampText}>{item.timestamp}</Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <IconButton
              icon="message-outline"
              size={24}
              iconColor={theme.colors.secondary}
              onPress={() => handleStartDM(item)}
              style={[styles.actionButton, styles.messageButton]}
            />
            <IconButton
              icon="close"
              size={24}
              iconColor={theme.colors.error}
              onPress={() => handleDecline(item)}
              style={[styles.actionButton, styles.declineButton]}
            />
            <IconButton
              icon="check"
              size={24}
              iconColor={theme.colors.primary}
              onPress={() => handleAccept(item)}
              style={[styles.actionButton, styles.acceptButton]}
            />
          </View>
        </View>
        
        <Text style={styles.messageText}>{item.message}</Text>
      </Surface>
      <Divider />
    </>
  );
  
  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title="Project Requests" />
      </Appbar.Header>
      
      <ThemedView style={styles.container}>
        {requests.length > 0 ? (
          <FlatList
            data={requests}
            renderItem={renderRequestItem}
            keyExtractor={(item) => item.id}
            style={styles.requestsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending project requests</Text>
          </View>
        )}
        
        {/* Confirmation Dialog */}
        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
            <Dialog.Title>Decline Request?</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                Are you sure you want to decline this request from {selectedRequest?.name}?
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
              <Button onPress={confirmDecline}>Decline</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ThemedView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  requestsList: {
    flex: 1,
  },
  requestItem: {
    padding: 16,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  textContainer: {
    justifyContent: 'center',
  },
  nameText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  projectText: {
    fontSize: 14,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  messageText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 62, // Aligns with the text next to avatar
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    margin: 4,
  },
  declineButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  acceptButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  messageButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});